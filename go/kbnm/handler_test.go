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

const queryResponse = `[INFO] 001 Identifying sometestuser
✔ public key fingerprint: 9FCE A980 CCFD 3C13 E11E 88A9 3506 87D1 7E81 FD68
✔ admin of sometestuser.net via HTTPS: https://sometestuser.net/keybase.txt
✔ "sometestuser" on github: https://gist.github.com/10763855
✔ "sometestuser" on twitter: https://twitter.com/sometestuser/status/456154521052274689 [cached 2017-04-06 10:20:10 EDT]
✔ "sometestuser" on hackernews: https://news.ycombinator.com/user?id=sometestuser [cached 2017-04-06 10:20:09 EDT]
✔ "sometestuser" on reddit: https://www.reddit.com/r/KeybaseProofs/comments/2o8dbv/my_keybase_proof_redditsometestuser_keybasesometestuser/ [cached 2017-04-06 10:20:10 EDT]
`

const queryResponseErr = `[ERRO] 001 Not found
`

const queryResponseErrUnexpected = `[INFO] 001 Random progress message
[ERRO] 002 Something unexpected happened
`

func TestHandlerQueryError(t *testing.T) {
	h := Handler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		io.WriteString(cmd.Stderr, queryResponseErr)
		return nil
	}
	h.FindKeybaseBinary = func() (string, error) {
		return "/mocked/test/path/keybase", nil
	}

	req := &Request{
		Method: "query",
		To:     "doesnotexist",
	}

	_, err := h.Handle(req)
	if err == nil {
		t.Fatal("request succeeded when failure was expected")
	}

	if got, want := err.Error(), "user not found"; got != want {
		t.Errorf("incorrect error; got: %q, want %q", got, want)
	}
}

func TestHandlerQueryErrorUnexpected(t *testing.T) {
	h := Handler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		io.WriteString(cmd.Stderr, queryResponseErrUnexpected)
		return nil
	}
	h.FindKeybaseBinary = func() (string, error) {
		return "/mocked/test/path/keybase", nil
	}

	req := &Request{
		Method: "query",
		To:     "doesnotexist",
	}

	_, err := h.Handle(req)
	if err == nil {
		t.Fatal("request succeeded when failure was expected")
	}

	if got, want := err.Error(), "unexpected error: Something unexpected happened"; got != want {
		t.Errorf("incorrect error; got: %q, want %q", got, want)
	}
}

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

func TestCleanCmdArg(t *testing.T) {
	testcases := []struct {
		Input string
		Want  string
	}{
		{"shazow@reddit", `shazow@reddit`},
		{"shazow:twitter.com", `shazow:twitter.com`},
		{`abcABC123_@.`, `abcABC123_@.`},
		{`a-bc${foo} bar`, `a-bcfoobar`},
		{"foo\nbar", `foobar`},
	}

	for i, test := range testcases {
		if got, want := cleanCmdArg(test.Input), test.Want; got != want {
			t.Errorf("case %d: got %q; want %q", i, got, want)
		}
	}
}
