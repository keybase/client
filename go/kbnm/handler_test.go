package main

import (
	"io"
	"os/exec"
	"strings"
	"testing"
)

func TestHandlerChat(t *testing.T) {
	h := Handler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		return nil
	}
	h.FindKeybaseBinary = func() (string, error) {
		return "/mocked/test/path/keybase", nil
	}

	req := &Request{
		Method: "chat",
		Body:   "test message",
		To:     "testkeybaseuser",
	}

	if _, err := h.Handle(req); err != nil {
		t.Errorf("request failed: %q", err)
	}

	if ranCmd != "/mocked/test/path/keybase chat send --private testkeybaseuser" {
		t.Errorf("unexpected command: %q", ranCmd)
	}
}

const queryResponse = `2017-04-05T13:44:17.068898-04:00 ▶ [INFO keybase ui.go:64] 001 Identifying \x1b[1mshazow\x1b[22m\n`

const queryResponseErr = `2017-04-05T12:48:09.203299-04:00 ‚M-^V∂ [ERRO keybase standard.go:230] 001 Not found$`

func TestHandlerQuery(t *testing.T) {
	h := Handler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		io.WriteString(cmd.Stderr, queryResponse)
		return nil
	}
	h.FindKeybaseBinary = func() (string, error) {
		return "/mocked/test/path/keybase", nil
	}

	req := &Request{
		Method: "query",
		To:     "sometestuser",
	}

	res, err := h.Handle(req)
	if err != nil {
		t.Errorf("request failed: %q", err)
	}
	result, ok := res.(*resultQuery)
	if !ok {
		t.Errorf("result is not *resultQuery: %T", res)
	}

	if ranCmd != "/mocked/test/path/keybase id sometestuser" {
		t.Errorf("unexpected command: %q", ranCmd)
	}

	if result == nil {
		t.Fatal("result is nil")
	}

	if result.Username != "sometestuser" {
		t.Errorf("invalid result value: %q", result)
	}
}
