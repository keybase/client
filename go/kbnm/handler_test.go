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

	req := &Request{
		Method: "chat",
		Body:   "test message",
		To:     "testkeybaseuser",
	}

	if _, err := h.Handle(req); err != nil {
		t.Errorf("request failed: %q", err)
	}

	if ranCmd != "/usr/local/bin/keybase chat send --private testkeybaseuser" {
		t.Errorf("unexpected command: %q", ranCmd)
	}
}

const queryResponse = `[
	{
		"seqno": 1,
		"sig_id": "c3f2b7c2b92e7e53b8d67542695ec26f5a8ea3b3abaa07764b14e453434471180f",
		"type": "self",
		"ctime": 1394236029,
		"revoked": false,
		"active": true,
		"key_fingerprint": "9fcea980ccfd3c13e11e88a9350687d17e81fd68",
		"statement": "testkeybaseuser"
	}
]`

func TestHandlerQuery(t *testing.T) {
	h := Handler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		io.WriteString(cmd.Stdout, queryResponse)
		return nil
	}

	req := &Request{
		Method: "query",
		To:     "testkeybaseuser",
	}

	res, err := h.Handle(req)
	if err != nil {
		t.Errorf("request failed: %q", err)
	}
	result, ok := res.(*resultQuery)
	if !ok {
		t.Errorf("result is not *resultQuery: %T", res)
	}

	if ranCmd != "/usr/local/bin/keybase sigs list --type=self --json testkeybaseuser" {
		t.Errorf("unexpected command: %q", ranCmd)
	}

	if result == nil {
		t.Fatal("result is nil")
	}

	if len(result.Sigs) != 1 || result.Sigs[0].Statement != "testkeybaseuser" {
		t.Errorf("invalid result value: %q", result)
	}
}
