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

	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type handlerTracker struct {
	listV1              int
	readV1              int
	getV1               int
	sendV1              int
	editV1              int
	reactionV1          int
	deleteV1            int
	attachV1            int
	downloadV1          int
	setstatusV1         int
	markV1              int
	searchInboxV1       int
	searchRegexpV1      int
	newConvV1           int
	listConvsOnNameV1   int
	joinV1              int
	leaveV1             int
	loadFlipV1          int
	getUnfurlSettingsV1 int
	setUnfurlSettingsV1 int
	advertiseCommandsV1 int
	clearCommandsV1     int
	listCommandsV1      int
}

func (h *handlerTracker) ListV1(context.Context, Call, io.Writer) error {
	h.listV1++
	return nil
}

func (h *handlerTracker) ReadV1(context.Context, Call, io.Writer) error {
	h.readV1++
	return nil
}

func (h *handlerTracker) GetV1(context.Context, Call, io.Writer) error {
	h.getV1++
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

func (h *handlerTracker) ReactionV1(context.Context, Call, io.Writer) error {
	h.reactionV1++
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

func (h *handlerTracker) SearchInboxV1(context.Context, Call, io.Writer) error {
	h.searchInboxV1++
	return nil
}

func (h *handlerTracker) SearchRegexpV1(context.Context, Call, io.Writer) error {
	h.searchRegexpV1++
	return nil
}

func (h *handlerTracker) NewConvV1(context.Context, Call, io.Writer) error {
	h.newConvV1++
	return nil
}

func (h *handlerTracker) ListConvsOnNameV1(context.Context, Call, io.Writer) error {
	h.listConvsOnNameV1++
	return nil
}

func (h *handlerTracker) JoinV1(context.Context, Call, io.Writer) error {
	h.joinV1++
	return nil
}

func (h *handlerTracker) LeaveV1(context.Context, Call, io.Writer) error {
	h.leaveV1++
	return nil
}

func (h *handlerTracker) LoadFlipV1(context.Context, Call, io.Writer) error {
	h.loadFlipV1++
	return nil
}

func (h *handlerTracker) GetUnfurlSettingsV1(context.Context, Call, io.Writer) error {
	h.getUnfurlSettingsV1++
	return nil
}

func (h *handlerTracker) SetUnfurlSettingsV1(context.Context, Call, io.Writer) error {
	h.setUnfurlSettingsV1++
	return nil
}

func (h *handlerTracker) AdvertiseCommandsV1(context.Context, Call, io.Writer) error {
	h.advertiseCommandsV1++
	return nil
}

func (h *handlerTracker) ClearCommandsV1(context.Context, Call, io.Writer) error {
	h.clearCommandsV1++
	return nil
}

func (h *handlerTracker) ListCommandsV1(context.Context, Call, io.Writer) error {
	h.listCommandsV1++
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

func (c *chatEcho) GetV1(context.Context, getOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) SendV1(context.Context, sendOptionsV1, chat1.ChatUiInterface) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) DeleteV1(context.Context, deleteOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) EditV1(context.Context, editOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) ReactionV1(context.Context, reactionOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) AttachV1(context.Context, attachOptionsV1, chat1.ChatUiInterface,
	chat1.NotifyChatInterface) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) DownloadV1(context.Context, downloadOptionsV1, chat1.ChatUiInterface) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) SetStatusV1(context.Context, setStatusOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) MarkV1(context.Context, markOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) SearchInboxV1(context.Context, searchInboxOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) SearchRegexpV1(context.Context, searchRegexpOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) NewConvV1(context.Context, newConvOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) ListConvsOnNameV1(context.Context, listConvsOnNameOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) JoinV1(context.Context, joinOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) LeaveV1(context.Context, leaveOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) LoadFlipV1(context.Context, loadFlipOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) GetUnfurlSettingsV1(context.Context) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) SetUnfurlSettingsV1(context.Context, setUnfurlSettingsOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) AdvertiseCommandsV1(context.Context, advertiseCommandsOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) ClearCommandsV1(context.Context) Reply {
	return Reply{Result: echoOK}
}
func (c *chatEcho) ListCommandsV1(context.Context, listCommandsOptionsV1) Reply {
	return Reply{Result: echoOK}
}

type topTest struct {
	input             string
	err               error
	listV1            int
	readV1            int
	sendV1            int
	editV1            int
	reactionV1        int
	deleteV1          int
	attachV1          int
	downloadV1        int
	markV1            int
	searchInboxV1     int
	searchRegexpV1    int
	joinV1            int
	leaveV1           int
	listConvsOnNameV1 int
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
	{input: `{"id": 29, "method": "reaction", "params":{"version": 1}}`, reactionV1: 1},
	{input: `{"id": 30, "method": "delete", "params":{"version": 1}}`, deleteV1: 1},
	{input: `{"method": "attach", "params":{"version": 1}}`, attachV1: 1},
	{input: `{"method": "download", "params":{"version": 1, "options": {"message_id": 34, "channel": {"name": "a123,nfnf,t_bob"}, "output": "/tmp/file"}}}`, downloadV1: 1},
	{input: `{"id": 39, "method": "mark", "params":{"version": 1}}`, markV1: 1},
	{input: `{"id": 39, "method": "searchinbox", "params":{"version": 1}}`, searchInboxV1: 1},
	{input: `{"id": 39, "method": "searchregexp", "params":{"version": 1}}`, searchRegexpV1: 1},
	{input: `{"id": 39, "method": "join", "params":{"version": 1}}`, joinV1: 1},
	{input: `{"id": 39, "method": "leave", "params":{"version": 1}}`, leaveV1: 1},
	{input: `{"id": 39, "method": "listconvsonname", "params":{"version": 1}}`, listConvsOnNameV1: 1},
}

// TestChatAPIVersionHandlerTop tests that the "top-level" of the chat json makes it to
// the correct functions in a ChatAPIHandler.
func TestChatAPIVersionHandlerTop(t *testing.T) {
	for i, test := range topTests {
		h := new(handlerTracker)
		d := NewChatAPIVersionHandler(h)
		c := &cmdAPI{}
		var buf bytes.Buffer
		err := c.decode(context.Background(), strings.NewReader(test.input), &buf, d)
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
		if h.reactionV1 != test.reactionV1 {
			t.Errorf("test %d: input %s => reactionV1 = %d, expected %d", i, test.input, h.reactionV1, test.reactionV1)
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
		if h.searchInboxV1 != test.searchInboxV1 {
			t.Errorf("test %d: input %s => searchInboxV1 = %d, expected %d", i, test.input, h.searchInboxV1, test.searchInboxV1)
		}
		if h.searchRegexpV1 != test.searchRegexpV1 {
			t.Errorf("test %d: input %s => searchRegexpV1 = %d, expected %d", i, test.input, h.searchRegexpV1, test.searchRegexpV1)
		}
		if h.joinV1 != test.joinV1 {
			t.Errorf("test %d: input %s => joinV1 = %d, expected %d", i, test.input, h.joinV1, test.joinV1)
		}
		if h.leaveV1 != test.leaveV1 {
			t.Errorf("test %d: input %s => leaveV1 = %d, expected %d", i, test.input, h.leaveV1, test.leaveV1)
		}
		if h.listConvsOnNameV1 != test.listConvsOnNameV1 {
			t.Errorf("test %d: input %s => listConvsOnNameV1 = %d, expected %d",
				i, test.input, h.listConvsOnNameV1, test.listConvsOnNameV1)
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
		input: `{"method": "send", "params":{"version": 1, "options": {"conversation_id": "123", "message": {"body": "hi"}, "exploding_lifetime": "5m"}}}`,
	},
	{
		input: `{"method": "send", "params":{"version": 1, "options": {"conversation_id": "123", "message": {"body": "hi"}, "exploding_lifetime": "1s"}}}`,
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
		input: `{"id": 29, "method": "reaction", "params":{"version": 1}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 29, "method": "reaction", "params":{"version": 1, "options": {}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"message_id": 0}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"message_id": 19}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123, "message": {"body": ""}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message": {"body": ":+1:"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123, "message": {"body": ":+1:"}}}}`,
	},
	{
		input: `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"conversation_id": "333", "message_id": 123, "message": {"body": ":+1:"}}}}`,
	},
	{
		input: `{"id": 30, "method": "delete", "params":{"version": 1}}`,
		err:   ErrInvalidOptions{},
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
		input: `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}, "filename": "photo.png", "exploding_lifetime": "5m"}}}`,
	},
	{
		input: `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}, "filename": "photo.png", "exploding_lifetime": "1s"}}}`,
		err:   ErrInvalidOptions{},
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
	{
		input: `{"method": "join", "params":{"version": 1, "options": {} }}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "join", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
	},
	{
		input: `{"method": "join", "params":{"version": 1, "options": {"conversation_id": "123"}}}`,
	},
	{
		input: `{"method": "join", "params":{"version": 1, "options": {"conversation_id": "222", "channel": {"name": "alice,bob"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "leave", "params":{"version": 1, "options": {} }}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "leave", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
	},
	{
		input: `{"method": "leave", "params":{"version": 1, "options": {"conversation_id": "123"}}}`,
	},
	{
		input: `{"method": "leave", "params":{"version": 1, "options": {"conversation_id": "222", "channel": {"name": "alice,bob"}}}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "listconvsonname", "params":{"version": 1}}`,
		err:   ErrInvalidOptions{},
	},
	{
		input: `{"method": "listconvsonname", "params":{"version": 1, "options": {"name": "alice,bob"}}}`,
	},
}

// TestChatAPIVersionHandlerOptions tests the option decoding.
func TestChatAPIVersionHandlerOptions(t *testing.T) {
	for i, test := range optTests {
		h := &ChatAPI{svcHandler: new(chatEcho)}
		d := NewChatAPIVersionHandler(h)
		c := &cmdAPI{}
		var buf bytes.Buffer
		err := c.decode(context.Background(), strings.NewReader(test.input), &buf, d)
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
		input:  `{"method": "send", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message": {"body": "hi"}, "exploding_lifetime": "5m"}}}`,
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
		input:  `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}, "filename": "photo.png", "exploding_lifetime": "5m"}}}`,
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
	{
		input:  `{"method": "searchinbox", "params":{"version": 1, "options": {"query": "hi"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "searchregexp", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "query": "hi"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "join", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "leave", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "listconvsonname", "params":{"version": 1, "options": {"name":"alice,bob"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
}

// TestChatAPIEcho tests an echo handler that replies with empty responses.
func TestChatAPIEcho(t *testing.T) {
	for i, test := range echoTests {
		h := &ChatAPI{svcHandler: new(chatEcho)}
		d := NewChatAPIVersionHandler(h)
		var buf bytes.Buffer
		c := &cmdAPI{}
		err := c.decode(context.Background(), strings.NewReader(test.input), &buf, d)
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
