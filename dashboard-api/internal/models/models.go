package models

import "time"

type TrafficLight struct {
	LampID           string    `ch:"lamp_id" json:"lamp_id"`
	Status           string    `ch:"status" json:"status"`
	TimingRemains    int32     `ch:"timing_remains" json:"timing_remains"`
	IsMalfunctioning uint8     `ch:"is_malfunctioning" json:"is_malfunctioning"`
	IntersectionID   string    `ch:"intersection_id" json:"intersection_id"`
	Lat              float64   `ch:"lat" json:"lat"`
	Lng              float64   `ch:"lng" json:"lng"`
	Timestamp        time.Time `ch:"_timestamp" json:"_timestamp"`
}

type Density struct {
	ZoneID          string    `ch:"zone_id" json:"zone_id"`
	VehicleCount    int32     `ch:"vehicle_count" json:"vehicle_count"`
	PedestrianCount int32     `ch:"pedestrian_count" json:"pedestrian_count"`
	AvgSpeed        float64   `ch:"avg_speed" json:"avg_speed"`
	Bus             int32     `ch:"bus" json:"bus"`
	Car             int32     `ch:"car" json:"car"`
	Bike            int32     `ch:"bike" json:"bike"`
	Lat             float64   `ch:"lat" json:"lat"`
	Lng             float64   `ch:"lng" json:"lng"`
	TimestampStr    string    `ch:"timestamp" json:"timestamp"`
	Timestamp       time.Time `ch:"_timestamp" json:"_timestamp"`
}

type SpeedViolation struct {
	VehicleID string    `ch:"vehicle_id" json:"vehicle_id"`
	Speed     int32     `ch:"speed" json:"speed"`
	LimitVal  int32     `ch:"limit_val" json:"limit_val"`
	LaneID    int32     `ch:"lane_id" json:"lane_id"`
	Direction string    `ch:"direction" json:"direction"`
	Lat       float64   `ch:"lat" json:"lat"`
	Lng       float64   `ch:"lng" json:"lng"`
	Timestamp time.Time `ch:"_timestamp" json:"_timestamp"`
}

// Analytics modelleri — saatlik aggregate, frontend istatistik sayfası için

type TrafficAnalytics struct {
	Hour             time.Time `ch:"hour" json:"hour"`
	MalfunctionCount uint64    `ch:"malfunction_count" json:"malfunction_count"`
	RedCount         uint64    `ch:"red_count" json:"red_count"`
	GreenCount       uint64    `ch:"green_count" json:"green_count"`
	YellowCount      uint64    `ch:"yellow_count" json:"yellow_count"`
	TotalEvents      uint64    `ch:"total_events" json:"total_events"`
}

type DensityAnalytics struct {
	Hour        time.Time `ch:"hour" json:"hour"`
	AvgVehicles float64   `ch:"avg_vehicles" json:"avg_vehicles"`
	AvgSpeed    float64   `ch:"avg_speed" json:"avg_speed"`
	AvgBus      float64   `ch:"avg_bus" json:"avg_bus"`
	AvgCar      float64   `ch:"avg_car" json:"avg_car"`
	AvgBike     float64   `ch:"avg_bike" json:"avg_bike"`
	MaxVehicles uint64    `ch:"max_vehicles" json:"max_vehicles"`
}

type SpeedAnalytics struct {
	Hour           time.Time `ch:"hour" json:"hour"`
	ViolationCount uint64    `ch:"violation_count" json:"violation_count"`
	AvgExcess      float64   `ch:"avg_excess" json:"avg_excess"`
	MaxExcess      float64   `ch:"max_excess" json:"max_excess"`
	AvgSpeed       float64   `ch:"avg_speed" json:"avg_speed"`
}
