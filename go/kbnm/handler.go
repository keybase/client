package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"os/exec"
	"strings"
)

var errInvalidMethod = errors.New("invalid method")

var errMissingField = errors.New("missing field")

var errUserNotFound = errors.New("user not found")

func execRunner(cmd *exec.Cmd) error {
	return cmd.Run()
}

// Handler returns a request handler.
func Handler() *handler {
	return &handler{
		Run: execRunner,
	}
}

type handler struct {
	// Run wraps the equivalent of cmd.Run(), allowing for mocking
	Run func(cmd *exec.Cmd) error
}

// Handle accepts a request, handles it, and returns an optional result if there was no error
func (h *handler) Handle(req *Request) (interface{}, error) {
	switch req.Method {
	case "chat":
		return nil, h.handleChat(req)
	case "query":
		return h.handleQuery(req)
	}
	return nil, errInvalidMethod
}

// handleChat sends a chat message to a user.
func (h *handler) handleChat(req *Request) error {
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
	err = h.Run(cmd)

	return err
}

type resultQuery struct {
	Sigs []struct {
		Statement string `json:"statement"`
	} `json:"sigs"`
}

// handleQuery searches whether a user is present in Keybase.
func (h *handler) handleQuery(req *Request) (*resultQuery, error) {
	if req.To == "" {
		return nil, errMissingField
	}

	binPath, err := findKeybaseBinary()
	if err != nil {
		return nil, err
	}

	var out bytes.Buffer
	cmd := exec.Command(binPath, "sigs", "list", "--type=self", "--json", req.To)
	cmd.Stdout = &out

	err = h.Run(cmd)

	result := &resultQuery{}
	json.Unmarshal(out.Bytes(), &result.Sigs)

	return result, err
}
