package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pion/webrtc/v4"
)

func newSession(c *gin.Context) {
	request, err := http.NewRequest("POST", basePath+"/sessions/new", c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+appSecret)

	client := &http.Client{}
	response, err := client.Do(request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	responeBytes, err := io.ReadAll(response.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(response.StatusCode, string(responeBytes))

}

func newTrack(c *gin.Context) {
	type TracksObject struct {
		Location  string `json:"location"`
		MID       string `json:"mid,omitempty"`
		SessionId string `json:"sessionId,omitempty"`
		TrackName string `json:"trackName"`
	}
	type Body struct {
		SessionId          string                     `json:"sessionId"`
		SessionDescription *webrtc.SessionDescription `json:"sessionDescription"`
		Tracks             []TracksObject             `json:"tracks"`
	}
	var body Body
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	postPath := basePath + "/sessions/" + body.SessionId + "/tracks/new"

	type RequestBody struct {
		SessionDescription *webrtc.SessionDescription `json:"sessionDescription,omitempty"`
		Tracks             []TracksObject             `json:"tracks"`
	}
	requestBody := RequestBody{
		SessionDescription: body.SessionDescription,
		Tracks:             body.Tracks,
	}

	// Prepare the request
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal request body"})
		return
	}

	// log.Printf("Request path: %s", postPath)
	// log.Printf("Request body: %s", string(jsonData))

	// Create a new request
	req, err := http.NewRequest("POST", postPath, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Fatalf("Failed to create request: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	// Add headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+appSecret)

	// Send the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Failed to create request: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send request"})
		return
	}
	defer resp.Body.Close()

	// Forward the status code and body from the POST response to the Gin response
	c.DataFromReader(resp.StatusCode, resp.ContentLength, resp.Header.Get("Content-Type"), resp.Body, nil)
}

func renegotiate(c *gin.Context) {

	type Body struct {
		SessionId          string                     `json:"sessionId"`
		SessionDescription *webrtc.SessionDescription `json:"sessionDescription"`
	}

	var body Body
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	postPath := basePath + "/sessions/" + body.SessionId + "/renegotiate"

	type RequestBody struct {
		SessionDescription *webrtc.SessionDescription `json:"sessionDescription"`
	}
	requestBody := RequestBody{
		SessionDescription: body.SessionDescription,
	}

	// Prepare the request
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal request body"})
		return
	}

	req, err := http.NewRequest("PUT", postPath, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Fatalf("Failed to create request: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+appSecret)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Failed to create request: %s", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send request"})
		return
	}
	defer resp.Body.Close()

	c.DataFromReader(resp.StatusCode, resp.ContentLength, resp.Header.Get("Content-Type"), resp.Body, nil)
}
