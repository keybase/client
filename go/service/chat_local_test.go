// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
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
	world *kbtest.ChatMockWorld

	userContextCache map[string]*chatTestUserContext
}

func makeChatTestContext(t *testing.T, name string, numUsers int) *chatTestContext {
	ctc := &chatTestContext{}
	ctc.world = kbtest.NewChatMockWorld(t, name, numUsers)
	ctc.userContextCache = make(map[string]*chatTestUserContext)
	return ctc
}

func (c *chatTestContext) advanceFakeClock(d time.Duration) {
	c.world.Fc.Advance(d)
}

func (c *chatTestContext) as(t *testing.T, user *kbtest.FakeUser) *chatTestUserContext {
	if user == nil {
		t.Fatalf("user is nil")
	}

	if tuc, ok := c.userContextCache[user.Username]; ok {
		return tuc
	}

	tc, ok := c.world.Tcs[user.Username]
	if !ok {
		t.Fatalf("user %s is not found", user.Username)
	}
	h := newChatLocalHandler(nil, tc.G, nil)
	mockRemote := kbtest.NewChatRemoteMock(c.world)
	h.tlf = kbtest.NewTlfMock(c.world)
	h.boxer = chat.NewBoxer(tc.G, h.tlf, h.udc)
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: user.Passphrase}
	}
	storage := storage.New(tc.G, f)
	tc.G.ConvSource = chat.NewHybridConversationSource(tc.G, h.boxer, storage, mockRemote)
	h.setTestRemoteClient(mockRemote)

	tuc := &chatTestUserContext{
		h: h,
		u: user,
	}
	c.userContextCache[user.Username] = tuc
	return tuc
}

func (c *chatTestContext) cleanup() {
	c.world.Cleanup()
}

func (c *chatTestContext) users() (users []*kbtest.FakeUser) {
	for _, u := range c.world.Users {
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

func postLocalForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) (chat1.PostLocalRes, error) {
	mt, err := msg.MessageType()
	if err != nil {
		t.Fatalf("msg.MessageType() error: %v\n", err)
	}
	return ctc.as(t, asUser).chatLocalHandler().PostLocal(context.Background(), chat1.PostLocalArg{
		ConversationID: conv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Triple,
				MessageType: mt,
				TlfName:     conv.TlfName,
			},
			MessageBody: msg,
		},
	})
}

func postLocalForTest(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) (chat1.PostLocalRes, error) {
	defer ctc.advanceFakeClock(time.Second)
	return postLocalForTestNoAdvanceClock(t, ctc, asUser, conv, msg)
}

func mustPostLocalForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) {
	_, err := postLocalForTestNoAdvanceClock(t, ctc, asUser, conv, msg)
	if err != nil {
		t.Fatalf("PostLocal error: %v", err)
	}
}

func mustPostLocalForTest(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) {
	mustPostLocalForTestNoAdvanceClock(t, ctc, asUser, conv, msg)
	ctc.advanceFakeClock(time.Second)
}

func TestChatNewConversationLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	conv := ctc.world.GetConversationByID(created.Id)
	if len(conv.MaxMsgs) == 0 {
		t.Fatalf("created conversation does not have a message")
	}
	if conv.MaxMsgs[0].ClientHeader.TlfName !=
		string(kbtest.CanonicalTlfNameForTest(ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username)) {
		t.Fatalf("unexpected TLF name in created conversation. expected %s, got %s", ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
}

func TestChatNewChatConversationLocalTwice(t *testing.T) {
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	c1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	c2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	if !c2.Id.Eq(c1.Id) {
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

func TestChatGetInboxAndUnboxLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	gilres, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(context.Background(), chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			ConvID: &created.Id,
		},
	})
	if err != nil {
		t.Fatalf("GetInboxAndUnboxLocal error: %v", err)
	}
	conversations := gilres.Conversations
	if len(conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxAndUnboxLocal. expected 1 items, got %d\n", len(conversations))
	}
	conv := ctc.world.GetConversationByID(created.Id)
	if conversations[0].Info.TlfName != conv.MaxMsgs[0].ClientHeader.TlfName {
		t.Fatalf("unexpected TlfName in response from GetInboxAndUnboxLocal. %s != %s\n", conversations[0].Info.TlfName, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
	if !conversations[0].Info.Id.Eq(created.Id) {
		t.Fatalf("unexpected Id in response from GetInboxAndUnboxLocal. %s != %s\n", conversations[0].Info.Id, created.Id)
	}
	if conversations[0].Info.Triple.TopicType != chat1.TopicType_CHAT {
		t.Fatalf("unexpected topicType in response from GetInboxAndUnboxLocal. %s != %s\n", conversations[0].Info.Triple.TopicType, chat1.TopicType_CHAT)
	}
}

func TestChatGetInboxAndUnboxLocalTlfName(t *testing.T) {
	ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	tlfName := ctc.as(t, users[1]).user().Username + "," + ctc.as(t, users[0]).user().Username // not canonical
	gilres, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(context.Background(), chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			TlfName: &tlfName,
		},
	})
	if err != nil {
		t.Fatalf("ResolveConversationLocal error: %v", err)
	}
	conversations := gilres.Conversations
	if len(conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxAndUnboxLocal. expected 1 items, got %d\n", len(conversations))
	}
	conv := ctc.world.GetConversationByID(created.Id)
	if conversations[0].Info.TlfName != conv.MaxMsgs[0].ClientHeader.TlfName {
		t.Fatalf("unexpected TlfName in response from GetInboxAndUnboxLocal. %s != %s\n", conversations[0].Info.TlfName, conv.MaxMsgs[0].ClientHeader.TlfName)
	}
	if !conversations[0].Info.Id.Eq(created.Id) {
		t.Fatalf("unexpected Id in response from GetInboxAndUnboxLocal. %s != %s\n", conversations[0].Info.Id, created.Id)
	}
	if conversations[0].Info.Triple.TopicType != chat1.TopicType_CHAT {
		t.Fatalf("unexpected topicType in response from GetInboxAndUnboxLocal. %s != %s\n", conversations[0].Info.Triple.TopicType, chat1.TopicType_CHAT)
	}
}

func TestChatPostLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "PostLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	// un-canonicalize TLF name
	parts := strings.Split(created.TlfName, ",")
	sort.Sort(sort.Reverse(sort.StringSlice(parts)))
	created.TlfName = strings.Join(parts, ",")

	mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

	// we just posted this message, so should be the first one.
	msg := ctc.world.Msgs[created.Id.String()][0]

	if msg.ClientHeader.TlfName == created.TlfName {
		t.Fatalf("PostLocal didn't canonicalize TLF name")
	}

	if len(msg.ClientHeader.Sender.Bytes()) == 0 || len(msg.ClientHeader.SenderDevice.Bytes()) == 0 {
		t.Fatalf("PostLocal didn't populate ClientHeader.Sender and/or ClientHeader.SenderDevice\n")
	}
}

func TestChatPostLocalLengthLimit(t *testing.T) {
	ctc := makeChatTestContext(t, "PostLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)

	maxTextBody := strings.Repeat(".", msgchecker.TextMessageMaxLength)
	_, err := postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: maxTextBody}))
	if err != nil {
		t.Fatalf("trying to post a text message with body length equal to the maximum failed")
	}
	_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: maxTextBody + "!"}))
	if err == nil {
		t.Fatalf("trying to post a text message with body length greater than the maximum did not fail")
	}

	maxHeadlineBody := strings.Repeat(".", msgchecker.HeadlineMaxLength)
	_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: maxHeadlineBody}))
	if err != nil {
		t.Fatalf("trying to post a headline message with headline length equal to the maximum failed")
	}
	_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: maxHeadlineBody + "!"}))
	if err == nil {
		t.Fatalf("trying to post a headline message with headline length greater than the maximum did not fail")
	}

	maxTopicBody := strings.Repeat(".", msgchecker.TopicMaxLength)
	_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: maxTopicBody}))
	if err != nil {
		t.Fatalf("trying to post a ConversationMetadata message with ConversationTitle length equal to the maximum failed")
	}
	_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: maxTopicBody + "!"}))
	if err == nil {
		t.Fatalf("trying to post a ConversationMetadata message with ConversationTitle length greater than the maximum did not fail")
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
	if tv.Messages[0].Valid().MessageBody.Text().Body != "hello!" {
		t.Fatalf("unexpected response from GetThreadLocal . expected 'hello!' got %#+v\n", tv.Messages[0])
	}
}

func TestChatGetThreadLocalMarkAsRead(t *testing.T) {
	// TODO: investigate LocalDb in TestContext and make it behave the same way
	// as in real context / docker tests. This test should fail without the fix
	// in ConvSource for marking is read, but does not currently.
	ctc := makeChatTestContext(t, "GetThreadLocalMarkAsRead", 2)
	defer ctc.cleanup()
	users := ctc.users()

	withUser1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello0"}))
	mustPostLocalForTest(t, ctc, users[1], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello1"}))
	mustPostLocalForTest(t, ctc, users[0], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello2"}))

	res, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(context.Background(), chat1.GetInboxSummaryForCLILocalQuery{
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
	}
	if len(res.Conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 1 items, got %d\n", len(res.Conversations))
	}
	if res.Conversations[0].Info.Id.String() != withUser1.Id.String() {
		t.Fatalf("unexpected conversation returned. Expect %s, got %s", withUser1.Id.String(), res.Conversations[0].Info.Id.String())
	}

	var found bool
	for _, m := range res.Conversations[0].MaxMessages {
		if m.GetMessageType() == chat1.MessageType_TEXT {
			if res.Conversations[0].ReaderInfo.ReadMsgid == m.GetMessageID() {
				t.Fatalf("conversation was marked as read before requesting so\n")
			}
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("no TEXT message in returned inbox")
	}

	// Do a get thread local without requesting marking as read first. This
	// should cause HybridConversationSource to cache the thread. Then we do
	// another call requesting marking as read before checking if the thread is
	// marked as read. This is to ensure that when the query requests for a
	// mark-as-read, and the thread gets a cache hit, the
	// HybridConversationSource should not just return the thread, but also send
	// a MarkAsRead RPC to remote. (Currently this is done in
	// HybridConversationSource.Pull)
	//
	// TODO: This doesn't make sense! In integration tests, this isn't necessary
	// since a Pull() is called during PostLocal (when populating the Prev
	// pointers).  However it seems in this test, it doesn't do so. This first
	// GetThreadLocal always gets a cache miss, resulting a remote call. If
	// PostLocal had worked like integration, this shouldn't be necessary. We
	// should find out where the problem is and fix it! Although after that fix,
	// this should probably still stay here just in case.
	_, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: withUser1.Id,
		Query: &chat1.GetThreadQuery{
			MarkAsRead: false,
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: withUser1.Id,
		Query: &chat1.GetThreadQuery{
			MarkAsRead: true,
		},
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(tv.Thread.Messages) != 4 {
		// 3 messages and 1 TLF
		t.Fatalf("unexpected response from GetThreadLocal. expected 2 items, got %d\n", len(tv.Thread.Messages))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(context.Background(), chat1.GetInboxSummaryForCLILocalQuery{
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
	}
	if len(res.Conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 1 items, got %d\n", len(res.Conversations))
	}

	found = false
	for _, m := range res.Conversations[0].MaxMessages {
		if m.GetMessageType() == chat1.MessageType_TEXT {
			if res.Conversations[0].ReaderInfo.ReadMsgid != m.GetMessageID() {
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
	ctc.world.Tcs[users[0].Username].G.ConvSource.Clear(created.Id, users[0].User.GetUID().ToBytes())
	ctc.world.Msgs[created.Id.String()][0].BodyCiphertext.E[0]++

	tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: created.Id,
	})
	if err != nil {
		t.Fatalf("GetThreadLocal error: %v", err)
	}
	if len(tv.Thread.Messages) != 3 {
		t.Fatalf("unexpected response from GetThreadLocal. expected 3 items, got %d\n", len(tv.Thread.Messages))
	}
	if tv.Thread.Messages[0].IsValid() || len(tv.Thread.Messages[0].Error().ErrMsg) == 0 {
		t.Fatalf("unexpected response from GetThreadLocal. expected an error message from bad msg, got %#+v\n", tv.Thread.Messages[0])
	}
	if !tv.Thread.Messages[1].IsValid() || tv.Thread.Messages[1].Valid().MessageBody.Text().Body != "innocent hello" {
		t.Fatalf("unexpected response from GetThreadLocal. expected 'innocent hello' got %#+v\n", tv.Thread.Messages[1].Valid())
	}
}

func TestChatGetInboxSummaryForCLILocal(t *testing.T) {
	ctc := makeChatTestContext(t, "GetInboxSummaryForCLILocal", 4)
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

	res, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(context.Background(), chat1.GetInboxSummaryForCLILocalQuery{
		After:     "1d",
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
	}
	if len(res.Conversations) != 5 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 3 items, got %d\n", len(res.Conversations))
	}
	if !res.Conversations[0].Info.Id.Eq(withUser123.Id) {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal; newest updated conversation is not the first in response.\n")
	}
	// TODO: fix this when merging master back in
	if len(res.Conversations[0].MaxMessages) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 2 messages in the first conversation, got %d\n", len(res.Conversations[0].MaxMessages))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(context.Background(), chat1.GetInboxSummaryForCLILocalQuery{
		ActivitySortedLimit: 2,
		TopicType:           chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 2 items, got %d\n", len(res.Conversations))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(context.Background(), chat1.GetInboxSummaryForCLILocalQuery{
		ActivitySortedLimit: 2,
		TopicType:           chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 2 items, got %d\n", len(res.Conversations))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(context.Background(), chat1.GetInboxSummaryForCLILocalQuery{
		UnreadFirst: true,
		UnreadFirstLimit: chat1.UnreadFirstNumLimit{
			AtLeast: 0,
			AtMost:  1000,
			NumRead: 1,
		},
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 2 items, got %d\n", len(res.Conversations))
	}
	if !res.Conversations[0].Info.Id.Eq(withUser1.Id) {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal; unread conversation is not the first in response.\n")
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(context.Background(), chat1.GetInboxSummaryForCLILocalQuery{
		UnreadFirst: true,
		UnreadFirstLimit: chat1.UnreadFirstNumLimit{
			AtLeast: 0,
			AtMost:  2,
			NumRead: 5,
		},
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
	}
	if len(res.Conversations) != 2 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 1 items, got %d\n", len(res.Conversations))
	}

	res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(context.Background(), chat1.GetInboxSummaryForCLILocalQuery{
		UnreadFirst: true,
		UnreadFirstLimit: chat1.UnreadFirstNumLimit{
			AtLeast: 3,
			AtMost:  100,
			NumRead: 0,
		},
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
	}
	if len(res.Conversations) != 3 {
		t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 1 items, got %d\n", len(res.Conversations))
	}
}

func TestGetMessagesLocal(t *testing.T) {
	ctc := makeChatTestContext(t, "GetMessagesLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "Sometimes you eat the bar"}))
	mustPostLocalForTest(t, ctc, users[1], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "and sometimes"}))
	mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "the bar eats you."}))

	// GetMessagesLocal currently seems to return messages descending ID order.
	// It would probably be good if this changed to return either in req order or ascending.
	getIDs := []chat1.MessageID{3, 2, 1}

	res, err := ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(context.Background(), chat1.GetMessagesLocalArg{
		ConversationID: created.Id,
		MessageIDs:     getIDs,
	})
	if err != nil {
		t.Fatalf("GetMessagesLocal error: %v", err)
	}
	for i, msg := range res.Messages {
		if !msg.IsValid() {
			t.Fatalf("Missing message: %v", getIDs[i])
		}
		msgID := msg.GetMessageID()
		if msgID != getIDs[i] {
			t.Fatalf("Wrong message ID: got %v but expected %v", msgID, getIDs[i])
		}
	}
	if len(res.Messages) != len(getIDs) {
		t.Fatalf("GetMessagesLocal got %v items but expected %v", len(res.Messages), len(getIDs))
	}
}

func extractOutbox(t *testing.T, msgs []chat1.MessageUnboxed) []chat1.MessageUnboxed {
	var routbox []chat1.MessageUnboxed
	for _, msg := range msgs {
		typ, err := msg.State()
		require.NoError(t, err)
		if typ == chat1.MessageUnboxedState_OUTBOX {
			routbox = append(routbox, msg)
		}
	}
	return routbox
}

func TestGetOutbox(t *testing.T) {
	ctc := makeChatTestContext(t, "GetOutbox", 3)
	defer ctc.cleanup()
	users := ctc.users()

	var err error
	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[1]).user().Username)
	created2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, ctc.as(t, users[2]).user().Username)

	u := users[0]
	h := ctc.as(t, users[0]).h
	tc := ctc.world.Tcs[ctc.as(t, users[0]).user().Username]
	outbox := storage.NewOutbox(tc.G, users[0].User.GetUID().ToBytes(), h.getSecretUI)

	obid, err := outbox.PushMessage(created.Id, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Sender:    u.User.GetUID().ToBytes(),
			TlfName:   u.Username,
			TlfPublic: false,
			OutboxInfo: &chat1.OutboxInfo{
				Prev: 10,
			},
		},
	})
	require.NoError(t, err)

	thread, err := h.GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: created.Id,
	})
	require.NoError(t, err)

	routbox := extractOutbox(t, thread.Thread.Messages)
	require.Equal(t, 1, len(routbox), "wrong size outbox")
	require.Equal(t, obid, routbox[0].Outbox().OutboxID, "wrong outbox ID")

	thread, err = h.GetThreadLocal(context.Background(), chat1.GetThreadLocalArg{
		ConversationID: created2.Id,
	})
	require.NoError(t, err)
	routbox = extractOutbox(t, thread.Thread.Messages)
	require.Equal(t, 0, len(routbox), "non empty outbox")

}
