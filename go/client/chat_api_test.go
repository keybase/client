// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bytes"
	"fmt"
	"io"
	"reflect"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
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
	addToChannelV1      int
	loadFlipV1          int
	getUnfurlSettingsV1 int
	setUnfurlSettingsV1 int
	advertiseCommandsV1 int
	clearCommandsV1     int
	listCommandsV1      int
	pinV1               int
	unpinV1             int
	getDeviceInfoV1     int
	listMembersV1       int
	emojiAddV1          int
	emojiAddAliasV1     int
	emojiListV1         int
	emojiRemoveV1       int
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

func (h *handlerTracker) AddToChannelV1(context.Context, Call, io.Writer) error {
	h.addToChannelV1++
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

func (h *handlerTracker) PinV1(context.Context, Call, io.Writer) error {
	h.pinV1++
	return nil
}

func (h *handlerTracker) UnpinV1(context.Context, Call, io.Writer) error {
	h.unpinV1++
	return nil
}

func (h *handlerTracker) GetResetConvMembersV1(context.Context, Call, io.Writer) error {
	return nil
}

func (h *handlerTracker) AddResetConvMemberV1(context.Context, Call, io.Writer) error {
	return nil
}

func (h *handlerTracker) GetDeviceInfoV1(context.Context, Call, io.Writer) error {
	h.getDeviceInfoV1++
	return nil
}

func (h *handlerTracker) ListMembersV1(context.Context, Call, io.Writer) error {
	h.listMembersV1++
	return nil
}

func (h *handlerTracker) EmojiAddV1(context.Context, Call, io.Writer) error {
	h.emojiAddV1++
	return nil
}

func (h *handlerTracker) EmojiAddAliasV1(context.Context, Call, io.Writer) error {
	h.emojiAddAliasV1++
	return nil
}

func (h *handlerTracker) EmojiListV1(context.Context, Call, io.Writer) error {
	h.emojiListV1++
	return nil
}

func (h *handlerTracker) EmojiRemoveV1(context.Context, Call, io.Writer) error {
	h.emojiRemoveV1++
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

func (c *chatEcho) AddToChannelV1(context.Context, addToChannelOptionsV1) Reply {
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

func (c *chatEcho) ClearCommandsV1(context.Context, clearCommandsOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) ListCommandsV1(context.Context, listCommandsOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) PinV1(context.Context, pinOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) UnpinV1(context.Context, unpinOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) GetResetConvMembersV1(context.Context) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) AddResetConvMemberV1(context.Context, addResetConvMemberOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) GetDeviceInfoV1(context.Context, getDeviceInfoOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) ListMembersV1(context.Context, listMembersOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) EmojiAddV1(context.Context, emojiAddOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) EmojiAddAliasV1(context.Context, emojiAddAliasOptionsV1) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) EmojiListV1(context.Context) Reply {
	return Reply{Result: echoOK}
}

func (c *chatEcho) EmojiRemoveV1(context.Context, emojiRemoveOptionsV1) Reply {
	return Reply{Result: echoOK}
}

type topTest struct {
	input             string
	output            string
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
	addToChannelV1    int
	listConvsOnNameV1 int
	pinV1             int
	unpinV1           int
	getDeviceInfoV1   int
	listMembersV1     int
}

var topTests = []topTest{
	{
		input:  `{}`,
		output: `{"error":{"code":0,"message":"invalid v1 method \"\""}}`,
	},
	{
		input:  `{"params":{"version": 2}}`,
		output: `{"error":{"code":0,"message":"invalid version 2"}}`,
	},
	{
		input:  `{"params":{"version": 1}}`,
		output: `{"error":{"code":0,"message":"invalid v1 method \"\""}}`,
	},
	{
		input:  `{"method": "xxx", "params":{"version": 1}}`,
		output: `{"error":{"code":0,"message":"invalid v1 method \"xxx\""}}`,
	},
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
	{input: `{"id": 39, "method": "pin", "params":{"version": 1}}`, pinV1: 1},
	{input: `{"id": 39, "method": "unpin", "params":{"version": 1}}`, unpinV1: 1},
	{input: `{"id": 39, "method": "getdeviceinfo", "params":{"version": 1}}`, getDeviceInfoV1: 1},
	{input: `{"id": 39, "method": "listmembers", "params":{"version": 1}}`, listMembersV1: 1},
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
		if h.addToChannelV1 != test.addToChannelV1 {
			t.Errorf("test %d: input %s => addToChannelV1 = %d, expected %d", i, test.input, h.addToChannelV1, test.addToChannelV1)
		}
		if h.listConvsOnNameV1 != test.listConvsOnNameV1 {
			t.Errorf("test %d: input %s => listConvsOnNameV1 = %d, expected %d",
				i, test.input, h.listConvsOnNameV1, test.listConvsOnNameV1)
		}
		if h.pinV1 != test.pinV1 {
			t.Errorf("test %d: input %s => pinV1 = %d, expected %d",
				i, test.input, h.pinV1, test.pinV1)
		}
		if h.unpinV1 != test.unpinV1 {
			t.Errorf("test %d: input %s => unpinV1 = %d, expected %d",
				i, test.input, h.unpinV1, test.unpinV1)
		}
		if h.getDeviceInfoV1 != test.getDeviceInfoV1 {
			t.Errorf("test %d: input %s => getDeviceInfoV1 = %d, expected %d",
				i, test.input, h.getDeviceInfoV1, test.getDeviceInfoV1)
		}
		if h.listMembersV1 != test.listMembersV1 {
			t.Errorf("test %d: input %s => listMembersV1 = %d, expected %d",
				i, test.input, h.listMembersV1, test.listMembersV1)
		}
		if strings.TrimSpace(buf.String()) != strings.TrimSpace(test.output) {
			t.Errorf("test %d: input %s => output %s, expected %s", i, test.input, strings.TrimSpace(buf.String()), strings.TrimSpace(test.output))
		}
	}
}

type optTest struct {
	input  string
	output string
	err    error
}

var optTests = []optTest{
	{
		input:  `{"method": "list", "params":{"version": 1}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "list", "params":{"version": 1, "options": {"topic_type": "boozle"}}}`,
		output: `{"error":{"code":0,"message":"invalid list v1 options: invalid topic type: 'boozle'"}}`,
	},
	{
		input:  `{"method": "read", "params":{"version": 1}}`,
		output: `{"error":{"code":0,"message":"invalid read v1 options: empty options"}}`,
	},
	{
		input:  `{"method": "read", "params":{"version": 1, "options": {}}}`,
		output: `{"error":{"code":0,"message":"invalid read v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "conversation_id": "999111"}}}`,
		output: `{"error":{"code":0,"message":"invalid read v1 options: include channel or conversation_id, not both"}}`,
	},
	{
		input:  `{"method": "send", "params":{"version": 1}}`,
		output: `{"error":{"code":0,"message":"invalid send v1 options: empty options"}}`,
	},
	{
		input:  `{"method": "send", "params":{"version": 1, "options": {} }}`,
		output: `{"error":{"code":0,"message":"invalid send v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"method": "send", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
		output: `{"error":{"code":0,"message":"invalid send v1 options: invalid message, body cannot be empty"}}`,
	},
	{
		input:  `{"method": "send", "params":{"version": 1, "options": {"conversation_id": "222", "channel": {"name": "alice,bob"}, "message": {"body": "hi"}}}}`,
		output: `{"error":{"code":0,"message":"invalid send v1 options: include channel or conversation_id, not both"}}`,
	},
	{
		input:  `{"method": "send", "params":{"version": 1, "options": {"conversation_id": "123", "message": {"body": "hi"}, "exploding_lifetime": "1s"}}}`,
		output: fmt.Sprintf(`{"error":{"code":0,"message":"invalid send v1 options: invalid ephemeral lifetime: %v, must be between %v and %v"}}`, "1s", libkb.MaxEphemeralContentLifetime, libkb.MinEphemeralContentLifetime),
	},
	{
		input:  `{"method": "list", "params":{"version": 1}}{"method": "list", "params":{"version": 1}}`,
		output: `{"result":{"status":"ok"}}` + "\n" + `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "list", "params":{"version": 1, "options": {"topic_type": "dEv"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "list", "params":{"version": 1}}{"method": "read", "params":{"version": 1, "options": {"conversation_id": "7777"}}}`,
		output: `{"result":{"status":"ok"}}` + "\n" + `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}`,
		output: `{"error":{"code":0,"message":"invalid JSON: expected more JSON in input"}}`,
	},
	{
		input:  `{"method": "read", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"`,
		output: `{"error":{"code":0,"message":"invalid JSON: expected more JSON in input"}}`,
	},
	{
		input:  `{"method": "read", "params":{'version': 1, "options": {"channel": {"name": "alice,bob"}}}`,
		output: `{"error":{"code":0,"message":"invalid character '\\'' looking for beginning of object key string"}}`,
	},
	{
		input:  `{"method": "read", "params":{"version": 1, "options": "channel": {"name": "alice,bob"}}`,
		output: `{"error":{"code":0,"message":"invalid character ':' after object key:value pair"}}`,
	},
	{
		input:  `{"id": 29, "method": "edit", "params":{"version": 1}}`,
		output: `{"id":29,"error":{"code":0,"message":"invalid edit v1 options: empty options"}}`,
	},
	{
		input:  `{"id": 29, "method": "edit", "params":{"version": 1, "options": {}}}`,
		output: `{"id":29,"error":{"code":0,"message":"invalid edit v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"message_id": 0}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid edit v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"message_id": 19}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid edit v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123, "message": {"body": ""}}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid edit v1 options: invalid message, body cannot be empty"}}`,
	},
	{
		input:  `{"id": 30, "method": "edit", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message": {"body": "edited"}}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid edit v1 options: invalid message id '0'"}}`,
	},
	{
		input:  `{"id": 29, "method": "reaction", "params":{"version": 1}}`,
		output: `{"id":29,"error":{"code":0,"message":"invalid reaction v1 options: empty options"}}`,
	},
	{
		input:  `{"id": 29, "method": "reaction", "params":{"version": 1, "options": {}}}`,
		output: `{"id":29,"error":{"code":0,"message":"invalid reaction v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"message_id": 0}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid reaction v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"message_id": 19}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid reaction v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123, "message": {"body": ""}}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid reaction v1 options: invalid message, body cannot be empty"}}`,
	},
	{
		input:  `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message": {"body": ":+1:"}}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid reaction v1 options: invalid message id '0'"}}`,
	},
	{
		input:  `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123, "message": {"body": ":+1:"}}}}`,
		output: `{"id":30,"result":{"status":"ok"}}`,
	},
	{
		input:  `{"id": 30, "method": "reaction", "params":{"version": 1, "options": {"conversation_id": "333", "message_id": 123, "message": {"body": ":+1:"}}}}`,
		output: `{"id":30,"result":{"status":"ok"}}`,
	},
	{
		input:  `{"id": 30, "method": "delete", "params":{"version": 1}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid delete v1 options: empty options"}}`,
	},
	{
		input:  `{"id": 30, "method": "delete", "params":{"version": 1, "options": {}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid delete v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "delete", "params":{"version": 1, "options": {"message_id": 0}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid delete v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "delete", "params":{"version": 1, "options": {"message_id": 19}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid delete v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "delete", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123}}}`,
		output: `{"id":30,"result":{"status":"ok"}}`,
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
		input:  `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}, "filename": "photo.png", "exploding_lifetime": "1s"}}}`,
		output: fmt.Sprintf(`{"error":{"code":0,"message":"invalid attach v1 options: invalid ephemeral lifetime: %v, must be between %v and %v"}}`, "1s", libkb.MaxEphemeralContentLifetime, libkb.MinEphemeralContentLifetime),
	},
	{
		input:  `{"method": "attach", "params":{"options": {"filename": "photo.png"}}}`,
		output: `{"error":{"code":0,"message":"invalid attach v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"method": "attach", "params":{"options": {"channel": {"name": "alice,bob"}}}}`,
		output: `{"error":{"code":0,"message":"invalid attach v1 options: empty filename"}}`,
	},
	{
		input:  `{"method": "download", "params":{"version": 1, "options": {"message_id": 34, "channel": {"name": "a123,nfnf,t_bob"}, "output": "/tmp/file"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "download", "params":{"version": 1, "options": {"message_id": 34, "channel": {"name": "a123,nfnf,t_bob"}, "preview": true, "output": "/tmp/file"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "setstatus", "params":{"version": 1, "options": {"channel": {"name": "a123,nfnf,t_bob"}}}}`,
		output: `{"error":{"code":0,"message":"invalid setstatus v1 options: unsupported status: ''"}}`,
	},
	{
		input:  `{"method": "setstatus", "params":{"version": 1, "options": {"status": "ONTARIO", "channel": {"name": "a123,nfnf,t_bob"}}}}`,
		output: `{"error":{"code":0,"message":"invalid setstatus v1 options: unsupported status: 'ONTARIO'"}}`,
	},
	{
		input:  `{"method": "setstatus", "params":{"version": 1, "options": {"status": "ignored", "channel": {"name": "a123,nfnf,t_bob"}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"id": 30, "method": "mark", "params":{"version": 1}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid mark v1 options: empty options"}}`,
	},
	{
		input:  `{"id": 30, "method": "mark", "params":{"version": 1, "options": {"message_id": 0}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid mark v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "mark", "params":{"version": 1, "options": {"message_id": 19}}}`,
		output: `{"id":30,"error":{"code":0,"message":"invalid mark v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"id": 30, "method": "mark", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}, "message_id": 123}}}`,
		output: `{"id":30,"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "join", "params":{"version": 1, "options": {} }}`,
		output: `{"error":{"code":0,"message":"invalid newconv v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"method": "join", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "join", "params":{"version": 1, "options": {"conversation_id": "123"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "join", "params":{"version": 1, "options": {"conversation_id": "222", "channel": {"name": "alice,bob"}}}}`,
		output: `{"error":{"code":0,"message":"invalid newconv v1 options: include channel or conversation_id, not both"}}`,
	},
	{
		input:  `{"method": "leave", "params":{"version": 1, "options": {} }}`,
		output: `{"error":{"code":0,"message":"invalid newconv v1 options: need channel or conversation_id"}}`,
	},
	{
		input:  `{"method": "leave", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "leave", "params":{"version": 1, "options": {"conversation_id": "123"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "leave", "params":{"version": 1, "options": {"conversation_id": "222", "channel": {"name": "alice,bob"}}}}`,
		output: `{"error":{"code":0,"message":"invalid newconv v1 options: include channel or conversation_id, not both"}}`,
	},
	{
		input:  `{"method": "listconvsonname", "params":{"version": 1}}`,
		output: `{"error":{"code":0,"message":"invalid listconvsonname v1 options: empty options"}}`,
	},
	{
		input:  `{"method": "listconvsonname", "params":{"version": 1, "options": {"name": "alice,bob"}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "pin", "params":{"version": 1}}`,
		output: `{"error":{"code":0,"message":"invalid pin v1 options: empty options"}}`,
	},
	{
		input:  `{"method": "pin", "params":{"version": 1, "options": {"channel": {"name": "alice,bob", "message_id": 1}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "unpin", "params":{"version": 1}}`,
		output: `{"error":{"code":0,"message":"invalid unpin v1 options: empty options"}}`,
	},
	{
		input:  `{"method": "unpin", "params":{"version": 1, "options": {"channel": {"name": "alice,bob"}}}}`,
		output: `{"result":{"status":"ok"}}`,
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
		if strings.TrimSpace(buf.String()) != strings.TrimSpace(test.output) {
			t.Errorf("test %d: input %s => output %s, expected %s", i, test.input, strings.TrimSpace(buf.String()), strings.TrimSpace(test.output))
			// continue
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
	{
		input:  `{"method": "pin", "params":{"version": 1, "options": {"channel": {"name":"alice,bob", "message_id": 1}}}}`,
		output: `{"result":{"status":"ok"}}`,
	},
	{
		input:  `{"method": "unpin", "params":{"version": 1, "options": {"channel": {"name":"alice,bob"}}}}`,
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
