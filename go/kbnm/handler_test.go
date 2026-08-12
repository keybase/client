package main

import (
	"io"
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHandlerChat(t *testing.T) {
	h := newHandler()

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

	_, err := h.Handle(req)
	require.NoError(t, err, "request failed: %q", err)

	require.Equal(t, "/mocked/test/path/keybase chat send --private testkeybaseuser", ranCmd, "unexpected command: %q", ranCmd)
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
	h := newHandler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		_ = ranCmd
		_, err := io.WriteString(cmd.Stderr, queryResponseErr)
		return err
	}
	h.FindKeybaseBinary = func() (string, error) {
		return "/mocked/test/path/keybase", nil
	}

	req := &Request{
		Method: "query",
		To:     "doesnotexist",
	}

	_, err := h.Handle(req)
	require.Error(t, err,
		"request succeeded when failure was expected")

	want, got := err.Error(), "user not found"
	require.Equal(t, want, got, "incorrect error; got: %q, want %q", got, want)
}

func TestHandlerQueryErrorUnexpected(t *testing.T) {
	h := newHandler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		_ = ranCmd
		_, err := io.WriteString(cmd.Stderr, queryResponseErrUnexpected)
		return err
	}
	h.FindKeybaseBinary = func() (string, error) {
		return "/mocked/test/path/keybase", nil
	}

	req := &Request{
		Method: "query",
		To:     "doesnotexist",
	}

	_, err := h.Handle(req)
	require.Error(t, err,
		"request succeeded when failure was expected")

	want, got := err.Error(), "unexpected error: Something unexpected happened"
	require.Equal(t, want, got, "incorrect error; got: %q, want %q", got, want)
}

func TestHandlerQuery(t *testing.T) {
	h := newHandler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		_, err := io.WriteString(cmd.Stderr, queryResponse)
		return err
	}
	h.FindKeybaseBinary = func() (string, error) {
		return "/mocked/test/path/keybase", nil
	}

	req := &Request{
		Method: "query",
		To:     "sometestuser",
	}

	res, err := h.Handle(req)
	require.NoError(t, err, "request failed: %q", err)
	result, ok := res.(*resultQuery)
	require.True(t, ok, "result is not *resultQuery: %T", res)

	require.Equal(t, "/mocked/test/path/keybase id sometestuser", ranCmd, "unexpected command: %q", ranCmd)

	require.NotNil(t, result,
		"result is nil")

	require.Equal(t, "sometestuser", result.Username, "invalid result value: %q", result)
}

func TestCleanCmdArg(t *testing.T) {
	testcases := []struct {
		Input string
		Err   error
	}{
		{"shazow@reddit", nil},
		{"shazow:twitter.com", nil},
		{`abcABC123_@.`, nil},
		{``, errMissingField},
		{`a-bc${foo} bar`, errInvalidInput},
		{"foo\nbar", errInvalidInput},
		{"foo ", errInvalidInput},
	}

	for i, test := range testcases {
		_, err := checkUsernameQuery(test.Input)
		require.Equal(t, test.Err, err, "case %d: got %q; want %q", i, err, test.Err)
	}
}
