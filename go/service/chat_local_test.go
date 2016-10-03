// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
)

type chatTestUserContext struct {
	u *kbtest.FakeUser
	h *chatLocalHandler
}

func (tuc *chatTestUserContext) user() *kbtest.FakeUser {
	return tuc.u
}

func (tuc *chatTestUserContext) chatLocalHandler() chat1.LocalInterface {
	return tuc.h
}

type chatTestContext struct {
	world *chatMockWorld

	userContextCache map[string]*chatTestUserContext
}

func makeChatTestContext(t *testing.T, name string, numUsers int) *chatTestContext {
	ctc := &chatTestContext{}
	ctc.world = newChatMockWorld(t, name, numUsers)
	ctc.userContextCache = make(map[string]*chatTestUserContext)
	return ctc
}

func (c *chatTestContext) advanceFakeClock(d time.Duration) {
	c.world.fc.Advance(d)
}

func (c *chatTestContext) as(t *testing.T, user *kbtest.FakeUser) *chatTestUserContext {
	if user == nil {
		t.Fatalf("user is nil")
	}

	if tuc, ok := c.userContextCache[user.Username]; ok {
		return tuc
	}

	tc, ok := c.world.tcs[user.Username]
	if !ok {
		t.Fatalf("user %s is not found", user.Username)
	}
	h := newChatLocalHandler(nil, tc.G, nil)
	h.rc = newChatRemoteMock(c.world)
	h.boxer = newChatBoxer(tc.G)
	h.boxer.tlf = newTlfMock(c.world)
	tuc := &chatTestUserContext{
		h: h,
		u: user,
	}
	c.userContextCache[user.Username] = tuc
	return tuc
}

func (c *chatTestContext) cleanup() {
	c.world.cleanup()
}

func (c *chatTestContext) users() (users []*kbtest.FakeUser) {
	for _, u := range c.world.users {
		users = append(users, u)
	}
	return users
}

func mustCreateConversationForTest(t *testing.T, ctc *chatTestContext, creator *kbtest.FakeUser, topicType chat1.TopicType, others ...string) (created chat1.ConversationInfoLocal) {
	created = mustCreateConversationForTestNoAdvanceClock(t, ctc, creator, topicType, others...)
	ctc.advanceFakeClock(time.Second)
	return created
}

func mustCreateConversationForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext, creator *kbtest.FakeUser, topicType chat1.TopicType, others ...string) (created chat1.ConversationInfoLocal) {
	var err error
	ncres, err := ctc.as(t, creator).chatLocalHandler().NewConversationLocal(context.Background(), chat1.NewConversationLocalArg{
		TlfName:       strings.Join(others, ",") + "," + creator.Username,
		TopicType:     topicType,
		TlfVisibility: chat1.TLFVisibility_PRIVATE,
	})
	if err != nil {
		t.Fatalf("NewConversationLocal error: %v\n", err)
	}
	return ncres.Conv.Info
}

func mustPostLocalForTest(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) {
	mustPostLocalForTestNoAdvanceClock(t, ctc, asUser, conv, msg)
	ctc.advanceFakeClock(time.Second)
}

func mustPostLocalForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) {
	mt, err := msg.MessageType()
	if err != nil {
		t.Fatalf("msg.MessageType() error: %v\n", err)
	}
	_, err = ctc.as(t, asUser).chatLocalHandler().PostLocal(context.Background(), chat1.PostLocalArg{
		ConversationID: conv.Id,
		MessagePlaintext: chat1.NewMessagePlaintextWithV1(chat1.MessagePlaintextV1{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Triple,
				MessageType: mt,
				TlfName:     conv.TlfName,
			},
			MessageBody: msg,
		}),
	})
	if err != nil {
		t.Fatalf("PostLocal error: %v", err)
	}
}

func TestChatNewConversationLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	conv := ctc.world.getConversationByID(created.Id)
	if len(conv.MaxMsgs) == 0 {
		t.Fatalf("created conversation does not have a message")
	}
	if conv.MaxMsgs[0].ClientHeader.TlfName !=
		string(canonicalTlfNameForTest(ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username)) {
		t.Fatalf("unexpected TLF name in created conversation. expected %s, got %s", ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
}

func TestChatNewChatConversationLocalTwice(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	c1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	c2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	if c2.Id != c1.Id {
		t.Fatalf("2nd call to NewConversationLocal for a chat conversation did not return the same conversation ID")
	}
}

func TestChatNewDevConversationLocalTwice(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_DEV, ctc.as(t, users[1]).user().Username)
	mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_DEV, ctc.as(t, users[1]).user().Username)
}

func TestChatInboxLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	gilres, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxLocal(context.Background(), chat1.GetInboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			ConvID: &created.Id,
		},
	})
	if err != nil {
		t.Fatalf("GetInboxLocal error: %v", err)
	}
	conversations := gilres.Conversations
	if len(conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxLocal. expected 1 items, got %d\n", len(conversations))
	}
	conv := ctc.world.getConversationByID(created.Id)
	if conversations[0].Info.TlfName != conv.MaxMsgs[0].ClientHeader.TlfName {
		t.Fatalf("unexpected TlfName in response from GetInboxLocal. %s != %s\n", conversations[0].Info.TlfName, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
	if conversations[0].Info.Id != created.Id {
		t.Fatalf("unexpected Id in response from GetInboxLocal. %s != %s\n", conversations[0].Info.Id, created.Id)
	}
	if conversations[0].Info.Triple.TopicType != chat1.TopicType_CHAT {
		t.Fatalf("unexpected topicType in response from GetInboxLocal. %s != %s\n", conversations[0].Info.Triple.TopicType, chat1.TopicType_CHAT)
	}
}

func TestChatGetInboxLocalTlfName(t *testing.T) {
	ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	tlfName := ctc.as(t, users[1]).user().Username + "," + ctc.as(t, users[0]).user().Username // not canonical
	gilres, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxLocal(context.Background(), chat1.GetInboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			TlfName: &tlfName,
		},
	})
	if err != nil {
		t.Fatalf("ResolveConversationLocal error: %v", err)
	}
	conversations := gilres.Conversations
	if len(conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxLocal. expected 1 items, got %d\n", len(conversations))
	}
	conv := ctc.world.getConversationByID(created.Id)
	if conversations[0].Info.TlfName != conv.MaxMsgs[0].ClientHeader.TlfName {
		t.Fatalf("unexpected TlfName in response from GetInboxLocal. %s != %s\n", conversations[0].Info.TlfName, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
	if conversations[0].Info.Id != created.Id {
		t.Fatalf("unexpected Id in response from GetInboxLocal. %s != %s\n", conversations[0].Info.Id, created.Id)
	}
	if conversations[0].Info.Triple.TopicType != chat1.TopicType_CHAT {
		t.Fatalf("unexpected topicType in response from GetInboxLocal. %s != %s\n", conversations[0].Info.Triple.TopicType, chat1.TopicType_CHAT)
	}
}

func TestChatPostLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "PostLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

	// we just posted this message, so should be the first one.
	msg := ctc.world.msgs[created.Id][0]
	if len(msg.ClientHeader.Sender.Bytes()) == 0 || len(msg.ClientHeader.SenderDevice.Bytes()) == 0 {
		t.Fatalf("PostLocal didn't populate ClientHeader.Sender and/or ClientHeader.SenderDevice\n")
	}
}

func TestChatGetThreadLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "GetThreadLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

	tvres, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: created.Id,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	tv := tvres.Thread
	if len(tv.Messages) != 2 {
		t.Fatalf("unexpected response from GetThreadLocal . expected 2 items, got %d\n", len(tv.Messages))
	}
	if tv.Messages[0].Message.MessagePlaintext.V1().MessageBody.Text().Body != "hello!" {
		t.Fatalf("unexpected response from GetThreadLocal . expected 'hello!' got %#+v\n", tv.Messages[0])
	}
}

func TestChatGetThreadLocalMarkAsRead(t *testing.T) {
	ctc := makeChatTestContext(t, "GetThreadLocalMarkAsRead", 2)
	defer ctc.cleanup()
	users := ctc.users()

	withUser1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello0"}))
	mustPostLocalForTest(t, ctc, users[1], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello1"}))

	res, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryLocal error: %v", err)
	}
	if len(res.Conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 1 items, got %d\n", len(res.Conversations))
	}

	var found bool
	for _, m := range res.Conversations[0].MaxMessages {
		if m.Message.ServerHeader.MessageType == chat1.MessageType_TEXT {
			if res.Conversations[0].ReaderInfo.ReadMsgid == m.Message.ServerHeader.MessageID {
				t.Fatalf("conversation was not marked as read\n")
			}
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("no TEXT message in returned inbox")
	}

	tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: withUser1.Id,
		Query: &chat1.GetThreadQuery{
			MarkAsRead:   true,
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		},
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(tv.Thread.Messages) != 2 {
		t.Fatalf("unexpected response from GetThreadLocal. expected 2 items, got %d\n", len(tv.Thread.Messages))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryLocal error: %v", err)
	}
	if len(res.Conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 1 items, got %d\n", len(res.Conversations))
	}

	found = false
	for _, m := range res.Conversations[0].MaxMessages {
		if m.Message.ServerHeader.MessageType == chat1.MessageType_TEXT {
			if res.Conversations[0].ReaderInfo.ReadMsgid != m.Message.ServerHeader.MessageID {
				t.Fatalf("conversation was not marked as read\n")
			}
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("no TEXT message in returned inbox")
	}
}

func TestChatGracefulUnboxing(t *testing.T) {
	ctc := makeChatTestContext(t, "GracefulUnboxing", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "innocent hello"}))
	mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "evil hello"}))

	// make evil hello evil
	ctc.world.msgs[created.Id][0].BodyCiphertext.E[0]++

	tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: created.Id,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(tv.Thread.Messages) != 3 {
		t.Fatalf("unexpected response from GetThreadLocal. expected 3 items, got %d\n", len(tv.Thread.Messages))
	}
	if tv.Thread.Messages[0].Message != nil ||
		tv.Thread.Messages[0].UnboxingError == nil || len(*tv.Thread.Messages[0].UnboxingError) == 0 {
		t.Fatalf("unexpected response from GetThreadLocal. expected an error message from bad msg, got %#+v\n", tv.Thread.Messages[0])
	}
	if tv.Thread.Messages[1].Message == nil || tv.Thread.Messages[1].Message.MessagePlaintext.V1().MessageBody.Text().Body != "innocent hello" {
		t.Fatalf("unexpected response from GetThreadLocal. expected 'innocent hello' got %#+v\n", tv.Thread.Messages[1].Message)
	}
}

func TestChatGetInboxSummaryLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "GetInboxSummaryLocal", 4)
	defer ctc.cleanup()
	users := ctc.users()

	withUser1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello0"}))
	mustPostLocalForTest(t, ctc, users[1], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello1"}))

	withUser2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[2]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], withUser2, chat1.NewMessageBodyWithText(chat1.MessageText{Body: fmt.Sprintf("Dude I just said hello to %s!", ctc.as(t, users[2]).user().Username)}))

	withUser3 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[3]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], withUser3, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "O_O"}))

	withUser12 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username, ctc.as(t, users[2]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], withUser12, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "O_O"}))

	withUser123 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username, ctc.as(t, users[2]).user().Username, ctc.as(t, users[3]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], withUser123, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "O_O"}))

	res, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		After:     "1d",
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryLocal error: %v", err)
	}
	if len(res.Conversations) != 5 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 3 items, got %d\n", len(res.Conversations))
	}
	if res.Conversations[0].Info.Id != withUser123.Id {
		t.Fatalf("unexpected response from GetInboxSummaryLocal; newest updated conversation is not the first in response.\n")
	}
	// TODO: fix this when merging master back in
	if len(res.Conversations[0].MaxMessages) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 messages in the first conversation, got %d\n", len(res.Conversations[0].MaxMessages))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		ActivitySortedLimit: 2,
		TopicType:           chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryLocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 items, got %d\n", len(res.Conversations))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		ActivitySortedLimit: 2,
		TopicType:           chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryLocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 items, got %d\n", len(res.Conversations))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		UnreadFirst: true,
		UnreadFirstLimit: chat1.UnreadFirstNumLimit{
			AtLeast: 0,
			AtMost:  1000,
			NumRead: 1,
		},
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryLocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 items, got %d\n", len(res.Conversations))
	}
	if res.Conversations[0].Info.Id != withUser1.Id {
		t.Fatalf("unexpected response from GetInboxSummaryLocal; unread conversation is not the first in response.\n")
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		UnreadFirst: true,
		UnreadFirstLimit: chat1.UnreadFirstNumLimit{
			AtLeast: 0,
			AtMost:  2,
			NumRead: 5,
		},
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryLocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 1 items, got %d\n", len(res.Conversations))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		UnreadFirst: true,
		UnreadFirstLimit: chat1.UnreadFirstNumLimit{
			AtLeast: 3,
			AtMost:  100,
			NumRead: 0,
		},
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryLocal error: %v", err)
	}
	if len(res.Conversations) != 3 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 1 items, got %d\n", len(res.Conversations))
	}
}
