// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func makeChatLocalHandlerForTest(t *testing.T, name string) (h *chatLocalHandler, tc libkb.TestContext, world *chatMockWorld, mock *chatRemoteMock) {
	tc = externals.SetupTest(t, "chat_local_test_"+name, 0)
	u, err := kbtest.CreateAndSignupFakeUser("chat", tc.G)
	if err != nil {
		t.Fatalf("CreateAndSignupFakeUser error: %v\n", err)
	}
	world = newChatMockWorld(u)
	mock = newChatRemoteMock(world)
	h = newChatLocalHandler(nil, tc.G, nil)
	h.rc = mock
	h.boxer = &chatBoxer{
		tlf:          newTlfMock(world),
		Contextified: libkb.NewContextified(tc.G),
	}
	return h, tc, world, mock
}

func TestNewConversationLocal(t *testing.T) {
	h, tc, world, _ := makeChatLocalHandlerForTest(t, "TheTest")
	defer tc.Cleanup()

	created, err := h.NewConversationLocal(context.Background(), keybase1.ConversationInfoLocal{
		TlfName:   world.me.Username + ",t_alice",
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("NewConversationLocal error: %v\n", err)
	}

	conversations, err := h.ResolveConversationLocal(context.Background(), keybase1.ConversationInfoLocal{
		Id: created.Id,
	})
	if err != nil {
		t.Fatalf("ResolveConversationLocal error: %v", err)
	}
	if len(conversations) != 1 {
		t.Fatalf("unexpected response from ResolveConversationLocal. expected 1 items, got %d\n", len(conversations))
	}
}

func TestPostLocal(t *testing.T) {
	h, tc, world, _ := makeChatLocalHandlerForTest(t, "TheTest")
	defer tc.Cleanup()

	created, err := h.NewConversationLocal(context.Background(), keybase1.ConversationInfoLocal{
		TlfName:   world.me.Username + ",t_alice",
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("NewConversationLocal error: %v\n", err)
	}

	err = h.PostLocal(context.Background(), keybase1.PostLocalArg{
		ConversationID: created.Id,
		MessagePlaintext: keybase1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				// Conv omitted
				MessageType: chat1.MessageType_TEXT,
				TlfName:     created.TlfName,
			},
			MessageBodies: []keybase1.MessageBody{
				keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: "hello!"}),
			},
		},
	})
	if err != nil {
		t.Fatalf("PostLocal error: %v", err)
	}

	tv, err := h.GetThreadLocal(context.Background(), keybase1.GetThreadLocalArg{
		ConversationID: created.Id,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(tv.Messages) != 2 {
		t.Fatalf("unexpected response from GetThreadLocal . expected 2 items, got %d\n", len(tv.Messages))
	}
	if tv.Messages[0].MessagePlaintext.MessageBodies[0].Text().Body != "hello!" {
		t.Fatalf("unexpected response from GetThreadLocal . expected 'hello!' got %#+v\n", tv.Messages[0])
	}
}
