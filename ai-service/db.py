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
    """Son N günün saatlik yoğunluk özetini çeker."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfHour(_timestamp) AS hour,
            avg(vehicle_count) AS avg_vehicles,
            avg(pedestrian_count) AS avg_pedestrians,
            avg(avg_speed) AS avg_speed,
            sum(bus) AS total_bus,
            sum(car) AS total_car,
            sum(bike) AS total_bike
        FROM density
        WHERE _timestamp >= now() - INTERVAL {days} DAY
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    return df


def fetch_hourly_traffic(days: int = 7) -> pd.DataFrame:
    """Son N günün saatlik trafik ışığı özetini çeker."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfHour(_timestamp) AS hour,
            count() AS total_signals,
            countIf(status = 'red') AS red_count,
            countIf(status = 'green') AS green_count,
            countIf(status = 'yellow') AS yellow_count,
            countIf(is_malfunctioning = 1) AS malfunction_count
        FROM traffic_lights
        WHERE _timestamp >= now() - INTERVAL {days} DAY
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    return df


def fetch_hourly_speed(days: int = 7) -> pd.DataFrame:
    """Son N günün saatlik hız ihlali özetini çeker."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfHour(_timestamp) AS hour,
            count() AS violation_count,
            avg(speed) AS avg_speed,
            avg(limit_val) AS avg_limit,
            avg(speed - limit_val) AS avg_excess
        FROM speed_violations
        WHERE _timestamp >= now() - INTERVAL {days} DAY
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    return df


def save_predictions(df: pd.DataFrame, channel: str, metric: str):
    """Prophet tahmin sonuçlarını predictions tablosuna yazar."""
    client = get_client()
    rows = []
    for _, row in df.iterrows():
        rows.append([
            channel,
            metric,
            row["ds"].to_pydatetime(),
            float(row["yhat"]),
            float(row["yhat_lower"]),
            float(row["yhat_upper"]),
        ])

    client.insert(
        "predictions",
        rows,
        column_names=["channel", "metric", "hour", "predicted", "lower_bound", "upper_bound"],
    )
    client.close()


def fetch_predictions(channel: str = None) -> pd.DataFrame:
    """Predictions tablosundan tahminleri çeker."""
    client = get_client()
    if channel:
        query = """
            SELECT channel, metric, hour, predicted, lower_bound, upper_bound, created_at
            FROM predictions
            WHERE channel = {channel:String}
            ORDER BY channel, metric, hour
        """
        result = client.query(query, parameters={"channel": channel})
    else:
        query = """
            SELECT channel, metric, hour, predicted, lower_bound, upper_bound, created_at
            FROM predictions
            ORDER BY channel, metric, hour
        """
        result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    return df


def fetch_5min_density(hours: int = 14) -> pd.DataFrame:
    """Son N saatin 5 dakikalık yoğunluk özetini çeker."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfFiveMinutes(_timestamp) AS hour,
            avg(vehicle_count) AS avg_vehicles,
            avg(pedestrian_count) AS avg_pedestrians,
            avg(avg_speed) AS avg_speed,
            sum(bus) AS total_bus,
            sum(car) AS total_car,
            sum(bike) AS total_bike
        FROM density
        WHERE _timestamp >= now() - INTERVAL {hours} HOUR
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    return df


def fetch_5min_traffic(hours: int = 14) -> pd.DataFrame:
    """Son N saatin 5 dakikalık trafik ışığı özetini çeker."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfFiveMinutes(_timestamp) AS hour,
            count() AS total_signals,
            countIf(status = 'red') AS red_count,
            countIf(status = 'green') AS green_count,
            countIf(status = 'yellow') AS yellow_count,
            countIf(is_malfunctioning = 1) AS malfunction_count
        FROM traffic_lights
        WHERE _timestamp >= now() - INTERVAL {hours} HOUR
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    return df


def fetch_5min_speed(hours: int = 14) -> pd.DataFrame:
    """Son N saatin 5 dakikalık hız ihlali özetini çeker."""
    client = get_client()
    query = f"""
        SELECT
            toStartOfFiveMinutes(_timestamp) AS hour,
            count() AS violation_count,
            avg(speed) AS avg_speed,
            avg(limit_val) AS avg_limit,
            avg(speed - limit_val) AS avg_excess
        FROM speed_violations
        WHERE _timestamp >= now() - INTERVAL {hours} HOUR
        GROUP BY hour
        ORDER BY hour
    """
    result = client.query(query)
    df = pd.DataFrame(result.result_rows, columns=result.column_names)
    client.close()
    return df
