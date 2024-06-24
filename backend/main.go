package main

import (
	"flag"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	// pion
)

var (
	appId     string
	appSecret string
	basePath  string
)

func main() {

	flag.StringVar(&appId, "appId", "", "Cloudflare-Calls App ID")
	flag.StringVar(&appSecret, "appSecret", "", "Cloudflare-Calls App Secret")

	flag.Parse()

	if appId == "" || appSecret == "" {
		panic("Please provide both the Cloudflare-Calls App ID and App Secret")
	}

	basePath = "https://rtc.live.cloudflare.com/v1/apps/" + appId

	router := gin.Default()

	router.Use(cors.Default())

	// api.POST("/:room/message", postMessage)
	// api.GET("/:room/messages", getMessages)

	router.POST("/newSession", newSession)
	router.POST("/newTrack", newTrack)
	router.POST("/renegotiate", renegotiate)

	router.Run(":8088")
}
