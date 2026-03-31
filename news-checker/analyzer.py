"""
新聞可信度分析器 (NewsAnalyzer)
採用 5 層分析架構：
  1. 媒體來源評分   - 已知媒體的可信度基準分
  2. Cofacts 事實查核 - 查詢 Cofacts GraphQL API
  3. 內容品質分析   - 關鍵字、字數、結構評估
  4. 交叉驗證       - 是否出現在多個可信來源
  5. 時效性評估     - 新聞新鮮度
"""

import re
import time
import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)


# ─── 已知媒體可信度基準（0-100） ──────────────────────────────────────────────

MEDIA_CREDIBILITY: dict[str, int] = {
    # 官方 / 法人
    "twse.com.tw": 95,
    "mops.twse.com.tw": 95,
    "tpex.org.tw": 90,
    "fsc.gov.tw": 93,
    "gov.tw": 88,
    # 主流財經媒體
    "cnyes.com": 82,
    "news.cnyes.com": 82,
    "moneydj.com": 80,
    "ctee.com.tw": 78,
    "udn.com": 76,
    "cna.com.tw": 85,
    "storm.mg": 70,
    "wealth.com.tw": 75,
    "businesstoday.com.tw": 74,
    "moneyweekly.com.tw": 72,
    # Yahoo / LINE 聚合
    "tw.stock.yahoo.com": 75,
    "finance.yahoo.com": 76,
    "today.line.me": 68,
    # 社群 / 論壇 (低基準)
    "ptt.cc": 40,
    "mobile01.com": 38,
    "dcard.tw": 35,
    "stockfeel.com.tw": 55,
    "cmoney.tw": 60,
}

DEFAULT_MEDIA_SCORE = 50   # 未知來源

# ─── 可疑關鍵字（降低分數） ────────────────────────────────────────────────────

SUSPICIOUS_KEYWORDS = [
    # 煽情標題
    "震驚", "不敢相信", "秘密曝光", "獨家爆料", "內幕",
    "驚爆", "超狂", "你絕對不知道", "瘋傳", "必看",
    # 假新聞常見詞
    "謠言", "闢謠", "假訊息", "查核為假", "未經證實",
    # 詐騙相關
    "保證獲利", "穩賺不賠", "飆股明牌", "內線消息", "必漲",
]

QUALITY_KEYWORDS = [
    # 正式引述
    "根據", "表示", "指出", "說明", "公告", "財報", "法說會",
    "研究報告", "分析師", "主管機關", "依法",
]


# ─── Cofacts GraphQL ──────────────────────────────────────────────────────────

COFACTS_ENDPOINT = "https://api.cofacts.tw/graphql"
COFACTS_TIMEOUT = 8.0

COFACTS_QUERY = """
query CheckArticle($text: String!) {
  ListArticles(filter: { moreLikeThis: { like: $text } }, first: 3) {
    edges {
      node {
        id
        text
        articleReplies(status: NORMAL) {
          reply {
            type
            text
          }
        }
      }
    }
  }
}
"""


# ─── 交叉驗證來源 ──────────────────────────────────────────────────────────────

CROSS_VALIDATION_SOURCES = [
    "https://news.cnyes.com/rss/tw/twstock",
    "https://www.twse.com.tw/rss/zh/news.xml",
]


# ─── 結果資料結構 ──────────────────────────────────────────────────────────────

@dataclass
class LayerResult:
    name: str
    score: int        # 0-100
    weight: float
    detail: str


@dataclass
class AnalysisResult:
    overall_score: int         # 0-100 加權總分
    verdict: str               # CREDIBLE / UNCERTAIN / SUSPICIOUS
    layers: list[LayerResult] = field(default_factory=list)
    summary: str = ""
    cofacts_found: bool = False
    cofacts_verdict: Optional[str] = None
    processing_ms: int = 0


# ─── 主分析器 ─────────────────────────────────────────────────────────────────

class NewsAnalyzer:
    """5 層新聞可信度分析器"""

    LAYER_WEIGHTS = {
        "media_source":    0.30,
        "cofacts":         0.25,
        "content_quality": 0.20,
        "cross_validation":0.15,
        "timeliness":      0.10,
    }

    def __init__(self, http_client: Optional[httpx.AsyncClient] = None):
        self._client = http_client
        self._own_client = http_client is None

    async def __aenter__(self):
        if self._own_client:
            self._client = httpx.AsyncClient(timeout=10.0, follow_redirects=True)
        return self

    async def __aexit__(self, *args):
        if self._own_client and self._client:
            await self._client.aclose()

    # ── Public API ────────────────────────────────────────────────────────────

    async def analyze(
        self,
        text: str = "",
        url: str = "",
        title: str = "",
        published_at: Optional[float] = None,  # Unix timestamp
    ) -> AnalysisResult:
        t0 = time.time()

        # 合併文字
        full_text = " ".join(filter(None, [title, text]))
        domain = self._extract_domain(url)

        # 並行執行各層
        layers_coros = [
            self._layer_media_source(domain),
            self._layer_cofacts(full_text),
            self._layer_content_quality(full_text, url),
            self._layer_cross_validation(title or text[:80]),
            self._layer_timeliness(published_at),
        ]
        layer_results: list[LayerResult] = await asyncio.gather(*layers_coros)

        # 加權計算總分
        total_weight = sum(r.weight for r in layer_results)
        weighted_score = sum(r.score * r.weight for r in layer_results) / total_weight
        overall = round(weighted_score)

        # 判定結果
        verdict = self._verdict(overall)

        # Cofacts 特殊標記
        cofacts_layer = next((r for r in layer_results if r.name == "cofacts"), None)
        cofacts_found = cofacts_layer is not None and "查核" in cofacts_layer.detail
        cofacts_verdict = cofacts_layer.detail if cofacts_found else None

        summary = self._build_summary(overall, verdict, layer_results, domain)

        return AnalysisResult(
            overall_score=overall,
            verdict=verdict,
            layers=layer_results,
            summary=summary,
            cofacts_found=cofacts_found,
            cofacts_verdict=cofacts_verdict,
            processing_ms=round((time.time() - t0) * 1000),
        )

    # ── Layer 1: 媒體來源評分 ─────────────────────────────────────────────────

    async def _layer_media_source(self, domain: str) -> LayerResult:
        score = DEFAULT_MEDIA_SCORE
        detail = f"未知來源（{domain or '無 URL'}）"

        if domain:
            # 精確或部分匹配
            for key, val in MEDIA_CREDIBILITY.items():
                if domain == key or domain.endswith("." + key):
                    score = val
                    detail = f"已知媒體：{domain}（可信度基準 {val}）"
                    break
            else:
                # 官方政府域名
                if domain.endswith(".gov.tw"):
                    score = 90
                    detail = f"政府官方網站（{domain}）"
                elif domain.endswith(".edu.tw"):
                    score = 85
                    detail = f"學術機構（{domain}）"
        else:
            detail = "無 URL，無法評估來源"

        return LayerResult(
            name="media_source",
            score=score,
            weight=self.LAYER_WEIGHTS["media_source"],
            detail=detail,
        )

    # ── Layer 2: Cofacts 事實查核 ─────────────────────────────────────────────

    async def _layer_cofacts(self, text: str) -> LayerResult:
        if not text or len(text) < 10:
            return LayerResult("cofacts", 60, self.LAYER_WEIGHTS["cofacts"], "文字過短，略過查核")

        snippet = text[:200]
        try:
            if self._client is None:
                raise RuntimeError("HTTP client not initialized")

            resp = await self._client.post(
                COFACTS_ENDPOINT,
                json={"query": COFACTS_QUERY, "variables": {"text": snippet}},
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "NewsChecker/1.0 (stock-dashboard credibility analyzer)",
                },
                timeout=COFACTS_TIMEOUT,
            )
            data = resp.json()
            edges = data.get("data", {}).get("ListArticles", {}).get("edges", [])

            if not edges:
                return LayerResult("cofacts", 65, self.LAYER_WEIGHTS["cofacts"], "Cofacts 查無相關記錄")

            # 分析回應類型
            all_replies = []
            for edge in edges:
                replies = edge["node"].get("articleReplies", [])
                for ar in replies:
                    all_replies.append(ar["reply"]["type"])

            if not all_replies:
                return LayerResult("cofacts", 62, self.LAYER_WEIGHTS["cofacts"], "Cofacts 有記錄但無查核結論")

            # RUMOR / NOT_ARTICLE → 低分；OPINIONATED / NOT_RUMOR → 較高
            rumor_count = sum(1 for t in all_replies if t in ("RUMOR", "NOT_ARTICLE"))
            ok_count = sum(1 for t in all_replies if t in ("NOT_RUMOR", "OPINIONATED"))

            if rumor_count > 0 and rumor_count >= ok_count:
                score = max(10, 45 - rumor_count * 10)
                detail = f"Cofacts 查核：{rumor_count} 個謠言標記（總 {len(all_replies)} 筆）"
            elif ok_count > 0:
                score = min(88, 68 + ok_count * 5)
                detail = f"Cofacts 查核：{ok_count} 個已核實記錄"
            else:
                score = 60
                detail = "Cofacts 查核：記錄存在，無明確結論"

            return LayerResult("cofacts", score, self.LAYER_WEIGHTS["cofacts"], detail)

        except Exception as e:
            logger.warning(f"Cofacts API 失敗: {e}")
            return LayerResult("cofacts", 60, self.LAYER_WEIGHTS["cofacts"], f"Cofacts 服務暫時無法連線，略過查核")

    # ── Layer 3: 內容品質分析 ─────────────────────────────────────────────────

    async def _layer_content_quality(self, text: str, url: str) -> LayerResult:
        score = 60
        reasons = []

        if not text:
            return LayerResult("content_quality", 40, self.LAYER_WEIGHTS["content_quality"], "無文字內容")

        word_count = len(text)

        # 字數評估
        if word_count < 30:
            score -= 15
            reasons.append("內容過短")
        elif word_count > 200:
            score += 10
            reasons.append("內容充足")

        # 可疑關鍵字
        sus_found = [kw for kw in SUSPICIOUS_KEYWORDS if kw in text]
        if sus_found:
            penalty = min(30, len(sus_found) * 8)
            score -= penalty
            reasons.append(f"含可疑用語：{'、'.join(sus_found[:3])}")

        # 品質關鍵字
        qual_found = [kw for kw in QUALITY_KEYWORDS if kw in text]
        if qual_found:
            bonus = min(20, len(qual_found) * 4)
            score += bonus
            reasons.append(f"含引述詞：{'、'.join(qual_found[:3])}")

        # URL 有效性
        if url and urlparse(url).scheme in ("http", "https"):
            score += 5
        elif not url:
            score -= 5

        score = max(0, min(100, score))
        detail = "；".join(reasons) if reasons else "內容正常"

        return LayerResult("content_quality", score, self.LAYER_WEIGHTS["content_quality"], detail)

    # ── Layer 4: 交叉驗證 ─────────────────────────────────────────────────────

    async def _layer_cross_validation(self, title_snippet: str) -> LayerResult:
        if not title_snippet or len(title_snippet) < 5:
            return LayerResult("cross_validation", 55, self.LAYER_WEIGHTS["cross_validation"], "標題過短，略過驗證")

        keywords = title_snippet[:40]
        matches = 0

        # 並行查詢 RSS 來源
        async def check_rss(rss_url: str) -> bool:
            try:
                if self._client is None:
                    return False
                r = await self._client.get(rss_url, timeout=5.0)
                return keywords[:15] in r.text
            except Exception:
                return False

        results = await asyncio.gather(*[check_rss(u) for u in CROSS_VALIDATION_SOURCES])
        matches = sum(1 for r in results if r)

        if matches >= 2:
            score, detail = 85, f"在 {matches} 個可信來源找到相關報導"
        elif matches == 1:
            score, detail = 72, f"在 1 個可信來源找到相關報導"
        else:
            score, detail = 55, "未在其他可信來源找到交叉驗證"

        return LayerResult("cross_validation", score, self.LAYER_WEIGHTS["cross_validation"], detail)

    # ── Layer 5: 時效性評估 ───────────────────────────────────────────────────

    async def _layer_timeliness(self, published_at: Optional[float]) -> LayerResult:
        if published_at is None:
            return LayerResult("timeliness", 60, self.LAYER_WEIGHTS["timeliness"], "無發布時間資訊")

        age_hours = (time.time() - published_at) / 3600

        if age_hours < 1:
            score, detail = 95, "剛發布（1 小時內）"
        elif age_hours < 6:
            score, detail = 88, f"最新消息（{age_hours:.1f} 小時前）"
        elif age_hours < 24:
            score, detail = 80, f"今日新聞（{age_hours:.0f} 小時前）"
        elif age_hours < 72:
            score, detail = 70, f"近期新聞（{age_hours / 24:.1f} 天前）"
        elif age_hours < 720:
            score, detail = 55, f"較舊新聞（{age_hours / 24:.0f} 天前）"
        else:
            score, detail = 35, f"舊聞（{age_hours / 24:.0f} 天前）"

        return LayerResult("timeliness", score, self.LAYER_WEIGHTS["timeliness"], detail)

    # ── 工具方法 ──────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            parsed = urlparse(url)
            host = parsed.netloc.lower().replace("www.", "")
            return host
        except Exception:
            return ""

    @staticmethod
    def _verdict(score: int) -> str:
        if score >= 70:
            return "CREDIBLE"
        elif score >= 45:
            return "UNCERTAIN"
        else:
            return "SUSPICIOUS"

    @staticmethod
    def _build_summary(score: int, verdict: str, layers: list[LayerResult], domain: str) -> str:
        label = {"CREDIBLE": "可信度高", "UNCERTAIN": "可信度中等", "SUSPICIOUS": "可信度低"}[verdict]
        low_layers = [r for r in layers if r.score < 50]
        note = ""
        if low_layers:
            names = {"media_source": "媒體來源", "cofacts": "事實查核",
                     "content_quality": "內容品質", "cross_validation": "交叉驗證", "timeliness": "時效性"}
            note = f"，注意：{' / '.join(names.get(r.name, r.name) for r in low_layers[:2])} 評分偏低"
        src = f"（{domain}）" if domain else ""
        return f"綜合評分 {score}/100，{label}{src}{note}"
