package models

type VehicleTypes struct {
	Bus  int `json:"bus"`
	Car  int `json:"car"`
	Bike int `json:"bike"`
}

type Density struct {
	ZoneID          string       `json:"zone_id"`
	VehicleCount    int          `json:"vehicle_count"`
	PedestrianCount int          `json:"pedestrian_count"`
	AvgSpeed        float64      `json:"avg_speed"`
	VehicleTypes    VehicleTypes `json:"vehicle_types"`
	Location        Location     `json:"location"`
	Timestamp       string       `json:"timestamp"`
}
