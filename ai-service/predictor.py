import datetime
import logging
import pandas as pd
from prophet import Prophet
import db

logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

PERIODS = 168
FREQ    = "5min"


def _fit_and_predict(df: pd.DataFrame, ds_col: str, y_col: str, periods: int = PERIODS) -> pd.DataFrame:
    prophet_df = df[[ds_col, y_col]].rename(columns={ds_col: "ds", y_col: "y"})
    prophet_df["ds"] = pd.to_datetime(prophet_df["ds"]).dt.tz_localize(None)
    prophet_df["y"]  = prophet_df["y"].astype(float)
    prophet_df = prophet_df.dropna()

    if len(prophet_df) < 12:
        return pd.DataFrame()

    has_weekly = len(prophet_df) >= 48

    model = Prophet(
        daily_seasonality=True,
        weekly_seasonality=has_weekly,
        changepoint_prior_scale=0.05,
        uncertainty_samples=500,
    )
    model.fit(prophet_df)

    last     = pd.Timestamp(model.history["ds"].max()).replace(tzinfo=None)
    now_5min = pd.Timestamp(datetime.datetime.utcnow()).floor(FREQ)
    gap      = max(0, int((now_5min - last).total_seconds() / 300))

    future   = model.make_future_dataframe(periods=gap + periods + 1, freq=FREQ)
    forecast = model.predict(future)

    return (
        forecast[forecast["ds"] >= now_5min]
        [["ds", "yhat", "yhat_lower", "yhat_upper"]]
        .head(periods)
    )


def run_density_prediction():
    df = db.fetch_hourly_density(days=7)
    if df.empty or len(df) < 12:
        print(f"[Prophet] Yetersiz density verisi: {len(df)} slot")
        return

    for metric in ["avg_vehicles", "avg_speed"]:
        try:
            forecast = _fit_and_predict(df, "hour", metric)
            if forecast.empty:
                print(f"[Prophet] density/{metric} → boş tahmin, atlandı")
                continue
            db.save_predictions(forecast, channel="density", metric=metric)
            print(f"[Prophet] density/{metric} → {len(forecast)} nokta kaydedildi")
        except Exception as e:
            print(f"[Prophet] density/{metric} → hata: {e}")


def run_traffic_prediction():
    df = db.fetch_hourly_traffic(days=7)
    if df.empty or len(df) < 12:
        print(f"[Prophet] Yetersiz traffic verisi: {len(df)} slot")
        return

    for metric in ["malfunction_count", "red_count"]:
        try:
            forecast = _fit_and_predict(df, "hour", metric)
            if forecast.empty:
                print(f"[Prophet] traffic/{metric} → boş tahmin, atlandı")
                continue
            db.save_predictions(forecast, channel="traffic", metric=metric)
            print(f"[Prophet] traffic/{metric} → {len(forecast)} nokta kaydedildi")
        except Exception as e:
            print(f"[Prophet] traffic/{metric} → hata: {e}")


def run_speed_prediction():
    df = db.fetch_hourly_speed(days=7)
    if df.empty or len(df) < 12:
        print(f"[Prophet] Yetersiz speed verisi: {len(df)} slot")
        return

    for metric in ["violation_count", "avg_excess"]:
        try:
            forecast = _fit_and_predict(df, "hour", metric)
            if forecast.empty:
                print(f"[Prophet] speed/{metric} → boş tahmin, atlandı")
                continue
            db.save_predictions(forecast, channel="speed", metric=metric)
            print(f"[Prophet] speed/{metric} → {len(forecast)} nokta kaydedildi")
        except Exception as e:
            print(f"[Prophet] speed/{metric} → hata: {e}")


def run_all():
    print("[Prophet] Tahmin başlatılıyor: 7 gün geçmiş → 14 saat / 5dk aralıklı...")
    run_density_prediction()
    run_traffic_prediction()
    run_speed_prediction()
    print("[Prophet] Tamamlandı.")
