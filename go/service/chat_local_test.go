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
	ctc.h.boxer = newChatBoxer(ctc.tc.G)
	ctc.h.boxer.tlf = newTlfMock(ctc.world)
	return ctc
}

func mustCreateConversationForTest(t *testing.T, ctc chatTestContext, topicType chat1.TopicType, others ...string) (created chat1.ConversationInfoLocal) {
	var err error
	created, err = ctc.h.NewConversationLocal(context.Background(), chat1.ConversationInfoLocal{
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

func TestNewChatConversationLocalTwice(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal")
	defer ctc.tc.Cleanup()

	c1 := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")
	c2 := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")

	if c2.Id != c1.Id {
		t.Fatalf("2nd call to NewConversationLocal for a chat conversation did not return the same conversation ID")
	}
}

func TestNewDevConversationLocalTwice(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal")
	defer ctc.tc.Cleanup()

	mustCreateConversationForTest(t, ctc, chat1.TopicType_DEV, "t_alice")
	mustCreateConversationForTest(t, ctc, chat1.TopicType_DEV, "t_alice")
}

func TestResolveConversationLocal(t *testing.T) {
	t.Skip("this needs to be fixed")
	ctc := makeChatTestContext(t, "ResolveConversationLocal")
	defer ctc.tc.Cleanup()

	created := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")

	conversations, err := ctc.h.ResolveConversationLocal(context.Background(), chat1.ConversationInfoLocal{
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
	ctc := makeChatTestContext(t, "ResolveConversationLocal")
	defer ctc.tc.Cleanup()

	created := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")

	conversations, err := ctc.h.ResolveConversationLocal(context.Background(), chat1.ConversationInfoLocal{
		TlfName: "t_alice" + "," + ctc.world.me.Username, // not canonical
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

func mustPostLocalForTest(t *testing.T, ctc chatTestContext, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) {
	mt, err := msg.MessageType()
	if err != nil {
		t.Fatalf("msg.MessageType() error: %v\n", err)
	}
	err = ctc.h.PostLocal(context.Background(), chat1.PostLocalArg{
		ConversationID: conv.Id,
		MessagePlaintext: chat1.NewMessagePlaintextWithV1(chat1.MessagePlaintextV1{
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
	mustPostLocalForTest(t, ctc, created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

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
	mustPostLocalForTest(t, ctc, created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

	tv, err := ctc.h.GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
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
	t.Skip("this needs to be fixed")
	ctc := makeChatTestContext(t, "GetInboxSummaryLocal")
	defer ctc.tc.Cleanup()

	withAlice := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_alice")
	mustPostLocalForTest(t, ctc, withAlice, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

	time.Sleep(time.Millisecond)

	withBob := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_bob")
	mustPostLocalForTest(t, ctc, withBob, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "Dude I just said hello to Alice!"}))

	time.Sleep(time.Millisecond)

	withCharlie := mustCreateConversationForTest(t, ctc, chat1.TopicType_CHAT, "t_charlie")
	mustPostLocalForTest(t, ctc, withCharlie, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "O_O"}))

	res, err := ctc.h.GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalArg{
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

	res, err = ctc.h.GetInboxSummaryLocal(context.Background(), chat1.GetInboxSummaryLocalArg{
		Limit: chat1.NumLimit{
			AtMost: 2,
		},
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryLocal . expected 2 items, got %d\n", len(res.Conversations))
	}
}
