// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type chatTestContext struct {
	h     *chatLocalHandler
	tc    libkb.TestContext
	world *chatMockWorld
	mock  *chatRemoteMock
}

func makeChatTestContext(t *testing.T, name string) (ctc chatTestContext) {
	ctc.tc = externals.SetupTest(t, "chat_local_test_"+name, 0)
	u, err := kbtest.CreateAndSignupFakeUser("chat", ctc.tc.G)
	if err != nil {
		t.Fatalf("CreateAndSignupFakeUser error: %v\n", err)
	}
	ctc.world = newChatMockWorld(u)
	ctc.mock = newChatRemoteMock(ctc.world)
	ctc.h = newChatLocalHandler(nil, ctc.tc.G, nil)
	ctc.h.rc = ctc.mock
	ctc.h.boxer = &chatBoxer{
		tlf:          newTlfMock(ctc.world),
		Contextified: libkb.NewContextified(ctc.tc.G),
	}
	return ctc
}

func mustCreateConversationForTest(t *testing.T, ctc chatTestContext, topicType chat1.TopicType, others ...string) (created keybase1.ConversationInfoLocal) {
	var err error
	created, err = ctc.h.NewConversationLocal(context.Background(), keybase1.ConversationInfoLocal{
		TlfName:   strings.Join(others, ",") + "," + ctc.world.me.Username,
		TopicType: topicType,
	})
	if err != nil {
		t.Fatalf("NewConversationLocal error: %v\n", err)
	}
	return created
}

func TestNewConversationLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal")
	defer ctc.tc.Cleanup()

	created := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")

	conv := ctc.mock.getConversationByID(created.Id)
	if len(conv.MaxMsgs) == 0 {
		t.Fatalf("created conversation does not have a message")
	}
	if conv.MaxMsgs[0].ClientHeader.TlfName != ctc.world.me.Username+",t_alice" {
		t.Fatalf("unexpected TLF name in created conversation. expected %s, got %s", ctc.world.me.Username+",t_alice", conv.MaxMsgs[0].ClientHeader.TlfName)
	}
}

func TestResolveConversationLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "ResolveConversationLocal")
	defer ctc.tc.Cleanup()

	created := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")

	conversations, err := ctc.h.ResolveConversationLocal(context.Background(), keybase1.ConversationInfoLocal{
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

func mustPostLocalForTest(t *testing.T, ctc chatTestContext, conv keybase1.ConversationInfoLocal, msg keybase1.MessageBody) {
	mt, err := msg.MessageType()
	if err != nil {
		t.Fatalf("msg.MessageType() error: %v\n", err)
	}
	err = ctc.h.PostLocal(context.Background(), keybase1.PostLocalArg{
		ConversationID: conv.Id,
		MessagePlaintext: keybase1.NewMessagePlaintextWithV1(keybase1.MessagePlaintextV1{
			ClientHeader: chat1.MessageClientHeader{
				// Conv omitted
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

func TestPostLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "PostLocal")
	defer ctc.tc.Cleanup()

	created := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")
	mustPostLocalForTest(t, ctc, created, keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: "hello!"}))

	// we just posted this message, so should be the first one.
	msg := ctc.mock.msgs[created.Id][0]
	if len(msg.ClientHeader.Sender.Bytes()) == 0 && len(msg.ClientHeader.SenderDevice.Bytes()) == 0 {
		t.Fatalf("PostLocal didn't populate ClientHeader.Sender and/or ClientHeader.SenderDevice\n")
	}

	// TODO: enable this after we implement in service
	/* if msg.ClientHeader.Conv == chat1.ConversationIDTriple{} {
	 * 	 t.Fatalf("PostLocal didn't populate ClientHeader.Conv\n")
	 * }
	 */
}

func TestGetThreadLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "GetThreadLocal")
	defer ctc.tc.Cleanup()

	created := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")
	mustPostLocalForTest(t, ctc, created, keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: "hello!"}))

	tv, err := ctc.h.GetThreadLocal(context.Background(), keybase1.GetThreadLocalArg{
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
	ctc := makeChatTestContext(t, "GetInboxSummaryLocal")
	defer ctc.tc.Cleanup()

	withAlice := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")
	mustPostLocalForTest(t, ctc, withAlice, keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: "hello!"}))

	time.Sleep(time.Millisecond)

	withBob := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_bob")
	mustPostLocalForTest(t, ctc, withBob, keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: "Dude I just said hello to Alice!"}))

	time.Sleep(time.Millisecond)

	withCharlie := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_charlie")
	mustPostLocalForTest(t, ctc, withCharlie, keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: "O_O"}))

	res, err := ctc.h.GetInboxSummaryLocal(context.Background(), keybase1.GetInboxSummaryLocalArg{
		After:     "1d",
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(res.Conversations) != 3 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 3 items, got %d\n", len(res.Conversations))
	}
	if res.Conversations[0].Id != withCharlie.Id {
		t.Fatalf("unexpected response from GetInboxSummaryLocal; newest updated conversation is not the first in response.\n")
	}
	if len(res.Conversations[0].Messages) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 messages in the first conversation, got %d\n", len(res.Conversations[0].Messages))
	}

	res, err = ctc.h.GetInboxSummaryLocal(context.Background(), keybase1.GetInboxSummaryLocalArg{
		Limit:     2,
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 items, got %d\n", len(res.Conversations))
	}
}
