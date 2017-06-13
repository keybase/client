// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package chat

import (
	"encoding/hex"
	"fmt"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func newTestContext(tc *kbtest.ChatTestContext) context.Context {
	return Context(context.Background(), tc.Context(), keybase1.TLFIdentifyBehavior_CHAT_CLI,
		nil, NewIdentifyNotifier(tc.Context()))
}

func newTestContextWithTlfMock(tc *kbtest.ChatTestContext, tlfMock types.NameInfoSource) context.Context {
	ctx := newTestContext(tc)
	CtxKeyFinder(ctx, tc.Context()).SetNameInfoSourceOverride(tlfMock)
	return ctx
}

type testUISource struct {
}

func (t testUISource) GetChatUI(sessionID int) libkb.ChatUI {
	return nil
}

func (t testUISource) GetStreamUICli() *keybase1.StreamUiClient {
	return &keybase1.StreamUiClient{Cli: nil}
}

// Create a team with me as the owner
func createTeam(tc libkb.TestContext) string {
	b, err := libkb.RandBytes(4)
	if err != nil {
		tc.T.Fatal(err)
	}
	name := hex.EncodeToString(b)
	err = teams.CreateRootTeam(context.TODO(), tc.G, name)
	if err != nil {
		tc.T.Fatal(err)
	}
	return name
}

// Create a team with me as the owner and writers as writers.
// Writers must not include me.
func createTeamWithWriters(tc libkb.TestContext, writers []*kbtest.FakeUser) string {
	name := createTeam(tc)
	for _, u := range writers {
		err := teams.SetRoleWriter(context.TODO(), tc.G, name, u.Username)
		require.NoError(tc.T, err, "team set role")
	}
	return name
}

type byUsername []*kbtest.FakeUser

func (b byUsername) Len() int      { return len(b) }
func (b byUsername) Swap(i, j int) { b[i], b[j] = b[j], b[i] }
func (b byUsername) Less(i, j int) bool {
	return strings.Compare(b[i].Username, b[j].Username) < 0
}

func teamKey(users []*kbtest.FakeUser) (res string) {
	ucopy := make([]*kbtest.FakeUser, len(users))
	copy(ucopy, users)
	sort.Sort(byUsername(ucopy))
	for _, u := range ucopy {
		res += u.Username
	}
	return res
}

var useTLFMock = true

func runWithMemberTypes(t *testing.T, f func(membersType chat1.ConversationMembersType)) {
	useTLFMock = true
	start := time.Now()
	t.Logf("KBFS Stage Begin")
	f(chat1.ConversationMembersType_KBFS)
	t.Logf("KBFS Stage End: %v", time.Now().Sub(start))
	useTLFMock = false
	t.Logf("Team Stage Begin")
	start = time.Now()
	f(chat1.ConversationMembersType_TEAM)
	t.Logf("Team Stage End: %v", time.Now().Sub(start))
	useTLFMock = true
}

type chatTestUserContext struct {
	startCtx context.Context
	u        *kbtest.FakeUser
	h        *Server
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
	teamCache        map[string]string
}

func makeChatTestContext(t *testing.T, name string, numUsers int) *chatTestContext {
	ctc := &chatTestContext{}
	ctc.world = kbtest.NewChatMockWorld(t, name, numUsers)
	ctc.userContextCache = make(map[string]*chatTestUserContext)
	ctc.teamCache = make(map[string]string)
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
	g := globals.NewContext(tc.G, tc.ChatG)
	h := NewServer(g, nil, nil, testUISource{})
	mockRemote := kbtest.NewChatRemoteMock(c.world)
	mockRemote.SetCurrentUser(user.User.GetUID().ToBytes())

	var ctx context.Context
	tlf := kbtest.NewTlfMock(c.world)
	if useTLFMock {
		ctx = newTestContextWithTlfMock(tc, tlf)
	} else {
		ctx = newTestContext(tc)
	}

	h.boxer = NewBoxer(g)

	chatStorage := storage.New(g)
	g.ConvSource = NewHybridConversationSource(g, h.boxer, chatStorage,
		func() chat1.RemoteInterface { return mockRemote })
	g.InboxSource = NewHybridInboxSource(g, func() chat1.RemoteInterface { return mockRemote })
	g.ServerCacheVersions = storage.NewServerVersions(g)
	chatSyncer := NewSyncer(g)
	g.Syncer = chatSyncer
	g.ConnectivityMonitor = &libkb.NullConnectivityMonitor{}

	h.setTestRemoteClient(mockRemote)

	baseSender := NewBlockingSender(g, h.boxer, nil, func() chat1.RemoteInterface { return mockRemote })
	deliverer := NewDeliverer(g, baseSender)
	deliverer.SetClock(c.world.Fc)
	if useTLFMock {
		deliverer.setTestingNameInfoSource(tlf)
	}
	g.MessageDeliverer = deliverer
	g.MessageDeliverer.Start(context.TODO(), user.User.GetUID().ToBytes())
	g.MessageDeliverer.Connected(context.TODO())

	retrier := NewFetchRetrier(g)
	retrier.SetClock(c.world.Fc)
	g.FetchRetrier = retrier
	g.FetchRetrier.Connected(context.TODO())
	g.FetchRetrier.Start(context.TODO(), user.User.GetUID().ToBytes())

	tuc := &chatTestUserContext{
		h:        h,
		u:        user,
		startCtx: ctx,
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

func mustCreatePublicConversationForTest(t *testing.T, ctc *chatTestContext, creator *kbtest.FakeUser,
	topicType chat1.TopicType, membersType chat1.ConversationMembersType, others ...*kbtest.FakeUser) (created chat1.ConversationInfoLocal) {
	created = mustCreateConversationForTestNoAdvanceClock(t, ctc, creator, topicType,
		chat1.TLFVisibility_PUBLIC, membersType, others...)
	ctc.advanceFakeClock(time.Second)
	return created
}

func mustCreateConversationForTest(t *testing.T, ctc *chatTestContext, creator *kbtest.FakeUser,
	topicType chat1.TopicType, membersType chat1.ConversationMembersType, others ...*kbtest.FakeUser) (created chat1.ConversationInfoLocal) {
	created = mustCreateConversationForTestNoAdvanceClock(t, ctc, creator, topicType,
		chat1.TLFVisibility_PRIVATE, membersType, others...)
	ctc.advanceFakeClock(time.Second)
	return created
}

func mustCreateConversationForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext,
	creator *kbtest.FakeUser, topicType chat1.TopicType, visibility chat1.TLFVisibility,
	membersType chat1.ConversationMembersType, others ...*kbtest.FakeUser) (created chat1.ConversationInfoLocal) {
	var err error

	t.Logf("mustCreateConversationForTestNoAdvanceClock")
	t.Logf("creator: %v", creator.Username)
	for _, o := range others {
		t.Logf("other: %v", o.Username)
	}

	// Create conversation name based on list of users
	var name string
	switch membersType {
	case chat1.ConversationMembersType_KBFS:
		var memberStr []string
		for _, other := range others {
			memberStr = append(memberStr, other.Username)
		}
		memberStr = append(memberStr, creator.Username)
		name = strings.Join(memberStr, ",")
	case chat1.ConversationMembersType_TEAM:
		tc := ctc.world.Tcs[creator.Username]
		users := append(others, creator)
		key := teamKey(users)
		if tn, ok := ctc.teamCache[key]; !ok {
			name = createTeamWithWriters(tc.TestContext, others)
			ctc.teamCache[key] = name
		} else {
			name = tn
		}
	}

	tc := ctc.as(t, creator)
	ncres, err := tc.chatLocalHandler().NewConversationLocal(tc.startCtx,
		chat1.NewConversationLocalArg{
			TlfName:       name,
			TopicType:     topicType,
			TlfVisibility: visibility,
			MembersType:   membersType,
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
	tc := ctc.as(t, asUser)
	return ctc.as(t, asUser).chatLocalHandler().PostLocal(tc.startCtx, chat1.PostLocalArg{
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
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "NewConversationLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())

		conv := ctc.world.GetConversationByID(created.Id)
		if len(conv.MaxMsgs) == 0 {
			t.Fatalf("created conversation does not have a message")
		}

		switch mt {
		case chat1.ConversationMembersType_KBFS:
			if conv.MaxMsgs[0].ClientHeader.TlfName !=
				string(kbtest.CanonicalTlfNameForTest(ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username)) {
				t.Fatalf("unexpected TLF name in created conversation. expected %s, got %s", ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username, conv.MaxMsgs[0].ClientHeader.TlfName)
			}
		case chat1.ConversationMembersType_TEAM:
			teamName := ctc.teamCache[teamKey(ctc.users())]
			require.Equal(t, teamName, conv.MaxMsgs[0].ClientHeader.TlfName)
		}
	})
}

func TestChatNewChatConversationLocalTwice(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "NewConversationLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		c1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		c2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		t.Logf("c1: %v c2: %v", c1, c2)
		if !c2.Id.Eq(c1.Id) {
			t.Fatalf("2nd call to NewConversationLocal for a chat conversation did not return the same conversation ID")
		}
	})
}

func TestChatNewDevConversationLocalTwice(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "NewConversationLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_DEV,
			mt, ctc.as(t, users[1]).user())
		mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_DEV,
			mt, ctc.as(t, users[1]).user())
	})
}

func TestChatGetInboxAndUnboxLocal(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		ctx := ctc.as(t, users[0]).startCtx
		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		gilres, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{created.Id},
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
	})
}

func TestGetInboxNonblock(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetInboxNonblockLocal", 6)
		defer ctc.cleanup()
		users := ctc.users()

		numconvs := 5
		inboxCb := make(chan kbtest.NonblockInboxResult, 100)
		threadCb := make(chan kbtest.NonblockThreadResult, 100)
		ui := kbtest.NewChatUI(inboxCb, threadCb)
		ctc.as(t, users[0]).h.mockChatUI = ui

		// Create a bunch of blank convos
		convs := make(map[string]bool)
		for i := 0; i < numconvs; i++ {
			created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
				mt, ctc.as(t, users[i+1]).user())
			convs[created.Id.String()] = true
		}

		ctx := ctc.as(t, users[0]).startCtx
		t.Logf("blank convos test")
		// Get inbox (should be blank)
		_, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
			chat1.GetInboxNonblockLocalArg{
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			},
		)
		require.NoError(t, err)
		select {
		case ibox := <-inboxCb:
			require.NotNil(t, ibox.InboxRes, "nil inbox")
			require.Zero(t, len(ibox.InboxRes.ConversationsUnverified), "wrong size inbox")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no inbox received")
		}
		// Get all convos
		for i := 0; i < numconvs; i++ {
			select {
			case conv := <-inboxCb:
				require.NotNil(t, conv.ConvRes, "no conv")
				delete(convs, conv.ConvID.String())
			case <-time.After(20 * time.Second):
				require.Fail(t, "no conv received")
			}
		}
		require.Equal(t, 0, len(convs), "didnt get all convs")

		// Send a bunch of messages
		t.Logf("messages in convos test")
		convs = make(map[string]bool)
		for i := 0; i < numconvs; i++ {
			conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
				mt, ctc.as(t, users[i+1]).user())
			convs[conv.Id.String()] = true

			_, err := ctc.as(t, users[0]).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
				ConversationID: conv.Id,
				Msg: chat1.MessagePlaintext{
					ClientHeader: chat1.MessageClientHeader{
						Conv:        conv.Triple,
						MessageType: chat1.MessageType_TEXT,
						TlfName:     conv.TlfName,
					},
					MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
						Body: "HI",
					}),
				},
			})
			require.NoError(t, err)
		}

		// Get inbox (should be blank)
		_, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
			chat1.GetInboxNonblockLocalArg{
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			},
		)
		require.NoError(t, err)
		select {
		case ibox := <-inboxCb:
			require.NotNil(t, ibox.InboxRes, "nil inbox")
			require.Equal(t, len(convs), len(ibox.InboxRes.ConversationsUnverified), "wrong size inbox")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no inbox received")
		}
		// Get all convos
		for i := 0; i < numconvs; i++ {
			select {
			case conv := <-inboxCb:
				require.NotNil(t, conv.ConvRes, "no conv")
				delete(convs, conv.ConvID.String())
			case <-time.After(20 * time.Second):
				require.Fail(t, "no conv received")
			}
		}
		require.Equal(t, 0, len(convs), "didnt get all convs")

		// Make sure there is nothing left
		select {
		case <-inboxCb:
			require.Fail(t, "should have drained channel")
		default:
		}
	})
}

func TestChatGetInboxAndUnboxLocalTlfName(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		var name string
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			name = ctc.as(t, users[1]).user().Username + "," + ctc.as(t, users[0]).user().Username // not canonical
		case chat1.ConversationMembersType_TEAM:
			name = ctc.teamCache[teamKey(ctc.users())]
		}

		visibility := chat1.TLFVisibility_PRIVATE
		ctx := ctc.as(t, users[0]).startCtx
		gilres, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				Name: &chat1.NameQuery{
					Name:        name,
					MembersType: mt,
				},
				TlfVisibility: &visibility,
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
	})
}

func TestChatPostLocal(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "PostLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		// un-canonicalize TLF name
		t.Logf("TLF name: %s", created.TlfName)
		parts := strings.Split(created.TlfName, ",")
		sort.Sort(sort.Reverse(sort.StringSlice(parts)))
		created.TlfName = strings.Join(parts, ",")

		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

		// we just posted this message, so should be the first one.
		msg := ctc.world.Msgs[created.Id.String()][0]

		if mt == chat1.ConversationMembersType_KBFS {
			require.NotEqual(t, created.TlfName, msg.ClientHeader.TlfName)
		}
		require.NotZero(t, len(msg.ClientHeader.Sender.Bytes()))
		require.NotZero(t, len(msg.ClientHeader.SenderDevice.Bytes()))
	})
}

func TestChatPostLocalLengthLimit(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "PostLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

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
	})
}

func TestChatGetThreadLocal(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetThreadLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))

		ctx := ctc.as(t, users[0]).startCtx
		tvres, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
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
	})
}

func TestChatGetThreadLocalMarkAsRead(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// TODO: investigate LocalDb in TestContext and make it behave the same way
		// as in real context / docker tests. This test should fail without the fix
		// in ConvSource for marking is read, but does not currently.
		ctc := makeChatTestContext(t, "GetThreadLocalMarkAsRead", 2)
		defer ctc.cleanup()
		users := ctc.users()

		withUser1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		mustPostLocalForTest(t, ctc, users[0], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello0"}))
		mustPostLocalForTest(t, ctc, users[1], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello1"}))
		mustPostLocalForTest(t, ctc, users[0], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello2"}))

		ctx := ctc.as(t, users[0]).startCtx
		res, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
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
		_, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: withUser1.Id,
			Query: &chat1.GetThreadQuery{
				MarkAsRead: false,
			},
		})
		if err != nil {
			t.Fatal(err)
		}

		tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
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

		res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
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
	})
}

func TestChatGracefulUnboxing(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GracefulUnboxing", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "innocent hello"}))
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "evil hello"}))

		// make evil hello evil
		ctc.world.Tcs[users[0].Username].ChatG.ConvSource.Clear(created.Id, users[0].User.GetUID().ToBytes())
		ctc.world.Msgs[created.Id.String()][0].BodyCiphertext.E[0]++

		ctx := ctc.as(t, users[0]).startCtx
		tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
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
	})
}

func TestChatGetInboxSummaryForCLILocal(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetInboxSummaryForCLILocal", 4)
		defer ctc.cleanup()
		users := ctc.users()

		withUser1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		mustPostLocalForTest(t, ctc, users[0], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello0"}))
		mustPostLocalForTest(t, ctc, users[1], withUser1, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello1"}))

		withUser2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[2]).user())
		mustPostLocalForTest(t, ctc, users[0], withUser2, chat1.NewMessageBodyWithText(chat1.MessageText{Body: fmt.Sprintf("Dude I just said hello to %s!", ctc.as(t, users[2]).user().Username)}))

		withUser3 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[3]).user())
		mustPostLocalForTest(t, ctc, users[0], withUser3, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "O_O"}))

		withUser12 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())
		mustPostLocalForTest(t, ctc, users[0], withUser12, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "O_O"}))

		withUser123 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user(), ctc.as(t, users[3]).user())
		mustPostLocalForTest(t, ctc, users[0], withUser123, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "O_O"}))

		ctx := ctc.as(t, users[0]).startCtx
		res, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
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
			for i, m := range res.Conversations[0].MaxMessages {
				t.Logf("%d: %+v", i, m.Valid())
			}
			t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 2 messages in the first conversation, got %d\n", len(res.Conversations[0].MaxMessages))
		}

		res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
			ActivitySortedLimit: 2,
			TopicType:           chat1.TopicType_CHAT,
		})
		if err != nil {
			t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
		}
		if len(res.Conversations) != 2 {
			t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 2 items, got %d\n", len(res.Conversations))
		}

		res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
			ActivitySortedLimit: 2,
			TopicType:           chat1.TopicType_CHAT,
		})
		if err != nil {
			t.Fatalf("GetInboxSummaryForCLILocal error: %v", err)
		}
		if len(res.Conversations) != 2 {
			t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 2 items, got %d\n", len(res.Conversations))
		}

		res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
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

		res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
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

		res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
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
	})
}

func TestGetMessagesLocal(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetMessagesLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "Sometimes you eat the bar"}))
		mustPostLocalForTest(t, ctc, users[1], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "and sometimes"}))
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "the bar eats you."}))

		// GetMessagesLocal currently seems to return messages descending ID order.
		// It would probably be good if this changed to return either in req order or ascending.
		getIDs := []chat1.MessageID{3, 2, 1}

		ctx := ctc.as(t, users[0]).startCtx
		res, err := ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(ctx, chat1.GetMessagesLocalArg{
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
	})
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
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetOutbox", 3)
		defer ctc.cleanup()
		users := ctc.users()

		var err error
		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		created2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[2]).user())

		u := users[0]
		h := ctc.as(t, users[0]).h
		ctx := ctc.as(t, users[0]).startCtx
		tc := ctc.world.Tcs[ctc.as(t, users[0]).user().Username]
		outbox := storage.NewOutbox(tc.Context(), users[0].User.GetUID().ToBytes())

		obr, err := outbox.PushMessage(ctx, created.Id, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Sender:    u.User.GetUID().ToBytes(),
				TlfName:   u.Username,
				TlfPublic: false,
				OutboxInfo: &chat1.OutboxInfo{
					Prev: 10,
				},
			},
		}, keybase1.TLFIdentifyBehavior_CHAT_CLI)
		require.NoError(t, err)

		thread, err := h.GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: created.Id,
		})
		require.NoError(t, err)

		routbox := extractOutbox(t, thread.Thread.Messages)
		require.Equal(t, 1, len(routbox), "wrong size outbox")
		require.Equal(t, obr.OutboxID, routbox[0].Outbox().OutboxID, "wrong outbox ID")

		thread, err = h.GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: created2.Id,
		})
		require.NoError(t, err)
		routbox = extractOutbox(t, thread.Thread.Messages)
		require.Equal(t, 0, len(routbox), "non empty outbox")
	})
}

func TestChatGap(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetOutbox", 2)
		defer ctc.cleanup()
		users := ctc.users()

		var err error
		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		res, err := postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "Sometimes you eat the bar"}))
		require.NoError(t, err)

		u := users[0]
		h := ctc.as(t, users[0]).h
		ctx := ctc.as(t, users[0]).startCtx
		tc := ctc.world.Tcs[ctc.as(t, users[0]).user().Username]
		msgID := res.MessageID
		mres, err := h.remoteClient().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
			ConversationID: created.Id,
			MessageIDs:     []chat1.MessageID{msgID},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(mres.Msgs), "no msg returned")

		ooMsg := mres.Msgs[0]
		ooMsg.ServerHeader.MessageID = 4

		payload := chat1.NewMessagePayload{
			Action:  "newMessage",
			ConvID:  created.Id,
			Message: ooMsg,
		}

		listener := newServerChatListener()
		tc.G.SetService()
		tc.G.NotifyRouter.SetListener(listener)

		mh := codec.MsgpackHandle{WriteExt: true}
		var data []byte
		enc := codec.NewEncoderBytes(&data, &mh)
		require.NoError(t, enc.Encode(payload))
		ph := NewPushHandler(tc.Context())
		require.NoError(t, ph.Activity(ctx, &gregor1.OutOfBandMessage{
			Uid_:    u.User.GetUID().ToBytes(),
			System_: "chat.activity",
			Body_:   data,
		}))

		select {
		case cids := <-listener.threadsStale:
			require.Equal(t, []chat1.ConversationID{created.Id}, cids, "wrong cids")
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to receive stale event")
		}

		ooMsg.ServerHeader.MessageID = 5
		payload = chat1.NewMessagePayload{
			Action:  "newMessage",
			ConvID:  created.Id,
			Message: ooMsg,
		}
		enc = codec.NewEncoderBytes(&data, &mh)
		require.NoError(t, enc.Encode(payload))
		require.NoError(t, ph.Activity(ctx, &gregor1.OutOfBandMessage{
			Uid_:    u.User.GetUID().ToBytes(),
			System_: "chat.activity",
			Body_:   data,
		}))

		select {
		case <-listener.threadsStale:
			require.Fail(t, "should not get stale event here")
		default:
		}
	})
}

type serverChatListener struct {
	newMessage   chan chat1.MessageUnboxed
	threadsStale chan []chat1.ConversationID
	inboxStale   chan struct{}
}

func (n *serverChatListener) Logout()                                                             {}
func (n *serverChatListener) Login(username string)                                               {}
func (n *serverChatListener) ClientOutOfDate(to, uri, msg string)                                 {}
func (n *serverChatListener) UserChanged(uid keybase1.UID)                                        {}
func (n *serverChatListener) TrackingChanged(uid keybase1.UID, username libkb.NormalizedUsername) {}
func (n *serverChatListener) FSActivity(activity keybase1.FSNotification)                         {}
func (n *serverChatListener) FSEditListResponse(arg keybase1.FSEditListArg)                       {}
func (n *serverChatListener) FSEditListRequest(arg keybase1.FSEditListRequest)                    {}
func (n *serverChatListener) FSSyncStatusResponse(arg keybase1.FSSyncStatusArg)                   {}
func (n *serverChatListener) FSSyncEvent(arg keybase1.FSPathSyncStatus)                           {}
func (n *serverChatListener) PaperKeyCached(uid keybase1.UID, encKID, sigKID keybase1.KID)        {}
func (n *serverChatListener) FavoritesChanged(uid keybase1.UID)                                   {}
func (n *serverChatListener) KeyfamilyChanged(uid keybase1.UID)                                   {}
func (n *serverChatListener) PGPKeyInSecretStoreFile()                                            {}
func (n *serverChatListener) BadgeState(badgeState keybase1.BadgeState)                           {}
func (n *serverChatListener) ReachabilityChanged(r keybase1.Reachability)                         {}
func (n *serverChatListener) ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks)  {}
func (n *serverChatListener) TeamKeyRotated(teamID keybase1.TeamID, teamName string)              {}
func (n *serverChatListener) ChatTLFFinalize(uid keybase1.UID, convID chat1.ConversationID, info chat1.ConversationFinalizeInfo) {
}
func (n *serverChatListener) ChatTLFResolve(uid keybase1.UID, convID chat1.ConversationID, info chat1.ConversationResolveInfo) {
}
func (n *serverChatListener) ChatInboxStale(uid keybase1.UID) {
	n.inboxStale <- struct{}{}
}
func (n *serverChatListener) ChatThreadsStale(uid keybase1.UID, cids []chat1.ConversationID) {
	n.threadsStale <- cids
}
func (n *serverChatListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity) {
	typ, _ := activity.ActivityType()
	if typ == chat1.ChatActivityType_INCOMING_MESSAGE {
		n.newMessage <- activity.IncomingMessage().Message
	}
}
func (n *serverChatListener) ChatTypingUpdate(updates []chat1.ConvTypingUpdate) {
}

func newServerChatListener() *serverChatListener {
	return &serverChatListener{
		newMessage:   make(chan chat1.MessageUnboxed, 100),
		threadsStale: make(chan []chat1.ConversationID, 100),
		inboxStale:   make(chan struct{}, 100),
	}
}

func TestPostLocalNonblock(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "PostLocalNonblock", 2)
		defer ctc.cleanup()
		users := ctc.users()

		var err error
		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener)

		t.Logf("send a text message")
		arg := chat1.PostTextNonblockArg{
			ConversationID:   created.Id,
			Conv:             created.Triple,
			TlfName:          created.TlfName,
			TlfPublic:        created.Visibility == chat1.TLFVisibility_PUBLIC,
			Body:             "hi",
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		tc := ctc.as(t, users[0])
		res, err := ctc.as(t, users[0]).chatLocalHandler().PostTextNonblock(tc.startCtx, arg)
		require.NoError(t, err)
		var unboxed chat1.MessageUnboxed
		select {
		case unboxed = <-listener.newMessage:
			require.True(t, unboxed.IsValid(), "invalid message")
			require.NotNil(t, unboxed.Valid().ClientHeader.OutboxID, "no outbox ID")
			require.Equal(t, res.OutboxID, *unboxed.Valid().ClientHeader.OutboxID, "mismatch outbox ID")
			require.Equal(t, chat1.MessageType_TEXT, unboxed.GetMessageType(), "invalid type")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no event received")
		}

		t.Logf("edit the message")
		earg := chat1.PostEditNonblockArg{
			ConversationID:   created.Id,
			Conv:             created.Triple,
			TlfName:          created.TlfName,
			TlfPublic:        created.Visibility == chat1.TLFVisibility_PUBLIC,
			Supersedes:       unboxed.GetMessageID(),
			Body:             "hi2",
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		res, err = ctc.as(t, users[0]).chatLocalHandler().PostEditNonblock(tc.startCtx, earg)
		require.NoError(t, err)
		select {
		case unboxed = <-listener.newMessage:
			require.True(t, unboxed.IsValid(), "invalid message")
			require.NotNil(t, unboxed.Valid().ClientHeader.OutboxID, "no outbox ID")
			require.Equal(t, res.OutboxID, *unboxed.Valid().ClientHeader.OutboxID, "mismatch outbox ID")
			require.Equal(t, chat1.MessageType_EDIT, unboxed.GetMessageType(), "invalid type")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no event received")
		}

		t.Logf("delete the message")
		darg := chat1.PostDeleteNonblockArg{
			ConversationID:   created.Id,
			Conv:             created.Triple,
			TlfName:          created.TlfName,
			TlfPublic:        created.Visibility == chat1.TLFVisibility_PUBLIC,
			Supersedes:       unboxed.GetMessageID(),
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		res, err = ctc.as(t, users[0]).chatLocalHandler().PostDeleteNonblock(tc.startCtx, darg)
		require.NoError(t, err)
		select {
		case unboxed = <-listener.newMessage:
			require.True(t, unboxed.IsValid(), "invalid message")
			require.NotNil(t, unboxed.Valid().ClientHeader.OutboxID, "no outbox ID")
			require.Equal(t, res.OutboxID, *unboxed.Valid().ClientHeader.OutboxID, "mismatch outbox ID")
			require.Equal(t, chat1.MessageType_DELETE, unboxed.GetMessageType(), "invalid type")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no event received")
		}
	})
}

func TestFindConversations(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// XXX: Public chats can't work with teams yet
		if mt == chat1.ConversationMembersType_TEAM {
			return
		}
		ctc := makeChatTestContext(t, "FindConversations", 3)
		defer ctc.cleanup()
		users := ctc.users()

		t.Logf("basic test")
		created := mustCreatePublicConversationForTest(t, ctc, users[2], chat1.TopicType_CHAT,
			mt, users[1])
		convRemote := ctc.world.GetConversationByID(created.Id)
		require.NotNil(t, convRemote)
		convRemote.Metadata.Visibility = chat1.TLFVisibility_PUBLIC
		convRemote.Metadata.ActiveList =
			[]gregor1.UID{users[2].User.GetUID().ToBytes(), users[1].User.GetUID().ToBytes()}

		ctx := ctc.as(t, users[0]).startCtx
		ctx2 := ctc.as(t, users[2]).startCtx
		res, err := ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          created.TlfName,
				MembersType:      mt,
				Visibility:       chat1.TLFVisibility_PUBLIC,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Conversations), "no conv found")
		require.Equal(t, created.Id, res.Conversations[0].GetConvID(), "wrong conv")

		t.Logf("simple post")
		_, err = ctc.as(t, users[2]).chatLocalHandler().PostLocal(ctx2, chat1.PostLocalArg{
			ConversationID:   created.Id,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        created.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     created.TlfName,
					TlfPublic:   true,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "PUBLIC",
				}),
			},
		})
		require.NoError(t, err)

		t.Logf("read from conversation")
		tres, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID:   res.Conversations[0].GetConvID(),
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(tres.Thread.Messages), "wrong length")

		t.Logf("test topic name")
		_, err = ctc.as(t, users[2]).chatLocalHandler().PostLocal(ctx2, chat1.PostLocalArg{
			ConversationID:   created.Id,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        created.Triple,
					MessageType: chat1.MessageType_METADATA,
					TlfName:     created.TlfName,
					TlfPublic:   true,
				},
				MessageBody: chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
					ConversationTitle: "MIKE",
				}),
			},
		})
		require.NoError(t, err)

		res, err = ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          created.TlfName,
				MembersType:      mt,
				Visibility:       chat1.TLFVisibility_PUBLIC,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		require.Equal(t, 0, len(res.Conversations), "conv found")

		res, err = ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          created.TlfName,
				MembersType:      mt,
				Visibility:       chat1.TLFVisibility_PUBLIC,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				TopicName:        "MIKE",
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Conversations), "conv found")
		require.Equal(t, created.Id, res.Conversations[0].GetConvID(), "wrong conv")
	})
}

func receiveThreadResult(t *testing.T, cb chan kbtest.NonblockThreadResult) (res *chat1.ThreadView) {
	var tres kbtest.NonblockThreadResult
	select {
	case tres = <-cb:
		res = tres.Thread
	case <-time.After(20 * time.Second):
		require.Fail(t, "no thread received")
	}
	if !tres.Full {
		select {
		case tres = <-cb:
			require.True(t, tres.Full)
			res = tres.Thread
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread received")
		}
	}
	return res
}

func TestGetThreadNonblock(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetThreadNonblock", 1)
		defer ctc.cleanup()
		users := ctc.users()

		inboxCb := make(chan kbtest.NonblockInboxResult, 100)
		threadCb := make(chan kbtest.NonblockThreadResult, 100)
		ui := kbtest.NewChatUI(inboxCb, threadCb)
		ctc.as(t, users[0]).h.mockChatUI = ui

		t.Logf("test empty thread")
		query := chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}
		ctx := ctc.as(t, users[0]).startCtx
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
			chat1.GetThreadNonblockArg{
				ConversationID:   conv.Id,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				Query:            &query,
			},
		)
		require.NoError(t, err)
		res := receiveThreadResult(t, threadCb)
		require.Zero(t, len(res.Messages))

		t.Logf("send a bunch of messages")
		numMsgs := 20
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		for i := 0; i < numMsgs; i++ {
			mustPostLocalForTest(t, ctc, users[0], conv, msg)
		}

		t.Logf("read back full thread")
		_, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
			chat1.GetThreadNonblockArg{
				ConversationID:   conv.Id,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				Query:            &query,
			},
		)
		require.NoError(t, err)
		res = receiveThreadResult(t, threadCb)
		require.Equal(t, numMsgs, len(res.Messages))

		t.Logf("read back with a delay on the local pull")
		delay := time.Hour * 800
		ctc.as(t, users[0]).h.cachedThreadDelay = &delay
		_, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
			chat1.GetThreadNonblockArg{
				ConversationID:   conv.Id,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				Query:            &query,
			},
		)
		require.NoError(t, err)
		res = receiveThreadResult(t, threadCb)
		require.Equal(t, numMsgs, len(res.Messages))
	})
}

func TestGetThreadNonblockError(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetThreadNonblock", 1)
		defer ctc.cleanup()
		users := ctc.users()

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener)

		uid := users[0].User.GetUID().ToBytes()
		inboxCb := make(chan kbtest.NonblockInboxResult, 100)
		threadCb := make(chan kbtest.NonblockThreadResult, 100)
		ui := kbtest.NewChatUI(inboxCb, threadCb)
		ctc.as(t, users[0]).h.mockChatUI = ui

		query := chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		numMsgs := 20
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		for i := 0; i < numMsgs; i++ {
			mustPostLocalForTest(t, ctc, users[0], conv, msg)
		}
		require.NoError(t, ctc.world.Tcs[users[0].Username].ChatG.ConvSource.Clear(conv.Id, uid))
		g := ctc.world.Tcs[users[0].Username].ChatG
		g.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return chat1.RemoteClient{Cli: errorClient{}}
		})

		ctx := ctc.as(t, users[0]).startCtx
		_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
			chat1.GetThreadNonblockArg{
				ConversationID:   conv.Id,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				Query:            &query,
			},
		)
		require.Error(t, err)

		// Advance clock and look for stale
		g.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return kbtest.NewChatRemoteMock(ctc.world)
		})
		ctc.world.Fc.Advance(time.Hour)

		select {
		case cids := <-listener.threadsStale:
			require.Equal(t, 1, len(cids))
		case <-time.After(2 * time.Second):
			require.Fail(t, "no threads stale message received")
		}
	})
}

func TestGetInboxNonblockError(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetInboxNonblockLocal", 1)
		defer ctc.cleanup()
		users := ctc.users()

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener)

		uid := users[0].User.GetUID().ToBytes()
		inboxCb := make(chan kbtest.NonblockInboxResult, 100)
		threadCb := make(chan kbtest.NonblockThreadResult, 100)
		ui := kbtest.NewChatUI(inboxCb, threadCb)
		ctc.as(t, users[0]).h.mockChatUI = ui

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		numMsgs := 20
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		for i := 0; i < numMsgs; i++ {
			mustPostLocalForTest(t, ctc, users[0], conv, msg)
		}
		require.NoError(t, ctc.world.Tcs[users[0].Username].ChatG.ConvSource.Clear(conv.Id, uid))
		g := ctc.world.Tcs[users[0].Username].Context()
		g.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return chat1.RemoteClient{Cli: errorClient{}}
		})

		ctx := ctc.as(t, users[0]).startCtx
		_, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
			chat1.GetInboxNonblockLocalArg{
				Query: &chat1.GetInboxLocalQuery{
					ConvIDs: []chat1.ConversationID{conv.Id},
				},
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)

		// Eat untrusted CB
		select {
		case <-inboxCb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "no untrusted inbox")
		}

		select {
		case nbres := <-inboxCb:
			require.Error(t, nbres.Err)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no inbox load event")
		}

		// Advance clock and look for stale
		g.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return kbtest.NewChatRemoteMock(ctc.world)
		})
		ctc.world.Fc.Advance(time.Hour)

		select {
		case cids := <-listener.threadsStale:
			require.Equal(t, 1, len(cids))
		case <-time.After(20 * time.Second):
			require.Fail(t, "no threads stale message received")
		}

		t.Logf("testing untrusted inbox load failure")
		ttype := chat1.TopicType_CHAT
		require.NoError(t, storage.NewInbox(g, uid).Clear(context.TODO()))
		g.InboxSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return chat1.RemoteClient{Cli: errorClient{}}
		})
		query := &chat1.GetInboxLocalQuery{
			TopicType: &ttype,
		}
		p := &chat1.Pagination{Num: 10}
		_, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
			chat1.GetInboxNonblockLocalArg{
				Query:            query,
				Pagination:       p,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.Error(t, err)
		g.InboxSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return kbtest.NewChatRemoteMock(ctc.world)
		})
		ctc.world.Fc.Advance(time.Hour)
		select {
		case <-listener.inboxStale:
		case <-time.After(20 * time.Second):
			require.Fail(t, "no threads stale message received")
		}
		select {
		case cids := <-listener.threadsStale:
			require.Zero(t, len(cids))
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread stale msg")
		}

		rquery, _, err := g.InboxSource.GetInboxQueryLocalToRemote(context.TODO(), query)
		require.NoError(t, err)
		_, lconvs, _, err := storage.NewInbox(g, uid).Read(context.TODO(), rquery, p)
		require.NoError(t, err)
		require.Equal(t, 1, len(lconvs))
		require.Equal(t, lconvs[0].GetConvID(), conv.Id)
	})
}

func TestMakePreview(t *testing.T) {
	ctc := makeChatTestContext(t, "MakePreview", 1)
	defer ctc.cleanup()
	user := ctc.users()[0]

	// make a preview of a jpg
	arg := chat1.MakePreviewArg{
		Attachment: chat1.LocalFileSource{
			Filename: "testdata/ship.jpg",
		},
		OutputDir: os.TempDir(),
	}
	res, err := ctc.as(t, user).chatLocalHandler().MakePreview(context.TODO(), arg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Filename == nil {
		t.Fatal("expected filename")
	}
	if !strings.HasSuffix(*res.Filename, ".jpeg") {
		t.Fatalf("expected .jpeg suffix, got %q", *res.Filename)
	}
	defer os.Remove(*res.Filename)
	if res.Metadata == nil {
		t.Fatal("expected metadata")
	}
	if res.MimeType != "image/jpeg" {
		t.Fatalf("mime type: %q, expected image/jpeg", res.MimeType)
	}
	img := res.Metadata.Image()
	if img.Width != 640 {
		t.Errorf("width: %d, expected 640", img.Width)
	}
	if img.Height != 480 {
		t.Errorf("height: %d, expected 480", img.Width)
	}

	// MakePreview(pdf) shouldn't generate a preview file, but should return mimetype
	arg = chat1.MakePreviewArg{
		Attachment: chat1.LocalFileSource{
			Filename: "testdata/weather.pdf",
		},
		OutputDir: os.TempDir(),
	}
	res, err = ctc.as(t, user).chatLocalHandler().MakePreview(context.TODO(), arg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Filename != nil {
		t.Fatalf("expected no preview file, got %q", *res.Filename)
	}
	if res.Metadata != nil {
		t.Fatalf("expected no metadata, got %+v", res.Metadata)
	}
	if res.MimeType != "application/pdf" {
		t.Fatalf("mime type: %q, expected application/pdf", res.MimeType)
	}
}
