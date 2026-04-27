-- ============================================
-- Veritabanı oluştur
-- ============================================
CREATE DATABASE IF NOT EXISTS telemetry;

-- ============================================
-- 1. Ana tablolar (MergeTree) - Kalıcı depolama
-- ============================================

CREATE TABLE IF NOT EXISTS telemetry.traffic_lights (
    lamp_id String,
    status String,
    timing_remains Int32,
    is_malfunctioning UInt8,
    intersection_id String,
    lat Float64,
    lng Float64,
    _timestamp DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (_timestamp, lamp_id);

CREATE TABLE IF NOT EXISTS telemetry.density (
    zone_id String,
    vehicle_count Int32,
    pedestrian_count Int32,
    avg_speed Float64,
    bus Int32,
    car Int32,
    bike Int32,
    lat Float64,
    lng Float64,
    timestamp String,
    _timestamp DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (_timestamp, zone_id);

CREATE TABLE IF NOT EXISTS telemetry.speed_violations (
    vehicle_id String,
    speed Int32,
    limit_val Int32,
    lane_id Int32,
    direction String,
    lat Float64,
    lng Float64,
    _timestamp DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (_timestamp, vehicle_id);

-- ============================================
-- 2. Kafka tabloları (Kafka Engine) - Her satır ham JSON string
-- ============================================

CREATE TABLE IF NOT EXISTS telemetry.kafka_traffic_lights (
    raw String
) ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:19092',
    kafka_topic_list = 'telemetry.traffic_lights',
    kafka_group_name = 'clickhouse_traffic',
    kafka_format = 'JSONAsString';

CREATE TABLE IF NOT EXISTS telemetry.kafka_density (
    raw String
) ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:19092',
    kafka_topic_list = 'telemetry.density',
    kafka_group_name = 'clickhouse_density',
    kafka_format = 'JSONAsString';

CREATE TABLE IF NOT EXISTS telemetry.kafka_speed_violations (
    raw String
) ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:19092',
    kafka_topic_list = 'telemetry.speed_violations',
    kafka_group_name = 'clickhouse_speed',
    kafka_format = 'JSONAsString';

-- ============================================
-- 3. Materialized View'lar - JSON parse edip MergeTree'ye yaz
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry.mv_traffic_lights
TO telemetry.traffic_lights AS
SELECT
    JSONExtractString(raw, 'lamp_id') AS lamp_id,
    JSONExtractString(raw, 'status') AS status,
    JSONExtractInt(raw, 'timing_remains') AS timing_remains,
    JSONExtractBool(raw, 'is_malfunctioning') AS is_malfunctioning,
    JSONExtractString(raw, 'intersection_id') AS intersection_id,
    JSONExtractFloat(raw, 'location', 'lat') AS lat,
    JSONExtractFloat(raw, 'location', 'lng') AS lng
FROM telemetry.kafka_traffic_lights;

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry.mv_density
TO telemetry.density AS
SELECT
    JSONExtractString(raw, 'zone_id') AS zone_id,
    JSONExtractInt(raw, 'vehicle_count') AS vehicle_count,
    JSONExtractInt(raw, 'pedestrian_count') AS pedestrian_count,
    JSONExtractFloat(raw, 'avg_speed') AS avg_speed,
    JSONExtractInt(raw, 'vehicle_types', 'bus') AS bus,
    JSONExtractInt(raw, 'vehicle_types', 'car') AS car,
    JSONExtractInt(raw, 'vehicle_types', 'bike') AS bike,
    JSONExtractFloat(raw, 'location', 'lat') AS lat,
    JSONExtractFloat(raw, 'location', 'lng') AS lng,
    JSONExtractString(raw, 'timestamp') AS timestamp
FROM telemetry.kafka_density;

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry.mv_speed_violations
TO telemetry.speed_violations AS
SELECT
    JSONExtractString(raw, 'vehicle_id') AS vehicle_id,
    JSONExtractInt(raw, 'speed') AS speed,
    JSONExtractInt(raw, 'limit') AS limit_val,
    JSONExtractInt(raw, 'lane_id') AS lane_id,
    JSONExtractString(raw, 'direction') AS direction,
    JSONExtractFloat(raw, 'location', 'lat') AS lat,
    JSONExtractFloat(raw, 'location', 'lng') AS lng
FROM telemetry.kafka_speed_violations;

-- ============================================
-- 4. Saatlik özet tabloları (AI modülü için)
-- ============================================

CREATE TABLE IF NOT EXISTS telemetry.hourly_density (
    hour DateTime,
    avg_vehicles Float64,
    avg_pedestrians Float64,
    avg_speed Float64,
    total_bus Int64,
    total_car Int64,
    total_bike Int64
) ENGINE = ReplacingMergeTree()
ORDER BY hour;

CREATE TABLE IF NOT EXISTS telemetry.hourly_traffic (
    hour DateTime,
    total_signals Int64,
    red_count Int64,
    green_count Int64,
    yellow_count Int64,
    malfunction_count Int64
) ENGINE = ReplacingMergeTree()
ORDER BY hour;

CREATE TABLE IF NOT EXISTS telemetry.hourly_speed (
    hour DateTime,
    violation_count Int64,
    avg_speed Float64,
    avg_limit Float64,
    avg_excess Float64
) ENGINE = ReplacingMergeTree()
ORDER BY hour;

-- ============================================
-- 5. Prophet tahmin tablosu
-- ============================================

CREATE TABLE IF NOT EXISTS telemetry.predictions (
    channel String,
    metric String,
    hour DateTime,
    predicted Float64,
    lower_bound Float64,
    upper_bound Float64,
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree()
ORDER BY (channel, metric, hour);
