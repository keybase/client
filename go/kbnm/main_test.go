package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os/exec"
	"strings"
	"testing"
)

func TestProcess(t *testing.T) {
	h := newHandler()

	var ranCmd string
	h.Run = func(cmd *exec.Cmd) error {
		ranCmd = strings.Join(cmd.Args, " ")
		_ = ranCmd
		return nil
	}
	h.FindKeybaseBinary = func() (string, error) {
		return "/mocked/test/path/keybase", nil
	}

	var inBuf, outBuf bytes.Buffer
	in := json.NewDecoder(&inBuf)
	out := json.NewEncoder(&outBuf)

	// Check invalid JSON:
	_, err := io.WriteString(&inBuf, "invalid json, hi\n")
	if err != nil {
		t.Fatalf("Error writing string: %+v", err)
	}
	err = process(h, in, out)
	if _, ok := err.(*json.SyntaxError); !ok {
		t.Errorf("incorrect error on invalid JSON: %T", err)
	}
	// Reset the decoder
	inBuf.Reset()
	in = json.NewDecoder(&inBuf)

	testCases := []struct {
		In        string
		ExpectOut string
	}{
		{
			`{"method": "foo"}` + "\n",
			`{"client":0,"status":"error","message":"invalid method"}` + "\n",
		},
		{
			`{"method": "chat", "to": "shazow", "body": "Hello, world."}` + "\n",
			`{"client":0,"status":"ok","message":""}` + "\n",
		},
	}

	for i, test := range testCases {
		outBuf.Reset()

		_, err = io.WriteString(&inBuf, test.In)
		if err != nil {
			t.Fatalf("Error writing string: %+v", err)
		}
		if err := process(h, in, out); err != nil {
			t.Fatalf("[case #%d] processing failed early: %s", i, err)
		}

		if want, got := test.ExpectOut, outBuf.String(); want != got {
			t.Errorf("[case #%d] want:\n%s\ngot:\n%s", i, want, got)
		}
	}
}
