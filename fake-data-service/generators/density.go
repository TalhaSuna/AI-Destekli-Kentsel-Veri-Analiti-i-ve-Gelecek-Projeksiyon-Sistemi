package generators

import (
	"fmt"
	"math/rand"
	"time"

	"fake-data-service/models"
)

var zoneIDs = []string{
	"Zone-A", "Zone-B", "Zone-C", "Zone-D", "Zone-E",
	"Zone-F", "Zone-G", "Zone-H", "Zone-I", "Zone-J",
}

func GenerateDensity() models.Density {
	busCount := rand.Intn(10)
	carCount := rand.Intn(200)
	bikeCount := rand.Intn(50)

	return models.Density{
		ZoneID:       zoneIDs[rand.Intn(len(zoneIDs))],
		VehicleCount: busCount + carCount + bikeCount,
		AvgSpeed:     10.0 + rand.Float64()*80.0,
		VehicleTypes: models.VehicleTypes{
			Bus:  busCount,
			Car:  carCount,
			Bike: bikeCount,
		},
		Location: models.Location{
			Lat: 37.850 + rand.Float64()*0.05,
			Lng: 32.470 + rand.Float64()*0.05,
		},
		Timestamp: time.Now().UTC().Format(fmt.Sprintf("%sT%sZ", "2006-01-02", "15:04:05")),
	}
}
