import random
import math
import datetime
import db
import config


ZONE_IDS = ["zone_A", "zone_B", "zone_C"]
LAMP_IDS = [f"lamp_{i}" for i in range(1, 6)]
STATUSES = ["red", "green", "yellow"]
DIRECTIONS = ["N", "S", "E", "W"]

LAT_BASE, LNG_BASE = 41.015, 28.979  # İstanbul


def _rush_factor(hour: int) -> float:
    """Sabah 8 ve akşam 18'de yoğunluk zirvesi."""
    morning = math.exp(-0.5 * ((hour - 8) / 1.5) ** 2)
    evening = math.exp(-0.5 * ((hour - 18) / 1.5) ** 2)
    return 0.25 + 0.75 * max(morning, evening)


def _has_enough_data(min_slots: int = 24) -> bool:
    """
    Prophet'in gördüğü şeyi sayar: kaç adet benzersiz zaman dilimi var.
    Ham satır sayısı değil — birden fazla zone/lamp aynı slota düşer.
    """
    client = db.get_client()
    try:
        interval = "14 HOUR" if config.TEST_MODE else "7 DAY"
        granularity = "toStartOfFiveMinutes" if config.TEST_MODE else "toStartOfHour"
        r = client.query(f"""
            SELECT count() FROM (
                SELECT {granularity}(_timestamp) AS slot
                FROM density
                WHERE _timestamp >= now() - INTERVAL {interval}
                GROUP BY slot
            )
        """)
        slots = r.result_rows[0][0]
        print(f"[Seeder] Mevcut zaman dilimi sayısı: {slots} (minimum: {min_slots})")
        return slots >= min_slots
    finally:
        client.close()


def _generate_and_insert(start: datetime.datetime, end: datetime.datetime, interval_min: int):
    density_rows = []
    traffic_rows = []
    speed_rows = []

    current = start
    while current < end:
        factor = _rush_factor(current.hour)

        for zone_id in ZONE_IDS:
            vc = max(0, int(random.gauss(120 * factor, 15)))
            pc = max(0, int(random.gauss(60 * factor, 10)))
            spd = max(10.0, random.gauss(55 - 25 * factor, 5))
            bus = max(0, int(vc * 0.10))
            car = max(0, int(vc * 0.75))
            bike = max(0, vc - bus - car)
            density_rows.append([
                zone_id, vc, pc, spd, bus, car, bike,
                LAT_BASE + random.uniform(-0.05, 0.05),
                LNG_BASE + random.uniform(-0.05, 0.05),
                current.strftime("%Y-%m-%dT%H:%M:%S"),
                current,
            ])

        for lamp_id in LAMP_IDS:
            status = random.choices(STATUSES, weights=[0.4, 0.4, 0.2])[0]
            traffic_rows.append([
                lamp_id, status,
                random.randint(5, 60),
                1 if random.random() < 0.05 else 0,
                f"intersection_{random.randint(1, 3)}",
                LAT_BASE + random.uniform(-0.05, 0.05),
                LNG_BASE + random.uniform(-0.05, 0.05),
                current,
            ])

        n_violations = max(0, int(random.gauss(12 * factor, 3)))
        for _ in range(n_violations):
            limit = random.choice([50, 70, 90])
            speed_rows.append([
                f"vehicle_{random.randint(1000, 9999)}",
                limit + random.randint(5, 40),
                limit,
                random.randint(1, 4),
                random.choice(DIRECTIONS),
                LAT_BASE + random.uniform(-0.05, 0.05),
                LNG_BASE + random.uniform(-0.05, 0.05),
                current,
            ])

        current += datetime.timedelta(minutes=interval_min)

    client = db.get_client()
    try:
        client.insert("density", density_rows, column_names=[
            "zone_id", "vehicle_count", "pedestrian_count", "avg_speed",
            "bus", "car", "bike", "lat", "lng", "timestamp", "_timestamp",
        ])
        print(f"[Seeder] {len(density_rows)} density satırı eklendi")

        client.insert("traffic_lights", traffic_rows, column_names=[
            "lamp_id", "status", "timing_remains", "is_malfunctioning",
            "intersection_id", "lat", "lng", "_timestamp",
        ])
        print(f"[Seeder] {len(traffic_rows)} traffic_lights satırı eklendi")

        client.insert("speed_violations", speed_rows, column_names=[
            "vehicle_id", "speed", "limit_val", "lane_id",
            "direction", "lat", "lng", "_timestamp",
        ])
        print(f"[Seeder] {len(speed_rows)} speed_violations satırı eklendi")
    finally:
        client.close()


def seed_if_needed():
    """
    Yeterli geçmiş veri yoksa seed verisi üretip ClickHouse'a yazar.
    TEST_MODE: son 14 saatlik 5 dakikalık veri
    PROD MODE: son 7 günlük saatlik veri
    """
    if _has_enough_data():
        print("[Seeder] Yeterli veri mevcut, seed atlanıyor.")
        return False

    print("[Seeder] Yetersiz veri — seed başlatılıyor...")
    now = datetime.datetime.utcnow()

    if config.TEST_MODE:
        start = now - datetime.timedelta(hours=14)
        interval_min = 5
    else:
        start = now - datetime.timedelta(days=7)
        interval_min = 60

    _generate_and_insert(start, now, interval_min)
    print("[Seeder] Seed tamamlandı.")
    return True
