package main

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

var errInvalidMethod = errors.New("invalid method")

var errMissingField = errors.New("missing field")

var errUserNotFound = errors.New("user not found")

func handle(req *Request) error {
	switch req.Method {
	case "chat":
		return handleChat(req)
	case "query":
		return handleQuery(req)
	default:
		return errInvalidMethod
	}
}

// findKeybaseBinary returns the path to the Keybase binary, if it finds it.
func findKeybaseBinary() (string, error) {
	// FIXME: Get the absolute path without a filled PATH var somehow?
	return "/usr/local/bin/keybase", nil
}

// handleChat sends a chat message to a user.
func handleChat(req *Request) error {
	if req.Body == "" || req.To == "" {
		return errMissingField
	}

	binPath, err := findKeybaseBinary()
	if err != nil {
		return err
	}

	cmd := exec.Command(binPath, "chat", "send", "--private", req.To)
	cmd.Stdin = strings.NewReader(req.Body)

	// TODO: Check/convert status code more precisely? Maybe return stdout as
	// part of the error if there is one?
	err = cmd.Run()

	return err
}

// handleQuery searches whether a user is present in Keybase.
func handleQuery(req *Request) error {
	if req.To == "" {
		return errMissingField
	}

	binPath, err := findKeybaseBinary()
	if err != nil {
		return err
	}

	var out bytes.Buffer
	cmd := exec.Command(binPath, "sigs", "list", "--type=self", "--json", req.To)
	cmd.Stdout = &out

	err = cmd.Run()

	fmt.Println("out:", out.String())

	return err
}
