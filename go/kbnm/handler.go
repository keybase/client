package main

import (
	"errors"
	"os/exec"
)

var errInvalidMethod = errors.New("invalid method")

var errMissingField = errors.New("missing field")

func handle(req *Request) error {
	switch req.Method {
	case "chat":
		return handleChat(req)
	default:
		return errInvalidMethod
	}
}

func handleChat(req *Request) error {
	if req.Body == "" || req.To == "" {
		return errMissingField
	}

	// FIXME: Get the absolute path without a filled PATH var somehow?
	cmd := exec.Command("/usr/local/bin/keybase", "chat", "send", "--private", req.To, req.Body)

	// TODO: Check/convert status code more precisely?
	return cmd.Run()
}
