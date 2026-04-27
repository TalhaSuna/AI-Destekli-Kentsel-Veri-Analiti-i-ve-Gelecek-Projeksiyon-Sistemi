from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import config
import db
import predictor

app = FastAPI(title="Kentsel Veri AI Servisi")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hourly/{channel}")
def get_hourly_data(channel: str, days: int = 7):
    """Saatlik özet verisini döndürür."""
    if channel == "density":
        df = db.fetch_hourly_density(days)
    elif channel == "traffic":
        df = db.fetch_hourly_traffic(days)
    elif channel == "speed":
        df = db.fetch_hourly_speed(days)
    else:
        return {"error": f"Bilinmeyen kanal: {channel}"}

    df["hour"] = df["hour"].astype(str)
    return {"channel": channel, "days": days, "count": len(df), "data": df.to_dict(orient="records")}


@app.get("/api/predictions/{channel}")
def get_predictions(channel: str):
    """Prophet tahmin sonuçlarını döndürür."""
    df = db.fetch_predictions(channel)
    if df.empty:
        return {"channel": channel, "count": 0, "data": []}

    df["hour"] = df["hour"].astype(str)
    df["created_at"] = df["created_at"].astype(str)
    return {"channel": channel, "count": len(df), "data": df.to_dict(orient="records")}


@app.post("/api/predict")
def run_prediction(days: int = 7):
    """Tüm kanallar için Prophet tahminini tetikler."""
    predictor.run_all(days)
    return {"status": "ok", "message": f"Tüm tahminler {days} günlük veriyle güncellendi"}


@app.post("/api/predict/{channel}")
def run_channel_prediction(channel: str, days: int = 7):
    """Tek kanal için Prophet tahminini tetikler."""
    if channel == "density":
        predictor.run_density_prediction(days)
    elif channel == "traffic":
        predictor.run_traffic_prediction(days)
    elif channel == "speed":
        predictor.run_speed_prediction(days)
    else:
        return {"error": f"Bilinmeyen kanal: {channel}"}

    return {"status": "ok", "message": f"{channel} tahmini {days} günlük veriyle güncellendi"}


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=config.API_PORT, reload=True)
