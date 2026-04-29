import datetime
import pandas as pd
from prophet import Prophet
import db

# 14 saat × 12 adet 5-dakikalık dilim = 168 tahmin noktası
PERIODS = 168
FREQ    = "5min"


def _fit_and_predict(df: pd.DataFrame, ds_col: str, y_col: str, periods: int = PERIODS) -> pd.DataFrame:
    """
    Saatlik geçmiş veriyle Prophet eğitir, şu andan itibaren
    5-dakikalık aralıklarla 14 saatlik (168 nokta) tahmin döndürür.
    """
    prophet_df = df[[ds_col, y_col]].rename(columns={ds_col: "ds", y_col: "y"})
    prophet_df["y"] = prophet_df["y"].astype(float)

    model = Prophet(daily_seasonality=True, weekly_seasonality=True)
    model.fit(prophet_df)

    # Timezone-naive UTC referans noktaları
    last     = pd.Timestamp(model.history["ds"].max()).replace(tzinfo=None)
    now_5min = pd.Timestamp(datetime.datetime.utcnow()).floor(FREQ)

    # Son eğitim noktasından şu ana kadar kaç 5-dakikalık adım geçti?
    gap = max(0, int((now_5min - last).total_seconds() / 300))

    # Geçmişi + boşluğu + istenen period sayısını kapsayan 5-dakikalık dataframe
    future   = model.make_future_dataframe(periods=gap + periods + 1, freq=FREQ)
    forecast = model.predict(future)

    # Şu andan itibaren 168 nokta (= 14 saat) döndür
    return (
        forecast[forecast["ds"] >= now_5min]
        [["ds", "yhat", "yhat_lower", "yhat_upper"]]
        .head(periods)
    )


def run_density_prediction():
    df = db.fetch_hourly_density(days=7)
    if df.empty or len(df) < 24:
        print(f"[Prophet] Yetersiz density verisi: {len(df)} saatlik slot")
        return

    for metric in ["avg_vehicles", "avg_speed"]:
        forecast = _fit_and_predict(df, "hour", metric)
        db.save_predictions(forecast, channel="density", metric=metric)
        print(f"[Prophet] density/{metric} → {len(forecast)} adet 5-dakikalık tahmin kaydedildi")


def run_traffic_prediction():
    df = db.fetch_hourly_traffic(days=7)
    if df.empty or len(df) < 24:
        print(f"[Prophet] Yetersiz traffic verisi: {len(df)} saatlik slot")
        return

    for metric in ["malfunction_count", "red_count"]:
        forecast = _fit_and_predict(df, "hour", metric)
        db.save_predictions(forecast, channel="traffic", metric=metric)
        print(f"[Prophet] traffic/{metric} → {len(forecast)} adet 5-dakikalık tahmin kaydedildi")


def run_speed_prediction():
    df = db.fetch_hourly_speed(days=7)
    if df.empty or len(df) < 24:
        print(f"[Prophet] Yetersiz speed verisi: {len(df)} saatlik slot")
        return

    for metric in ["violation_count", "avg_excess"]:
        forecast = _fit_and_predict(df, "hour", metric)
        db.save_predictions(forecast, channel="speed", metric=metric)
        print(f"[Prophet] speed/{metric} → {len(forecast)} adet 5-dakikalık tahmin kaydedildi")


def run_all():
    print("[Prophet] Tahmin başlatılıyor: 7 gün geçmiş → 14 saat / 5dk aralıklı (168 nokta)...")
    run_density_prediction()
    run_traffic_prediction()
    run_speed_prediction()
    print("[Prophet] Tamamlandı.")
