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
	mock  *chatRemoteMock

	userContextCache map[string]*chatTestUserContext
}

func makeChatTestContext(t *testing.T, name string, numUsers int) *chatTestContext {
	ctc := &chatTestContext{}
	ctc.world = newChatMockWorld(t, name, numUsers)
	ctc.mock = newChatRemoteMock(ctc.world)
	ctc.userContextCache = make(map[string]*chatTestUserContext)
	return ctc
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
	h.rc = c.mock
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

func mustCreateConversationForTest(t *testing.T, creator *chatTestUserContext, topicType chat1.TopicType, others ...string) (created chat1.ConversationInfoLocal) {
	var err error
	created, err = creator.chatLocalHandler().NewConversationLocal(context.Background(), chat1.ConversationInfoLocal{
		TlfName:   strings.Join(others, ",") + "," + creator.user().Username,
		TopicType: topicType,
	})
	if err != nil {
		t.Fatalf("NewConversationLocal error: %v\n", err)
	}
	return created
}

func mustPostLocalForTest(t *testing.T, author *chatTestUserContext, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) {
	mt, err := msg.MessageType()
	if err != nil {
		t.Fatalf("msg.MessageType() error: %v\n", err)
	}
	err = author.chatLocalHandler().PostLocal(context.Background(), chat1.PostLocalArg{
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

func TestNewConversationLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	conv := ctc.mock.getConversationByID(created.Id)
	if len(conv.MaxMsgs) == 0 {
		t.Fatalf("created conversation does not have a message")
	}
	if conv.MaxMsgs[0].ClientHeader.TlfName !=
		string(canonicalTlfNameForTest(ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username)) {
		t.Fatalf("unexpected TLF name in created conversation. expected %s, got %s", ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
}

func TestNewChatConversationLocalTwice(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	c1 := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	c2 := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	if c2.Id != c1.Id {
		t.Fatalf("2nd call to NewConversationLocal for a chat conversation did not return the same conversation ID")
	}
}

func TestNewDevConversationLocalTwice(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_DEV, ctc.as(t, users[1]).user().Username)
	mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_DEV, ctc.as(t, users[1]).user().Username)
}

func TestResolveConversationLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	conversations, err := ctc.as(t, users[0]).chatLocalHandler().ResolveConversationLocal(context.Background(), chat1.ConversationInfoLocal{
		Id: created.Id,
	})
	if err != nil {
		t.Fatalf("ResolveConversationLocal error: %v", err)
	}
	if len(conversations) != 1 {
		t.Fatalf("unexpected response from ResolveConversationLocal. expected 1 items, got %d\n", len(conversations))
	}
	conv := ctc.mock.getConversationByID(created.Id)
	if conversations[0].TlfName != conv.MaxMsgs[0].ClientHeader.TlfName {
		t.Fatalf("unexpected TlfName in response from ResolveConversationLocal. %s != %s\n", conversations[0].TlfName, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
	if conversations[0].Id != created.Id {
		t.Fatalf("unexpected Id in response from ResolveConversationLocal. %s != %s\n", conversations[0].Id, created.Id)
	}
	if conversations[0].TopicType != chat1.TopicType_CHAT {
		t.Fatalf("unexpected topicType in response from ResolveConversationLocal. %s != %s\n", conversations[0].TopicType, chat1.TopicType_CHAT)
	}
}

func TestResolveConversationLocalTlfName(t *testing.T) {
	ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	conversations, err := ctc.as(t, users[0]).chatLocalHandler().ResolveConversationLocal(context.Background(), chat1.ConversationInfoLocal{
		TlfName: ctc.as(t, users[1]).user().Username + "," + ctc.as(t, users[0]).user().Username, // not canonical
	})
	if err != nil {
		t.Fatalf("ResolveConversationLocal error: %v", err)
	}
	if len(conversations) != 1 {
		t.Fatalf("unexpected response from ResolveConversationLocal. expected 1 item, got %d\n", len(conversations))
	}
	conv := ctc.mock.getConversationByID(created.Id)
	if conversations[0].TlfName != conv.MaxMsgs[0].ClientHeader.TlfName {
		t.Fatalf("unexpected TlfName in response from ResolveConversationLocal. %s != %s\n", conversations[0].TlfName, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
	if conversations[0].Id != created.Id {
		t.Fatalf("unexpected Id in response from ResolveConversationLocal. %s != %s\n", conversations[0].Id, created.Id)
	}
	if conversations[0].TopicType != chat1.TopicType_CHAT {
		t.Fatalf("unexpected topicType in response from ResolveConversationLocal. %s != %s\n", conversations[0].TopicType, chat1.TopicType_CHAT)
	}
}

func TestPostLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "PostLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc.as(t, users[0]), created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

	// we just posted this message, so should be the first one.
	msg := ctc.mock.msgs[created.Id][0]
	if len(msg.ClientHeader.Sender.Bytes()) == 0 || len(msg.ClientHeader.SenderDevice.Bytes()) == 0 {
		t.Fatalf("PostLocal didn't populate ClientHeader.Sender and/or ClientHeader.SenderDevice\n")
	}
}

func TestGetThreadLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "GetThreadLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc.as(t, users[0]), created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

	tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: created.Id,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(tv.Messages) != 2 {
		t.Fatalf("unexpected response from GetThreadLocal . expected 2 items, got %d\n", len(tv.Messages))
	}
	if tv.Messages[0].MessagePlaintext.V1().MessageBody.Text().Body != "hello!" {
		t.Fatalf("unexpected response from GetThreadLocal . expected 'hello!' got %#+v\n", tv.Messages[0])
	}
}

func TestGetInboxSummaryLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "GetInboxSummaryLocal", 4)
	defer ctc.cleanup()
	users := ctc.users()

	withAlice := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc.as(t, users[0]), withAlice, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

	time.Sleep(time.Millisecond)

	withBob := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[2]).user().Username)
	mustPostLocalForTest(t, ctc.as(t, users[0]), withBob, chat1.NewMessageBodyWithText(chat1.MessageText{Body: fmt.Sprintf("Dude I just said hello to %s!", ctc.as(t, users[2]).user().Username)}))

	time.Sleep(time.Millisecond)

	withCharlie := mustCreateConversationForTest(t, ctc.as(t, users[0]), chat1.TopicType_CHAT, ctc.as(t, users[3]).user().Username)
	mustPostLocalForTest(t, ctc.as(t, users[0]), withCharlie, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "O_O"}))

	res, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		After:     "1d",
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(res.Conversations) != 3 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 3 items, got %d\n", len(res.Conversations))
	}
	if res.Conversations[0].Info.Id != withCharlie.Id {
		t.Fatalf("unexpected response from GetInboxSummaryLocal; newest updated conversation is not the first in response.\n")
	}
	if len(res.Conversations[0].Messages) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 messages in the first conversation, got %d\n", len(res.Conversations[0].Messages))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalQuery{
		ActivitySortedLimit: 2,
		TopicType:           chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 items, got %d\n", len(res.Conversations))
	}
}
