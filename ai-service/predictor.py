import pandas as pd
from prophet import Prophet
import db


def run_density_prediction(days: int = 7):
    """Yoğunluk verisiyle Prophet tahmini yapar."""
    df = db.fetch_hourly_density(days)
    if df.empty or len(df) < 24:
        print(f"[Prophet] Yetersiz density verisi: {len(df)} satır")
        return None

    # avg_vehicles tahmini
    prophet_df = df[["hour", "avg_vehicles"]].rename(columns={"hour": "ds", "avg_vehicles": "y"})
    model = Prophet(daily_seasonality=True, weekly_seasonality=True)
    model.fit(prophet_df)

    future = model.make_future_dataframe(periods=168, freq="h")  # 7 gün
    forecast = future_forecast(model, future)

    db.save_predictions(forecast, channel="density", metric="avg_vehicles")
    print(f"[Prophet] density/avg_vehicles → {len(forecast)} tahmin kaydedildi")

    # avg_speed tahmini
    prophet_df = df[["hour", "avg_speed"]].rename(columns={"hour": "ds", "avg_speed": "y"})
    model = Prophet(daily_seasonality=True, weekly_seasonality=True)
    model.fit(prophet_df)

    future = model.make_future_dataframe(periods=168, freq="h")
    forecast = future_forecast(model, future)

    db.save_predictions(forecast, channel="density", metric="avg_speed")
    print(f"[Prophet] density/avg_speed → {len(forecast)} tahmin kaydedildi")


def run_traffic_prediction(days: int = 7):
    """Trafik ışığı verisiyle Prophet tahmini yapar."""
    df = db.fetch_hourly_traffic(days)
    if df.empty or len(df) < 24:
        print(f"[Prophet] Yetersiz traffic verisi: {len(df)} satır")
        return None

    # malfunction_count tahmini
    prophet_df = df[["hour", "malfunction_count"]].rename(columns={"hour": "ds", "malfunction_count": "y"})
    prophet_df["y"] = prophet_df["y"].astype(float)
    model = Prophet(daily_seasonality=True, weekly_seasonality=True)
    model.fit(prophet_df)

    future = model.make_future_dataframe(periods=168, freq="h")
    forecast = future_forecast(model, future)

    db.save_predictions(forecast, channel="traffic", metric="malfunction_count")
    print(f"[Prophet] traffic/malfunction_count → {len(forecast)} tahmin kaydedildi")

    # red_count tahmini
    prophet_df = df[["hour", "red_count"]].rename(columns={"hour": "ds", "red_count": "y"})
    prophet_df["y"] = prophet_df["y"].astype(float)
    model = Prophet(daily_seasonality=True, weekly_seasonality=True)
    model.fit(prophet_df)

    future = model.make_future_dataframe(periods=168, freq="h")
    forecast = future_forecast(model, future)

    db.save_predictions(forecast, channel="traffic", metric="red_count")
    print(f"[Prophet] traffic/red_count → {len(forecast)} tahmin kaydedildi")


def run_speed_prediction(days: int = 7):
    """Hız ihlali verisiyle Prophet tahmini yapar."""
    df = db.fetch_hourly_speed(days)
    if df.empty or len(df) < 24:
        print(f"[Prophet] Yetersiz speed verisi: {len(df)} satır")
        return None

    # violation_count tahmini
    prophet_df = df[["hour", "violation_count"]].rename(columns={"hour": "ds", "violation_count": "y"})
    prophet_df["y"] = prophet_df["y"].astype(float)
    model = Prophet(daily_seasonality=True, weekly_seasonality=True)
    model.fit(prophet_df)

    future = model.make_future_dataframe(periods=168, freq="h")
    forecast = future_forecast(model, future)

    db.save_predictions(forecast, channel="speed", metric="violation_count")
    print(f"[Prophet] speed/violation_count → {len(forecast)} tahmin kaydedildi")

    # avg_excess tahmini
    prophet_df = df[["hour", "avg_excess"]].rename(columns={"hour": "ds", "avg_excess": "y"})
    model = Prophet(daily_seasonality=True, weekly_seasonality=True)
    model.fit(prophet_df)

    future = model.make_future_dataframe(periods=168, freq="h")
    forecast = future_forecast(model, future)

    db.save_predictions(forecast, channel="speed", metric="avg_excess")
    print(f"[Prophet] speed/avg_excess → {len(forecast)} tahmin kaydedildi")


def run_all(days: int = 7):
    """Tüm kanallar için tahmin yapar."""
    print(f"[Prophet] Tüm kanallar için tahmin başlatılıyor (son {days} gün)...")
    run_density_prediction(days)
    run_traffic_prediction(days)
    run_speed_prediction(days)
    print("[Prophet] Tüm tahminler tamamlandı.")


def future_forecast(model: Prophet, future: pd.DataFrame) -> pd.DataFrame:
    """Sadece gelecek tahminleri döndürür (geçmiş verileri hariç tutar)."""
    forecast = model.predict(future)
    # Sadece gelecek olan kısımları al
    last_historical = model.history["ds"].max()
    future_only = forecast[forecast["ds"] > last_historical][["ds", "yhat", "yhat_lower", "yhat_upper"]]
    return future_only
