"""
7 günlük sahte saatlik veri üretir ve ClickHouse'a yükler.
Gerçekçi paternler: sabah/akşam pik, gece düşük, hafta sonu farklı.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import db


def generate_hourly_pattern(base: float, peak_hours: list, peak_factor: float = 1.5):
    """24 saatlik patern üretir."""
    hours = np.arange(24)
    values = np.full(24, base)
    for h in peak_hours:
        values[h] = base * peak_factor
    # Gece saatleri düşür
    for h in [0, 1, 2, 3, 4, 5]:
        values[h] = base * 0.3
    # Geçişleri yumuşat
    for i in range(1, 23):
        values[i] = (values[i - 1] + values[i] + values[i + 1]) / 3
    return values


def generate_seed_data():
    """7 günlük seed data üretir."""
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = now - timedelta(days=7)

    hours = []
    current = start
    while current < now:
        hours.append(current)
        current += timedelta(hours=1)

    n = len(hours)
    np.random.seed(42)

    # --- DENSITY ---
    density_rows = []
    for i, h in enumerate(hours):
        hour_of_day = h.hour
        is_weekend = h.weekday() >= 5
        base_vehicles = 20 if is_weekend else 35
        # Sabah 8-9, akşam 17-18 pik
        if hour_of_day in [8, 9]:
            vehicles = base_vehicles * 1.6
        elif hour_of_day in [17, 18]:
            vehicles = base_vehicles * 1.5
        elif hour_of_day in [0, 1, 2, 3, 4, 5]:
            vehicles = base_vehicles * 0.2
        else:
            vehicles = base_vehicles * 0.8

        vehicles += np.random.normal(0, 3)
        speed = max(15, 60 - vehicles * 0.5 + np.random.normal(0, 3))

        density_rows.append([
            h,
            round(max(0, vehicles), 1),
            round(max(0, vehicles * 0.3 + np.random.normal(0, 2)), 1),
            round(speed, 1),
            int(max(0, vehicles * 0.1 + np.random.normal(0, 1))),
            int(max(0, vehicles * 0.7 + np.random.normal(0, 2))),
            int(max(0, vehicles * 0.2 + np.random.normal(0, 1))),
        ])

    client = db.get_client()
    client.insert("hourly_density", density_rows,
                  column_names=["hour", "avg_vehicles", "avg_pedestrians", "avg_speed",
                                "total_bus", "total_car", "total_bike"])
    print(f"[Seed] hourly_density → {len(density_rows)} satır yüklendi")

    # --- TRAFFIC ---
    traffic_rows = []
    for i, h in enumerate(hours):
        hour_of_day = h.hour
        is_weekend = h.weekday() >= 5
        base_signals = 500 if is_weekend else 800

        if hour_of_day in [0, 1, 2, 3, 4, 5]:
            signals = base_signals * 0.3
        elif hour_of_day in [8, 9, 17, 18]:
            signals = base_signals * 1.2
        else:
            signals = base_signals * 0.8

        signals += np.random.normal(0, 20)
        red = int(signals * 0.4 + np.random.normal(0, 10))
        green = int(signals * 0.45 + np.random.normal(0, 10))
        yellow = int(signals * 0.15 + np.random.normal(0, 5))
        malfunction = int(max(0, 2 + np.random.poisson(1)))

        traffic_rows.append([
            h,
            int(max(0, signals)),
            max(0, red),
            max(0, green),
            max(0, yellow),
            malfunction,
        ])

    client.insert("hourly_traffic", traffic_rows,
                  column_names=["hour", "total_signals", "red_count", "green_count",
                                "yellow_count", "malfunction_count"])
    print(f"[Seed] hourly_traffic → {len(traffic_rows)} satır yüklendi")

    # --- SPEED VIOLATIONS ---
    speed_rows = []
    for i, h in enumerate(hours):
        hour_of_day = h.hour
        is_weekend = h.weekday() >= 5
        base_violations = 8 if is_weekend else 15

        if hour_of_day in [0, 1, 2, 3, 4]:
            violations = base_violations * 0.5  # gece az trafik ama hız fazla
        elif hour_of_day in [8, 9, 17, 18]:
            violations = base_violations * 1.3
        elif hour_of_day in [22, 23]:
            violations = base_violations * 1.5  # gece hız artar
        else:
            violations = base_violations * 0.7

        violations += np.random.normal(0, 2)
        avg_speed = 85 + np.random.normal(0, 5)
        avg_limit = 50
        avg_excess = avg_speed - avg_limit + np.random.normal(0, 3)

        speed_rows.append([
            h,
            int(max(0, violations)),
            round(avg_speed, 1),
            round(avg_limit, 1),
            round(max(0, avg_excess), 1),
        ])

    client.insert("hourly_speed", speed_rows,
                  column_names=["hour", "violation_count", "avg_speed", "avg_limit", "avg_excess"])
    print(f"[Seed] hourly_speed → {len(speed_rows)} satır yüklendi")

    client.close()
    print(f"[Seed] Toplam {n} saatlik veri 3 tabloya yüklendi.")


if __name__ == "__main__":
    generate_seed_data()
