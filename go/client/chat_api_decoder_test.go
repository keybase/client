// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bytes"
	"io"
	"reflect"
	"strings"
	"testing"
)

type handlerTracker struct {
	listV1 int
	readV1 int
	sendV1 int
}

func (h *handlerTracker) ListV1(Call, io.Writer) error {
	h.listV1++
	return nil
}

func (h *handlerTracker) ReadV1(Call, io.Writer) error {
	h.readV1++
	return nil
}

func (h *handlerTracker) SendV1(Call, io.Writer) error {
	h.sendV1++
	return nil
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
		err := d.Decode(strings.NewReader(test.input), &buf)
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
		input: `{"method": "read", "params":{"version": 1, "options": {"conversation_id": "abc123"}}}`,
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "conversation_id": "afaf111"}}}`,
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
		input: `{"method": "list", "params":{"version": 1}}{"method": "read", "params":{"version": 1, "options": {"conversation_id": "abcd123"}}}`,
	},
}

// TestChatAPIDecoderOptions tests the option decoding.
func TestChatAPIDecoderOptions(t *testing.T) {
	for i, test := range optTests {
		h := new(ChatAPI)
		d := NewChatAPIDecoder(h)
		var buf bytes.Buffer
		err := d.Decode(strings.NewReader(test.input), &buf)
		if test.err != nil {
			if reflect.TypeOf(err) != reflect.TypeOf(test.err) {
				t.Errorf("test %d: error type %T, expected %T", i, err, test.err)
				continue
			}
		} else if err != nil {
			t.Errorf("test %d: input %s => error %s", i, test.input, err)
			continue
		}
	}
}
