# cf-calls

Cloudflare's Calls-API example: Svelte &amp; Golang

> snaphot
> ![screenshoot of the webapp](./assets/Screenshot%202024-06-27%20at%2018.47.16.png)

## Description

**_This is currently in development. The reflection of the mediastream is working._**

> Next steps:
>
> - [x] Refactor so a single RTCPeerConnection suffices
> - [x] For Sending MediaTrack too.
> - [x] Change the frontend to react/ts with tailwindcss
> - [ ] Create a testing rig under /dev
> - [ ] A smooth closing of the connection
> - [ ] A user authentication logic, just a simple http-only cookie
> - [ ] A client can receive a set of tracks from a different session
> - [ ] Multiple clients in a room/conference logic

## prequisites

1. Install [Golang 1.22.0](https://golang.org/doc/install)
2. Install [npm 10.7.0](https://www.npmjs.com/get-npm)

## How to run

```bash
cd frontend
npm install
npm run dev
```

```bash
cd backend
go run . --appId=<appId> --appSecret=<appSecret>
```
