package main

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

var errInvalidMethod = errors.New("invalid method")

var errMissingField = errors.New("missing field")

var errUserNotFound = errors.New("user not found")

var errParsing = errors.New("failed to parse keybase output")

var errKeybaseNotRunning = errors.New("keybase is not running")

var errKeybaseNotLoggedIn = errors.New("keybase is not logged in")

func execRunner(cmd *exec.Cmd) error {
	return cmd.Run()
}

// Handler returns a request handler.
func Handler() *handler {
	return &handler{
		Run:               execRunner,
		FindKeybaseBinary: findKeybaseBinary,
	}
}

type handler struct {
	// Run wraps the equivalent of cmd.Run(), allowing for mocking
	Run func(cmd *exec.Cmd) error
	// FindCmd returns the path of the keybase binary if it can find it
	FindKeybaseBinary func() (string, error)
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

	binPath, err := h.FindKeybaseBinary()
	if err != nil {
		return err
	}

	var out bytes.Buffer
	cmd := exec.Command(binPath, "chat", "send", "--private", req.To)
	cmd.Env = append(os.Environ(), "KEYBASE_LOG_FORMAT=plain")
	cmd.Stdin = strings.NewReader(req.Body)
	cmd.Stdout = &out
	cmd.Stderr = &out

	if err := h.Run(cmd); err != nil {
		return parseError(&out, err)
	}

	return nil
}

type resultQuery struct {
	Username string `json:"username"`
}

// parseQuery reads the stderr from a keybase query command and returns a result
func parseQuery(r io.Reader) (*resultQuery, error) {
	scanner := bufio.NewScanner(r)

	if !scanner.Scan() {
		return nil, scanner.Err()
	}

	// Should be of the form "[INFO] 001 Identifying someuser"
	line := strings.TrimSpace(scanner.Text())
	parts := strings.Split(line, " ")
	if len(parts) < 4 {
		return nil, errParsing
	}

	if parts[2] != "Identifying" {
		return nil, errUserNotFound
	}

	resp := &resultQuery{
		Username: parts[3],
	}
	return resp, nil
}

// parseError reads stderr output and returns an error made from it. If it
// fails to parse an error, it returns the fallback error.
func parseError(r io.Reader, fallback error) error {
	scanner := bufio.NewScanner(r)

	// Find the final error
	var lastErr error
	for scanner.Scan() {
		// Should be of the form "[ERRO] 001 Not found"
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		// Check some error states we know about:
		if strings.Contains(line, "Keybase isn't running.") {
			return errKeybaseNotRunning
		}
		if strings.Contains(line, "You are not logged into Keybase.") {
			return errKeybaseNotLoggedIn
		}
		parts := strings.SplitN(line, " ", 2)
		if len(parts) < 3 {
			continue
		}
		if parts[0] != "[ERRO]" {
			continue
		}
		lastErr = fmt.Errorf(parts[2])
	}

	if lastErr != nil {
		return lastErr
	}

	return fallback
}

// handleQuery searches whether a user is present in Keybase.
func (h *handler) handleQuery(req *Request) (*resultQuery, error) {
	if req.To == "" {
		return nil, errMissingField
	}

	binPath, err := h.FindKeybaseBinary()
	if err != nil {
		return nil, err
	}

	// Unfortunately `keybase id ...` does not support JSON output, so we parse the output
	var out bytes.Buffer
	cmd := exec.Command(binPath, "id", req.To)
	cmd.Env = append(os.Environ(), "KEYBASE_LOG_FORMAT=plain")
	cmd.Stdout = &out
	cmd.Stderr = &out

	if err := h.Run(cmd); err != nil {
		return nil, parseError(&out, err)
	}

	return parseQuery(&out)
}
