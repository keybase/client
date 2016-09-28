// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bytes"
	"encoding/json"
	"io"
	"reflect"
	"strings"
	"testing"

	"golang.org/x/net/context"
)

type handlerTracker struct {
	listV1 int
	readV1 int
	sendV1 int
}

func (h *handlerTracker) ListV1(context.Context, Call, io.Writer) error {
	h.listV1++
	return nil
}

func (h *handlerTracker) ReadV1(context.Context, Call, io.Writer) error {
	h.readV1++
	return nil
}

func (h *handlerTracker) SendV1(context.Context, Call, io.Writer) error {
	h.sendV1++
	return nil
}

type echoResult struct {
	Status string `json:"status"`
}

var echoOK = echoResult{Status: "ok"}

type chatEcho struct{}

func (c *chatEcho) ListV1(context.Context) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) ReadV1(context.Context, readOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) SendV1(context.Context, sendOptionsV1) Reply {
	return Reply{Result: echoOK}
}

type topTest struct {
	input  string
	err    error
	listV1 int
	readV1 int
	sendV1 int
}

var topTests = []topTest{
	{input: "{}", err: ErrInvalidMethod{}},
	{input: `{"params":{"version": 2}}`, err: ErrInvalidVersion{}},
	{input: `{"params":{"version": 1}}`, err: ErrInvalidMethod{}},
	{input: `{"method": "xxx", "params":{"version": 1}}`, err: ErrInvalidMethod{}},
	{input: `{"method": "list", "params":{"version": 1}}`, listV1: 1},
	{input: `{"method": "read", "params":{"version": 1}}`, readV1: 1},
	{input: `{"method": "send", "params":{"version": 1}}`, sendV1: 1},
	{input: `{"id": 19, "method": "list", "params":{"version": 1}}`, listV1: 1},
	{input: `{"id": 20, "method": "read", "params":{"version": 1}}`, readV1: 1},
	{input: `{"id": 21, "method": "send", "params":{"version": 1}}`, sendV1: 1},
	{input: `{"jsonrpc": "2.0", "id": 19, "method": "list", "params":{"version": 1}}`, listV1: 1},
	{input: `{"jsonrpc": "2.0", "id": 20, "method": "read", "params":{"version": 1}}`, readV1: 1},
	{input: `{"jsonrpc": "2.0", "id": 21, "method": "send", "params":{"version": 1}}`, sendV1: 1},
	{input: `{"method": "list", "params":{"version": 1}}{"method": "list", "params":{"version": 1}}`, listV1: 2},
	{input: `{"method": "list", "params":{"version": 1}}{"method": "read", "params":{"version": 1}}`, listV1: 1, readV1: 1},
}

// TestChatAPIDecoderTop tests that the "top-level" of the chat json makes it to
// the correct functions in a ChatAPIHandler.
func TestChatAPIDecoderTop(t *testing.T) {
	for i, test := range topTests {
		h := new(handlerTracker)
		d := NewChatAPIDecoder(h)
		var buf bytes.Buffer
		err := d.Decode(context.Background(), strings.NewReader(test.input), &buf)
		if test.err != nil {
			if reflect.TypeOf(err) != reflect.TypeOf(test.err) {
				t.Errorf("test %d: error type %T, expected %T", i, err, test.err)
				continue
			}
		} else if err != nil {
			t.Errorf("test %d: input %s => error %s", i, test.input, err)
			continue
		}
		if h.listV1 != test.listV1 {
			t.Errorf("test %d: input %s => listV1 = %d, expected %d", i, test.input, h.listV1, test.listV1)
		}
		if h.readV1 != test.readV1 {
			t.Errorf("test %d: input %s => readV1 = %d, expected %d", i, test.input, h.readV1, test.readV1)
		}
		if h.sendV1 != test.sendV1 {
			t.Errorf("test %d: input %s => sendV1 = %d, expected %d", i, test.input, h.sendV1, test.sendV1)
		}
	}
}

type optTest struct {
	input string
	err   error
}

var optTests = []optTest{
	{
		input: `{"method": "list", "params":{"version": 1}}`,
	},
	{
		input: `{"method": "list", "params":{"version": 1, "options": {"filter": "all"}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "read", "params":{"version": 1}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {"conversation_id": 123}}}`,
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "conversation_id": 999111}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "send", "params":{"version": 1}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "send", "params":{"version": 1, "options": {} }}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "send", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "send", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message": {"body": "hi"}}}}`,
	},
	{
		input: `{"method": "list", "params":{"version": 1}}{"method": "list", "params":{"version": 1}}`,
	},
	{
		input: `{"method": "list", "params":{"version": 1}}{"method": "read", "params":{"version": 1, "options": {"conversation_id": 7777}}}`,
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}`, /* missing closing bracket at end */
		err:   ErrInvalidJSON{},
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"`, /* missing closing brackets at end */
		err:   ErrInvalidJSON{},
	},
	{
		input: `{"method": "read", "params":{'version': 1, "options": {"channel": {"name": "alice,bob"}}}`,
		err:   &json.SyntaxError{},
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": "channel": {"name": "alice,bob"}}`,
		err:   &json.SyntaxError{},
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
	},
}

// TestChatAPIDecoderOptions tests the option decoding.
func TestChatAPIDecoderOptions(t *testing.T) {
	for i, test := range optTests {
		h := &ChatAPI{svcHandler: new(chatEcho)}
		d := NewChatAPIDecoder(h)
		var buf bytes.Buffer
		err := d.Decode(context.Background(), strings.NewReader(test.input), &buf)
		if test.err != nil {
			if reflect.TypeOf(err) != reflect.TypeOf(test.err) {
				t.Errorf("test %d: error type %T, expected %T (%s)", i, err, test.err, err)
				continue
			}
		} else if err != nil {
			t.Errorf("test %d: input %s => error %s", i, test.input, err)
			continue
		}
	}
}

type echoTest struct {
	input  string
	output string
	err    error
}

var echoTests = []echoTest{
	{
		input:  `{"method": "list", "params":{"version": 1}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"id": 1, "method": "list", "params":{"version": 1}}`,
		output: `{"id":1,"result":{"status":"ok"}}`,
	},
	{
		input:  `{"jsonrpc": "2.0", "id": 3, "method": "list", "params":{"version": 1}}`,
		output: `{"jsonrpc":"2.0","id":3,"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "read", "params":{"version": 1, "options": {"conversation_id": 123}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "send", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message": {"body": "hi"}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "list", "params":{"version": 1}}{"method": "list", "params":{"version": 1}}`,
		output: `{"result":{"status":"ok"}}` + "\n" + `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "list", "params":{"version": 1}}{"method": "read", "params":{"version": 1, "options": {"conversation_id": 123}}}`,
		output: `{"result":{"status":"ok"}}` + "\n" + `{"result":{"status":"ok"}}`,
	},
}

// TestChatAPIEcho tests an echo handler that replies with empty responses.
func TestChatAPIEcho(t *testing.T) {
	for i, test := range echoTests {
		h := &ChatAPI{svcHandler: new(chatEcho)}
		d := NewChatAPIDecoder(h)
		var buf bytes.Buffer
		err := d.Decode(context.Background(), strings.NewReader(test.input), &buf)
		if test.err != nil {
			if reflect.TypeOf(err) != reflect.TypeOf(test.err) {
				t.Errorf("test %d: error type %T, expected %T", i, err, test.err)
				continue
			}
		} else if err != nil {
			t.Errorf("test %d: input %s => error %s", i, test.input, err)
			continue
		}

		if strings.TrimSpace(buf.String()) != strings.TrimSpace(test.output) {
			t.Errorf("test %d: input %s => output %s, expected %s", i, test.input, strings.TrimSpace(buf.String()), strings.TrimSpace(test.output))
			continue
		}
	}
}
