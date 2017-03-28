package main

import (
	"errors"
	"io"
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
	cmd := exec.Command("/usr/local/bin/keybase", "chat", "send", "--private", req.To)

	// Write message body over STDIN to avoid running up against bugs with
	// super long messages.
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		stdin.Close()
		return err
	}

	io.WriteString(stdin, req.Body)
	stdin.Close()

	// TODO: Check/convert status code more precisely? Maybe return stdout as
	// part of the error if there is one?
	return cmd.Wait()
}
