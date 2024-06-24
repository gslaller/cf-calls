package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func forwardRequest(c *gin.Context, method, path string) {
	req, err := http.NewRequest(method, path, c.Request.Body)
	if err != nil {
		log.Printf("Failed to create request: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	// Copy headers from the original request
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+appSecret)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send request: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send request"})
		return
	}
	defer resp.Body.Close()

	// Forward the status code, headers, and body from the response
	c.DataFromReader(resp.StatusCode, resp.ContentLength, resp.Header.Get("Content-Type"), resp.Body, nil)
}

func newSession(c *gin.Context) {
	path := fmt.Sprintf("%s/sessions/new", basePath)
	forwardRequest(c, "POST", path)
}

func newTrack(c *gin.Context) {
	sessionId := c.Query("sessionId")
	postPath := fmt.Sprintf("%s/sessions/%s/tracks/new", basePath, sessionId)

	forwardRequest(c, "POST", postPath)
}

func renegotiate(c *gin.Context) {
	sessionId := c.Query("sessionId")
	postPath := fmt.Sprintf("%s/sessions/%s/renegotiate", basePath, sessionId)

	forwardRequest(c, "PUT", postPath)
}
