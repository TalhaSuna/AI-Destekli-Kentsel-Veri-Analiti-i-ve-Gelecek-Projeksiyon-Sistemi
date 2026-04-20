package redis

import (
	"context"
	"log"

	goredis "github.com/redis/go-redis/v9"
)

type Message struct {
	Channel string
	Payload string
}

var Channels = []string{
	"city:traffic_lights",
	"city:density",
	"city:speed_violations",
}

func Subscribe(ctx context.Context, client *goredis.Client, msgCh chan<- Message) {
	sub := client.Subscribe(ctx, Channels...)
	defer sub.Close()

	log.Printf("Redis kanallarına subscribe olundu: %v", Channels)

	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			log.Println("Subscriber durduruluyor...")
			return
		case msg, ok := <-ch:
			if !ok {
				log.Println("Redis channel kapandı")
				return
			}
			msgCh <- Message{
				Channel: msg.Channel,
				Payload: msg.Payload,
			}
		}
	}
}
