package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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

	// Read the raw body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("Failed to read body: %s", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Restore the body for later use
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	// Unmarshal the body to log track information
	var body struct {
		Tracks []struct {
			Location  string `json:"location"`
			Mid       string `json:"mid"`
			SessionId string `json:"sessionId"`
			TrackName string `json:"trackName"`
		} `json:"tracks"`
	}

	if err := json.Unmarshal(bodyBytes, &body); err != nil {
		log.Printf("Failed to unmarshal JSON: %s", err.Error())
	} else {
		log.Printf("Session %s received new track(s) %d:", sessionId, len(body.Tracks))
		for _, track := range body.Tracks {
			log.Printf("New track(loc: %s): %s (%s) in session %s", track.Location, track.TrackName, track.Mid, track.SessionId)
		}
	}

	// Forward the request with the original body
	forwardRequest(c, "POST", postPath)
}

func renegotiate(c *gin.Context) {
	sessionId := c.Query("sessionId")
	postPath := fmt.Sprintf("%s/sessions/%s/renegotiate", basePath, sessionId)

	forwardRequest(c, "PUT", postPath)
}

func sessionState(c *gin.Context) {
	sessionId := c.Query("sessionId")
	path := fmt.Sprintf("%s/sessions/%s", basePath, sessionId)
	forwardRequest(c, "GET", path)
}

func closeTrack(c *gin.Context) {
	sessionId := c.Query("sessionId")
	path := fmt.Sprintf("%s/sessions/%s/tracks/close", basePath, sessionId)
	forwardRequest(c, "PUT", path)
}
