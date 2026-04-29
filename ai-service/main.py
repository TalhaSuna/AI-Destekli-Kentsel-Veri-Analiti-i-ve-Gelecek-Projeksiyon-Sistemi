from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import threading
import config
import db
import predictor
import seed_data
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

app = FastAPI(title="Kentsel Veri AI Servisi")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hourly/{channel}")
def get_hourly(channel: str, days: int = 7):
    """Son N günün saatlik özet verisini döndürür."""
    if channel == "density":
        df = db.fetch_hourly_density(days)
    elif channel == "traffic":
        df = db.fetch_hourly_traffic(days)
    elif channel == "speed":
        df = db.fetch_hourly_speed(days)
    else:
        return {"error": f"Bilinmeyen kanal: {channel}"}

    df["hour"] = df["hour"].astype(str)
    return {"channel": channel, "count": len(df), "data": df.to_dict(orient="records")}


@app.get("/api/predictions/{channel}")
def get_predictions(channel: str):
    """Prophet tahmin sonuçlarını döndürür (önümüzdeki 14 saat, saatlik)."""
    df = db.fetch_predictions(channel)
    if df.empty:
        return {"channel": channel, "count": 0, "data": []}

    df["hour"]       = df["hour"].astype(str)
    df["created_at"] = df["created_at"].astype(str)
    return {"channel": channel, "count": len(df), "data": df.to_dict(orient="records")}


@app.post("/api/predict")
def run_prediction():
    """Tüm kanallar için tahmini manuel tetikler."""
    predictor.run_all()
    return {"status": "ok", "message": "Tahminler güncellendi"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    """Servis açılınca: seed verisi yoksa üret, ardından ilk tahmini çalıştır."""
    def init():
        seed_data.seed_if_needed()
        predictor.run_all()
        print("[Startup] Hazır.")

    threading.Thread(target=init, daemon=True).start()


def scheduled_predict():
    try:
        predictor.run_all()
    except Exception as e:
        print(f"[Scheduler] Hata: {e}")


scheduler = BackgroundScheduler()
scheduler.add_job(func=scheduled_predict, trigger="interval", minutes=5)
scheduler.start()
print("[Scheduler] Her 5 dakikada bir tahmin güncellenir")

atexit.register(lambda: scheduler.shutdown())


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=config.API_PORT, reload=True)
