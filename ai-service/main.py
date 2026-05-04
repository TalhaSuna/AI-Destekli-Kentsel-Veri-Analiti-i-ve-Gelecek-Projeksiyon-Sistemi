import time
import threading

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

import config
import db
import predictor
import seed_data

app = FastAPI(title="Kentsel Veri AI Servisi")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hourly/{channel}")
def get_hourly(channel: str, days: int = 7):
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
    df = db.fetch_predictions(channel)
    if df.empty:
        return {"channel": channel, "count": 0, "data": []}

    df["hour"]       = df["hour"].astype(str)
    df["created_at"] = df["created_at"].astype(str)
    return {"channel": channel, "count": len(df), "data": df.to_dict(orient="records")}


@app.post("/api/predict")
def run_prediction():
    predictor.run_all()
    return {"status": "ok", "message": "Tahminler güncellendi"}


@app.get("/health")
def health():
    return {"status": "ok"}


def _wait_for_clickhouse(max_attempts: int = 15, delay: int = 4):
    for attempt in range(1, max_attempts + 1):
        try:
            client = db.get_client()
            client.ping()
            client.close()
            print(f"[Startup] ClickHouse hazır ({attempt}. deneme)")
            return True
        except Exception as e:
            print(f"[Startup] ClickHouse bekleniyor ({attempt}/{max_attempts}): {e}")
            time.sleep(delay)
    print("[Startup] ClickHouse bağlantısı kurulamadı, devam ediliyor...")
    return False


@app.on_event("startup")
async def startup_event():
    def init():
        _wait_for_clickhouse()

        try:
            seed_data.seed_if_needed()
        except Exception as e:
            print(f"[Startup] Seed hatası: {e}")

        try:
            predictor.run_all()
        except Exception as e:
            print(f"[Startup] İlk tahmin hatası: {e}")

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
atexit.register(lambda: scheduler.shutdown())

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=config.API_PORT, reload=False)
