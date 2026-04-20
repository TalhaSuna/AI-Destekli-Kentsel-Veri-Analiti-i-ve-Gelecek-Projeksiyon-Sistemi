package models

type Location struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type TrafficLight struct {
	LampID           string   `json:"lamp_id"`
	Status           string   `json:"status"`
	TimingRemains    int      `json:"timing_remains"`
	IsMalfunctioning bool     `json:"is_malfunctioning"`
	IntersectionID   string   `json:"intersection_id"`
	Location         Location `json:"location"`
}
