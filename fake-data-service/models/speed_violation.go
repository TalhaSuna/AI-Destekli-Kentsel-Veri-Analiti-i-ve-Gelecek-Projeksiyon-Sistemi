package models

type SpeedViolation struct {
	VehicleID string   `json:"vehicle_id"`
	Speed     int      `json:"speed"`
	Limit     int      `json:"limit"`
	LaneID    int      `json:"lane_id"`
	Direction string   `json:"direction"`
	Location  Location `json:"location"`
}
