import random
import math
import datetime
import db

ZONE_IDS   = [
    "Zone-Karatay", "Zone-Meram", "Zone-Selcuklu", "Zone-Alaeddin",
    "Zone-Sanayi", "Zone-OSB", "Zone-Karahuyuk", "Zone-Musalla",
    "Zone-BosnaHersek", "Zone-Isiklar",
]
LAMP_IDS   = [f"TL-{i:03d}" for i in range(1, 21)]
STATUSES   = ["red", "green", "yellow"]
DIRECTIONS = ["K", "G", "D", "B", "KD", "KB", "GD", "GB"]
LAT_BASE, LNG_BASE = 37.874, 32.493   # Konya merkez

ZONE_CAPACITY = {
    "Zone-Karatay": 220, "Zone-Meram": 180, "Zone-Selcuklu": 240,
    "Zone-Alaeddin": 200, "Zone-Sanayi": 150, "Zone-OSB": 120,
    "Zone-Karahuyuk": 130, "Zone-Musalla": 100,
    "Zone-BosnaHersek": 140, "Zone-Isiklar": 110,
}


def _rush_factor(hour: int) -> float:
    morning = math.exp(-0.5 * ((hour - 8) / 1.2) ** 2)
    evening = math.exp(-0.5 * ((hour - 18) / 1.2) ** 2)
    return 0.15 + 0.85 * max(morning, evening)


def _count_hourly_slots() -> int:
    client = db.get_client()
    try:
        r = client.query("""
            SELECT count() FROM (
                SELECT toStartOfHour(_timestamp) AS slot
                FROM density
                WHERE _timestamp >= now() - INTERVAL 7 DAY
                GROUP BY slot
            )
        """)
        slots = r.result_rows[0][0]
        print(f"[Seed] Mevcut saatlik slot: {slots}")
        return slots
    finally:
        client.close()


def seed_if_needed(min_slots: int = 24):
    """
    ClickHouse'da yeterli saatlik slot yoksa 7 günlük veri üretip yazar.
    """
    if _count_hourly_slots() >= min_slots:
        print("[Seed] Yeterli veri mevcut, seed atlanıyor.")
        return False

    print("[Seed] 7 günlük saatlik veri oluşturuluyor...")
    end   = datetime.datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - datetime.timedelta(days=7)

    density_rows, traffic_rows, speed_rows = [], [], []

    current = start
    while current < end:
        factor = _rush_factor(current.hour)

        for zone_id in ZONE_IDS:
            cap  = ZONE_CAPACITY[zone_id]
            vc   = max(0, int(random.gauss(cap * factor, cap * 0.07)))
            spd  = max(5.0, random.gauss(72 - 58 * factor, 4))
            bus  = max(0, int(vc * 0.08))
            car  = max(0, int(vc * 0.80))
            bike = max(0, vc - bus - car)
            density_rows.append([
                zone_id, vc, round(spd, 1), bus, car, bike,
                LAT_BASE + random.uniform(-0.03, 0.03),
                LNG_BASE + random.uniform(-0.03, 0.03),
                current.strftime("%Y-%m-%dT%H:%M:%S"),
                current,
            ])

        red_prob = 0.25 + 0.30 * factor
        for lamp_id in LAMP_IDS:
            r = random.random()
            if r < red_prob:
                status, timing = "red", random.randint(30, 90)
            elif r < red_prob + 0.08:
                status, timing = "yellow", random.randint(3, 6)
            else:
                status, timing = "green", random.randint(20, 60)
            traffic_rows.append([
                lamp_id, status, timing,
                1 if random.random() < 0.01 else 0,
                f"INT-{lamp_id[3:]}",
                LAT_BASE + random.uniform(-0.03, 0.03),
                LNG_BASE + random.uniform(-0.03, 0.03),
                current,
            ])

        n = max(0, int(random.gauss(10 * (1.2 - factor), 3)))
        for _ in range(n):
            limit = random.choice([30, 50, 70, 90, 110])
            base_excess = random.uniform(10, 55)
            excess = max(5, int(base_excess * (1.0 - 0.70 * factor)))
            speed_rows.append([
                f"42 {chr(random.randint(65,90))}{chr(random.randint(65,90))} {random.randint(100,999)}",
                limit + excess, limit,
                random.randint(1, 4), random.choice(DIRECTIONS),
                LAT_BASE + random.uniform(-0.03, 0.03),
                LNG_BASE + random.uniform(-0.03, 0.03),
                current,
            ])

        current += datetime.timedelta(hours=1)

    client = db.get_client()
    try:
        client.insert("density", density_rows, column_names=[
            "zone_id", "vehicle_count", "avg_speed",
            "bus", "car", "bike", "lat", "lng", "timestamp", "_timestamp",
        ])
        print(f"[Seed] {len(density_rows)} density satırı eklendi")

        client.insert("traffic_lights", traffic_rows, column_names=[
            "lamp_id", "status", "timing_remains", "is_malfunctioning",
            "intersection_id", "lat", "lng", "_timestamp",
        ])
        print(f"[Seed] {len(traffic_rows)} traffic_lights satırı eklendi")

        client.insert("speed_violations", speed_rows, column_names=[
            "vehicle_id", "speed", "limit_val", "lane_id",
            "direction", "lat", "lng", "_timestamp",
        ])
        print(f"[Seed] {len(speed_rows)} speed_violations satırı eklendi")
    finally:
        client.close()

    print("[Seed] Tamamlandı.")
    return True
