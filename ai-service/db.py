import clickhouse_connect
import pandas as pd
import config


def get_client():
    return clickhouse_connect.get_client(
        host=config.CLICKHOUSE_HOST,
        port=config.CLICKHOUSE_PORT,
        database=config.CLICKHOUSE_DB,
        username=config.CLICKHOUSE_USER,
        password=config.CLICKHOUSE_PASSWORD,
    )


def fetch_hourly_density(days: int = 7) -> pd.DataFrame:
    """Son N günün saatlik yoğunluk özetini çeker (168 satır = 7 gün × 24 saat)."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfHour(_timestamp)    AS hour,
            avg(vehicle_count)           AS avg_vehicles,
            avg(avg_speed)               AS avg_speed
        FROM density
        WHERE _timestamp >= now() - INTERVAL {days} DAY
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    df["hour"] = pd.to_datetime(df["hour"]).dt.tz_localize(None)
    return df


def fetch_hourly_traffic(days: int = 7) -> pd.DataFrame:
    """Son N günün saatlik trafik ışığı özetini çeker."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfHour(_timestamp)       AS hour,
            countIf(is_malfunctioning = 1)  AS malfunction_count,
            countIf(status = 'red')         AS red_count
        FROM traffic_lights
        WHERE _timestamp >= now() - INTERVAL {days} DAY
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    df["hour"] = pd.to_datetime(df["hour"]).dt.tz_localize(None)
    return df


def fetch_hourly_speed(days: int = 7) -> pd.DataFrame:
    """Son N günün saatlik hız ihlali özetini çeker."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfHour(_timestamp)   AS hour,
            count()                     AS violation_count,
            avg(speed - limit_val)      AS avg_excess
        FROM speed_violations
        WHERE _timestamp >= now() - INTERVAL {days} DAY
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    df["hour"] = pd.to_datetime(df["hour"]).dt.tz_localize(None)
    return df


def save_predictions(df: pd.DataFrame, channel: str, metric: str):
    """Prophet tahmin sonuçlarını predictions tablosuna yazar."""
    client = get_client()
    rows = [
        [channel, metric, row["ds"].to_pydatetime(),
         float(row["yhat"]), float(row["yhat_lower"]), float(row["yhat_upper"])]
        for _, row in df.iterrows()
    ]
    client.insert(
        "predictions", rows,
        column_names=["channel", "metric", "hour", "predicted", "lower_bound", "upper_bound"],
    )
    client.close()


def fetch_predictions(channel: str) -> pd.DataFrame:
    """
    Predictions tablosundan gelecekteki tahminleri çeker.
    FINAL → ReplacingMergeTree tekrarlarını anlık giderir.
    hour >= now() → geçmiş dilimler gösterilmez.
    """
    client = get_client()
    result = client.query(
        """
        SELECT channel, metric, hour, predicted, lower_bound, upper_bound, created_at
        FROM predictions FINAL
        WHERE channel = {channel:String}
          AND hour >= now()
        ORDER BY metric, hour
        """,
        parameters={"channel": channel},
    )
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    return df
