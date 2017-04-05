package main

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
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

	cmd := exec.Command(binPath, "chat", "send", "--private", req.To)
	cmd.Stdin = strings.NewReader(req.Body)

	// TODO: Check/convert status code more precisely? Maybe return stdout as
	// part of the error if there is one?
	err = h.Run(cmd)

	return err
}

type resultQuery struct {
	Username string `json:"username"`
}

func parseQuery(r io.Reader) (*resultQuery, error) {
	br := bufio.NewReader(r)
	line, err := br.ReadBytes('\n')
	if err != nil {
		return nil, err
	}
	parts := bytes.Split([]byte(`001`), line)
	if len(parts) != 2 {
		fmt.Printf("%q\n%d: %q\n", line, len(parts), parts)
		return nil, errParsing
	}

	if bytes.HasPrefix(parts[1], []byte(`Not found`)) {
		return nil, errUserNotFound
	}

	resp := &resultQuery{}
	_, err = fmt.Sscanf(parts[1], "Identifying ^[[1m%s^[[22m$", &resp.Username)
	return resp, err
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
	cmd.Stderr = &out

	err = h.Run(cmd)
	if err != nil {
		// TODO: Differentiate betewen failure and not matched
		return nil, err
	}

	return parseQuery(&out)
}
