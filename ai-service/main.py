from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import threading
import config
import db
import predictor
import seeder
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


@app.get("/api/predictions-5min/{channel}")
def get_predictions_5min(channel: str):
    """5 dakikalık Prophet tahmin sonuçlarını döndürür."""
    channel_5min = f"{channel}_5min"
    df = db.fetch_predictions(channel_5min)
    if df.empty:
        return {"channel": channel_5min, "count": 0, "data": []}

    df["hour"] = df["hour"].astype(str)
    df["created_at"] = df["created_at"].astype(str)
    return {"channel": channel_5min, "count": len(df), "data": df.to_dict(orient="records")}


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


@app.post("/api/predict-5min")
def run_prediction_5min(hours: int = 14):
    """Tüm kanallar için 5 dakikalık Prophet tahminini tetikler (test amaçlı)."""
    predictor.run_all_5min(hours)
    return {"status": "ok", "message": f"Tüm 5 dakikalık tahminler {hours} saatlik veriyle güncellendi"}


@app.post("/api/seed")
def run_seed():
    """Seed verisini manuel olarak ClickHouse'a yazar (yeterli veri yoksa)."""
    inserted = seeder.seed_if_needed()
    if inserted:
        return {"status": "ok", "message": "Seed verisi eklendi, şimdi /api/predict-5min çalıştırabilirsin."}
    return {"status": "skipped", "message": "Zaten yeterli veri var, seed atlandı."}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    """Servis açılınca: seed verisi yoksa üret, ardından ilk tahmini çalıştır."""
    def init():
        seeder.seed_if_needed()
        print("[Startup] İlk tahmin çalıştırılıyor...")
        scheduled_predict()
        print("[Startup] İlk tahmin tamamlandı.")

    threading.Thread(target=init, daemon=True).start()


# Scheduler setup
def scheduled_predict():
    try:
        if config.TEST_MODE:
            predictor.run_all_5min(hours=14)
        else:
            predictor.run_all(days=7)
    except Exception as e:
        print(f"[Scheduler] Tahmin hatası: {e}")


scheduler = BackgroundScheduler()
if config.TEST_MODE:
    scheduler.add_job(func=scheduled_predict, trigger="interval", minutes=5)
    print("[Scheduler] TEST_MODE: her 5 dakikada bir tahmin (5 dakikalık granülasyon)")
else:
    scheduler.add_job(func=scheduled_predict, trigger="interval", hours=1)
    print("[Scheduler] PROD MODE: her 1 saatte bir tahmin (saatlik granülasyon)")
scheduler.start()

# Uygulama kapanınca scheduler'ı durdur
atexit.register(lambda: scheduler.shutdown())


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=config.API_PORT, reload=True)
