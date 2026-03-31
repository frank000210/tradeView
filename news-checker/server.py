"""
新聞可信度查核服務
FastAPI HTTP Server

Endpoints:
  GET  /health         → 健康檢查
  POST /api/check      → 分析新聞可信度
  GET  /               → 服務說明（JSON）
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from analyzer import NewsAnalyzer, AnalysisResult, LayerResult

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ─── 共用 HTTP client（整個 app 生命週期） ────────────────────────────────────

http_client: Optional[httpx.AsyncClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=12.0, follow_redirects=True)
    logger.info("NewsChecker 服務啟動")
    yield
    await http_client.aclose()
    logger.info("NewsChecker 服務關閉")


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="新聞可信度查核服務",
    description="5 層分析：媒體來源 / Cofacts 事實查核 / 內容品質 / 交叉驗證 / 時效性",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ────────────────────────────────────────────────

class CheckRequest(BaseModel):
    url: str = Field(default="", description="新聞原始 URL")
    title: str = Field(default="", description="新聞標題")
    text: str = Field(default="", description="新聞內文（可選，會與 title 合併分析）")
    published_at: Optional[float] = Field(default=None, description="發布時間 Unix timestamp（秒）")


class LayerResponse(BaseModel):
    name: str
    label: str
    score: int
    weight: float
    detail: str


class CheckResponse(BaseModel):
    overall_score: int
    verdict: str          # CREDIBLE | UNCERTAIN | SUSPICIOUS
    verdict_label: str    # 中文標籤
    verdict_color: str    # CSS 顏色 hex
    summary: str
    layers: list[LayerResponse]
    cofacts_found: bool
    cofacts_verdict: Optional[str]
    processing_ms: int


# ─── 輔助 ─────────────────────────────────────────────────────────────────────

LAYER_LABELS = {
    "media_source":     "媒體來源",
    "cofacts":          "事實查核",
    "content_quality":  "內容品質",
    "cross_validation": "交叉驗證",
    "timeliness":       "時效性",
}

VERDICT_LABELS = {
    "CREDIBLE":   "可信度高",
    "UNCERTAIN":  "可信度中等",
    "SUSPICIOUS": "可信度低",
}

VERDICT_COLORS = {
    "CREDIBLE":   "#10b981",   # green
    "UNCERTAIN":  "#f59e0b",   # amber
    "SUSPICIOUS": "#ef4444",   # red
}


def _format_result(result: AnalysisResult) -> CheckResponse:
    layers = [
        LayerResponse(
            name=r.name,
            label=LAYER_LABELS.get(r.name, r.name),
            score=r.score,
            weight=r.weight,
            detail=r.detail,
        )
        for r in result.layers
    ]
    return CheckResponse(
        overall_score=result.overall_score,
        verdict=result.verdict,
        verdict_label=VERDICT_LABELS.get(result.verdict, result.verdict),
        verdict_color=VERDICT_COLORS.get(result.verdict, "#6b7280"),
        summary=result.summary,
        layers=layers,
        cofacts_found=result.cofacts_found,
        cofacts_verdict=result.cofacts_verdict,
        processing_ms=result.processing_ms,
    )


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "新聞可信度查核服務",
        "version": "1.0.0",
        "endpoints": {
            "GET /health": "健康檢查",
            "POST /api/check": "分析新聞可信度（url, title, text, published_at）",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/check", response_model=CheckResponse)
async def check_credibility(req: CheckRequest):
    if not req.url and not req.title and not req.text:
        raise HTTPException(status_code=400, detail="至少需提供 url、title 或 text 其中之一")

    try:
        analyzer = NewsAnalyzer(http_client=http_client)
        result = await analyzer.analyze(
            text=req.text,
            url=req.url,
            title=req.title,
            published_at=req.published_at,
        )
        return _format_result(result)
    except Exception as e:
        logger.error(f"分析失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"分析失敗：{str(e)}")


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
