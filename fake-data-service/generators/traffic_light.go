package generators

import (
	"fmt"
	"math/rand"

	"fake-data-service/models"
)

var statuses = []string{"green", "yellow", "red"}
var intersectionIDs = []string{
	"INT-01", "INT-02", "INT-03", "INT-04", "INT-05",
	"INT-10", "INT-15", "INT-20", "INT-25", "INT-30",
	"INT-35", "INT-40", "INT-42", "INT-45", "INT-50",
}

func GenerateTrafficLight() models.TrafficLight {
	return models.TrafficLight{
		LampID:           fmt.Sprintf("TL-%03d", rand.Intn(500)+1),
		Status:           statuses[rand.Intn(len(statuses))],
		TimingRemains:    rand.Intn(120) + 1,
		IsMalfunctioning: rand.Float64() < 0.05,
		IntersectionID:   intersectionIDs[rand.Intn(len(intersectionIDs))],
		Location: models.Location{
			Lat: 37.850 + rand.Float64()*0.05,
			Lng: 32.470 + rand.Float64()*0.05,
		},
	}
}
