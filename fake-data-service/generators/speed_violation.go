package generators

import (
	"fmt"
	"math/rand"

	"fake-data-service/models"
)

var directions = []string{
	"North", "South", "East", "West",
	"North-East", "North-West", "South-East", "South-West",
}

var plateCities = []string{
	"01", "06", "07", "16", "34", "35", "41", "42", "55", "61",
}

func GenerateSpeedViolation() models.SpeedViolation {
	limit := 30 + rand.Intn(7)*10 // 30, 40, 50, 60, 70, 80, 90
	speed := limit + rand.Intn(60) + 1

	cityCode := plateCities[rand.Intn(len(plateCities))]
	letters := string(rune('A'+rand.Intn(26))) + string(rune('A'+rand.Intn(26)))
	number := rand.Intn(900) + 100

	return models.SpeedViolation{
		VehicleID: fmt.Sprintf("%s-%s-%03d", cityCode, letters, number),
		Speed:     speed,
		Limit:     limit,
		LaneID:    rand.Intn(4) + 1,
		Direction: directions[rand.Intn(len(directions))],
		Location: models.Location{
			Lat: 37.850 + rand.Float64()*0.05,
			Lng: 32.470 + rand.Float64()*0.05,
		},
	}
}
