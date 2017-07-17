// Copyright 2017 Keybase. Inc. All rights reserved. Use of
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
	listV1      int
	readV1      int
	sendV1      int
	editV1      int
	deleteV1    int
	attachV1    int
	downloadV1  int
	setstatusV1 int
	markV1      int
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

func (h *handlerTracker) EditV1(context.Context, Call, io.Writer) error {
	h.editV1++
	return nil
}

func (h *handlerTracker) DeleteV1(context.Context, Call, io.Writer) error {
	h.deleteV1++
	return nil
}

func (h *handlerTracker) AttachV1(context.Context, Call, io.Writer) error {
	h.attachV1++
	return nil
}

func (h *handlerTracker) DownloadV1(context.Context, Call, io.Writer) error {
	h.downloadV1++
	return nil
}

func (h *handlerTracker) SetStatusV1(context.Context, Call, io.Writer) error {
	h.setstatusV1++
	return nil
}

func (h *handlerTracker) MarkV1(context.Context, Call, io.Writer) error {
	h.markV1++
	return nil
}

type echoResult struct {
	Status string `json:"status"`
}

var echoOK = echoResult{Status: "ok"}

type chatEcho struct{}

func (c *chatEcho) ListV1(context.Context, listOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) ReadV1(context.Context, readOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) SendV1(context.Context, sendOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) DeleteV1(context.Context, deleteOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) EditV1(context.Context, editOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) AttachV1(context.Context, attachOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) DownloadV1(context.Context, downloadOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) SetStatusV1(context.Context, setStatusOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) MarkV1(context.Context, markOptionsV1) Reply {
	return Reply{Result: echoOK}
}

type topTest struct {
	input      string
	err        error
	listV1     int
	readV1     int
	sendV1     int
	editV1     int
	deleteV1   int
	attachV1   int
	downloadV1 int
	markV1     int
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
	{input: `{"id": 29, "method": "edit", "params":{"version": 1}}`, editV1: 1},
	{input: `{"id": 30, "method": "delete", "params":{"version": 1}}`, deleteV1: 1},
	{input: `{"method": "attach", "params":{"version": 1}}`, attachV1: 1},
	{input: `{"method": "download", "params":{"version": 1, "options": {"message_id": 34, "channel": {"name": "a123,nfnf,t_bob"}, "output": "/tmp/file"}}}`, downloadV1: 1},
	{input: `{"id": 39, "method": "mark", "params":{"version": 1}}`, markV1: 1},
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
		if h.editV1 != test.editV1 {
			t.Errorf("test %d: input %s => editV1 = %d, expected %d", i, test.input, h.editV1, test.editV1)
		}
		if h.deleteV1 != test.deleteV1 {
			t.Errorf("test %d: input %s => deleteV1 = %d, expected %d", i, test.input, h.deleteV1, test.deleteV1)
		}
		if h.attachV1 != test.attachV1 {
			t.Errorf("test %d: input %s => attachV1 = %d, expected %d", i, test.input, h.attachV1, test.attachV1)
		}
		if h.downloadV1 != test.downloadV1 {
			t.Errorf("test %d: input %s => downloadV1 = %d, expected %d", i, test.input, h.downloadV1, test.downloadV1)
		}
		if h.markV1 != test.markV1 {
			t.Errorf("test %d: input %s => markV1 = %d, expected %d", i, test.input, h.markV1, test.markV1)
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
		input: `{"method": "list", "params":{"version": 1, "options": {"topic_type": "boozle"}}}`,
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
		input: `{"method": "read", "params":{"version": 1, "options": {"conversation_id": "123"}}}`,
	},
	{
		input: `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "conversation_id": "999111"}}}`,
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
		input: `{"method": "send", "params":{"version": 1, "options": {"conversation_id": "123", "message": {"body": "hi"}}}}`,
	},
	{
		input: `{"method": "send", "params":{"version": 1, "options": {"conversation_id": "222", "channel": {"name": "alice,bob"}, "message": {"body": "hi"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "list", "params":{"version": 1}}{"method": "list", "params":{"version": 1}}`,
	},
	{
		input: `{"method": "list", "params":{"version": 1, "options": {"topic_type": "dEv"}}}`,
	},
	{
		input: `{"method": "list", "params":{"version": 1}}{"method": "read", "params":{"version": 1, "options": {"conversation_id": "7777"}}}`,
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
	{
		input: `{"id": 29, "method": "edit", "params":{"version": 1}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "delete", "params":{"version": 1}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 29, "method": "edit", "params":{"version": 1, "options": {}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"message_id": 0}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"message_id": 19}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123, "message": {"body": ""}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message": {"body": "edited"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123, "message": {"body": "edited"}}}}`,
	},
	{
		input: `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"conversation_id": "333", "message_id": 123, "message": {"body": "edited"}}}}`,
	},
	{
		input: `{"id": 30, "method": "delete", "params":{"version": 1, "options": {}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "delete", "params":{"version": 1, "options": {"message_id": 0}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "delete", "params":{"version": 1, "options": {"message_id": 19}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "delete", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123}}}`,
	},
	{
		input: `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}, "filename": "photo.png"}}}`,
	},
	{
		input: `{"method": "attach", "params":{"options": {"filename": "photo.png"}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "download", "params":{"version": 1, "options": {"message_id": 34, "channel": {"name": "a123,nfnf,t_bob"}, "output": "/tmp/file"}}}`,
	},
	{
		input: `{"method": "download", "params":{"version": 1, "options": {"message_id": 34, "channel": {"name": "a123,nfnf,t_bob"}, "preview": true, "output": "/tmp/file"}}}`,
	},
	{
		input: `{"method": "setstatus", "params":{"version": 1, "options": {"channel": {"name": "a123,nfnf,t_bob"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "setstatus", "params":{"version": 1, "options": {"status": "ONTARIO", "channel": {"name": "a123,nfnf,t_bob"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "setstatus", "params":{"version": 1, "options": {"status": "ignored", "channel": {"name": "a123,nfnf,t_bob"}}}}`,
	},
	{
		input: `{"id": 30, "method": "mark", "params":{"version": 1}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "mark", "params":{"version": 1, "options": {"message_id": 0}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "mark", "params":{"version": 1, "options": {"message_id": 19}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "mark", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123}}}`,
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
				t.Errorf("test %d: input: %s", i, test.input)
				t.Errorf("test %d: error type %T, expected %T (%v)", i, err, test.err, err)
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
		input:  `{"method": "read", "params":{"version": 1, "options": {"conversation_id": "123"}}}`,
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
		input:  `{"method": "list", "params":{"version": 1}}{"method": "read", "params":{"version": 1, "options": {"conversation_id": "123"}}}`,
		output: `{"result":{"status":"ok"}}` + "\n" + `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "delete", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}, "filename": "photo.png"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}, "filename": "photo.png", "preview": "preview.png"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}, "filename": "photo.png", "preview": "preview.png", "title": "Check this out!"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "download", "params":{"version": 1, "options": {"message_id": 34, "channel": {"name": "a123,nfnf,t_bob"}, "output": "/tmp/file"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "setstatus", "params":{"version": 1, "options": {"status": "ignored", "channel": {"name": "a123,nfnf,t_bob"}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "mark", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123}}}`,
		output: `{"result":{"status":"ok"}}`,
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
