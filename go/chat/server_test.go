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

	"encoding/base64"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

type gregorTestConnection struct {
	globals.Contextified
	utils.DebugLabeler

	cli          rpc.GenericClient
	uid          gregor1.UID
	sessionToken string
}

var _ rpc.ConnectionHandler = (*gregorTestConnection)(nil)

func newGregorTestConnection(g *globals.Context, uid gregor1.UID, sessionToken string) *gregorTestConnection {
	return &gregorTestConnection{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "gregorTestConnection", false),
		uid:          uid,
		sessionToken: sessionToken,
	}
}

func (g *gregorTestConnection) Connect(ctx context.Context) error {
	uri, err := rpc.ParseFMPURI(g.G().Env.GetGregorURI())
	if err != nil {
		return err
	}
	opts := rpc.ConnectionOpts{
		TagsFunc:      logger.LogTagsFromContextRPC,
		WrapErrorFunc: libkb.MakeWrapError(g.G().ExternalG()),
	}
	trans := rpc.NewConnectionTransport(uri, libkb.NewRPCLogFactory(g.G().ExternalG()), libkb.MakeWrapError(g.G().ExternalG()))
	conn := rpc.NewConnectionWithTransport(g, trans, libkb.NewContextifiedErrorUnwrapper(g.G().ExternalG()), g.G().Log, opts)
	g.cli = conn.GetClient()
	return nil
}

func (g *gregorTestConnection) GetClient() chat1.RemoteClient {
	return chat1.RemoteClient{Cli: g.cli}
}

func (g *gregorTestConnection) OnConnect(ctx context.Context, conn *rpc.Connection,
	cli rpc.GenericClient, srv *rpc.Server) error {
	g.Debug(ctx, "logged in: authenticating")
	ac := gregor1.AuthClient{Cli: cli}
	auth, err := ac.AuthenticateSessionToken(ctx, gregor1.SessionToken(g.sessionToken))
	if err != nil {
		g.Debug(ctx, "auth error: %s", err)
		return err
	}
	if !auth.Uid.Eq(g.uid) {
		return fmt.Errorf("wrong uid authed: auth: %s uid: %s", auth.Uid, g.uid)
	}

	return srv.Register(gregor1.OutgoingProtocol(g))
}

func (g *gregorTestConnection) BroadcastMessage(ctx context.Context, m gregor1.Message) error {
	if obm := m.ToOutOfBandMessage(); obm != nil {
		_, err := g.G().PushHandler.HandleOobm(ctx, obm)
		return err
	}
	return nil
}

func (g *gregorTestConnection) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
}

func (g *gregorTestConnection) OnDoCommandError(err error, nextTime time.Duration) {
}

func (g *gregorTestConnection) OnDisconnected(ctx context.Context, status rpc.DisconnectStatus) {
}

func (g *gregorTestConnection) ShouldRetry(name string, err error) bool {
	return false
}

func (g *gregorTestConnection) ShouldRetryOnConnect(err error) bool {
	return false
}

func (g *gregorTestConnection) HandlerName() string {
	return "gregorTestConnection"
}

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
	err = teams.CreateRootTeam(context.TODO(), tc.G, name, keybase1.TeamSettings{})
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

var useRemoteMock = true

func runWithMemberTypes(t *testing.T, f func(membersType chat1.ConversationMembersType)) {
	useRemoteMock = true
	start := time.Now()
	t.Logf("KBFS Stage Begin")
	f(chat1.ConversationMembersType_KBFS)
	t.Logf("KBFS Stage End: %v", time.Now().Sub(start))

	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	t.Logf("Team Stage Begin")
	start = time.Now()
	f(chat1.ConversationMembersType_TEAM)
	t.Logf("Team Stage End: %v", time.Now().Sub(start))

	t.Logf("Implicit Team Stage Begin")
	os.Setenv("KEYBASE_CHAT_MEMBER_TYPE", "impteam")
	defer os.Setenv("KEYBASE_CHAT_MEMBER_TYPE", "")
	start = time.Now()
	f(chat1.ConversationMembersType_IMPTEAM)
	t.Logf("Implicit Team Stage End: %v", time.Now().Sub(start))
}

type chatTestUserContext struct {
	startCtx context.Context
	u        *kbtest.FakeUser
	h        *Server
	ri       chat1.RemoteInterface
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
	ctc.world = NewChatMockWorld(t, name, numUsers)
	ctc.userContextCache = make(map[string]*chatTestUserContext)
	ctc.teamCache = make(map[string]string)
	return ctc
}

func (c *chatTestContext) advanceFakeClock(d time.Duration) {
	c.world.Fc.Advance(d)
}

func (c *chatTestContext) as(t *testing.T, user *kbtest.FakeUser) *chatTestUserContext {
	var ctx context.Context
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
	uid := gregor1.UID(user.User.GetUID().ToBytes())

	var tlf kbtest.TlfMock
	var ri chat1.RemoteInterface
	if useRemoteMock {
		mockRemote := kbtest.NewChatRemoteMock(c.world)
		mockRemote.SetCurrentUser(user.User.GetUID().ToBytes())
		tlf = kbtest.NewTlfMock(c.world)
		ri = mockRemote
		ctx = newTestContextWithTlfMock(tc, tlf)
	} else {
		var sessionToken string
		ctx = newTestContext(tc)
		tc.G.LoginState().LocalSession(func(s *libkb.Session) {
			sessionToken = s.GetToken()
		}, "test session")
		gh := newGregorTestConnection(tc.Context(), uid, sessionToken)
		require.NoError(t, gh.Connect(ctx))
		ri = gh.GetClient()
	}

	h.boxer = NewBoxer(g)

	chatStorage := storage.New(g)
	g.ConvSource = NewHybridConversationSource(g, h.boxer, chatStorage,
		func() chat1.RemoteInterface { return ri })
	g.InboxSource = NewHybridInboxSource(g, func() chat1.RemoteInterface { return ri })
	g.ServerCacheVersions = storage.NewServerVersions(g)
	chatSyncer := NewSyncer(g)
	g.Syncer = chatSyncer
	g.ConnectivityMonitor = &libkb.NullConnectivityMonitor{}

	h.setTestRemoteClient(ri)

	baseSender := NewBlockingSender(g, h.boxer, nil, func() chat1.RemoteInterface { return ri })
	deliverer := NewDeliverer(g, baseSender)
	deliverer.SetClock(c.world.Fc)
	if useRemoteMock {
		deliverer.setTestingNameInfoSource(tlf)
	}
	g.MessageDeliverer = deliverer
	g.MessageDeliverer.Start(context.TODO(), uid)
	g.MessageDeliverer.Connected(context.TODO())

	retrier := NewFetchRetrier(g)
	retrier.SetClock(c.world.Fc)
	g.FetchRetrier = retrier
	g.FetchRetrier.Connected(context.TODO())
	g.FetchRetrier.Start(context.TODO(), uid)

	g.ConvLoader = NewBackgroundConvLoader(g)

	pushHandler := NewPushHandler(g)
	pushHandler.SetClock(c.world.Fc)
	g.PushHandler = pushHandler

	tuc := &chatTestUserContext{
		h:        h,
		u:        user,
		startCtx: ctx,
		ri:       ri,
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
		keybase1.TLFVisibility_PUBLIC, membersType, others...)
	ctc.advanceFakeClock(time.Second)
	return created
}

func mustCreateConversationForTest(t *testing.T, ctc *chatTestContext, creator *kbtest.FakeUser,
	topicType chat1.TopicType, membersType chat1.ConversationMembersType, others ...*kbtest.FakeUser) (created chat1.ConversationInfoLocal) {
	created = mustCreateConversationForTestNoAdvanceClock(t, ctc, creator, topicType,
		keybase1.TLFVisibility_PRIVATE, membersType, others...)
	ctc.advanceFakeClock(time.Second)
	return created
}

func mustCreateConversationForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext,
	creator *kbtest.FakeUser, topicType chat1.TopicType, visibility keybase1.TLFVisibility,
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
	case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAM:
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
	default:
		t.Fatalf("unhandled membersType: %v", membersType)
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

	// Set initial active list
	conv := ctc.world.GetConversationByID(ncres.Conv.GetConvID())
	if conv != nil {
		conv.Metadata.ActiveList = append(conv.Metadata.ActiveList, creator.GetUID().ToBytes())
		for _, o := range others {
			conv.Metadata.ActiveList = append(conv.Metadata.ActiveList, o.GetUID().ToBytes())
		}
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
	require.NoError(t, err)
}

func mustPostLocalForTest(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) {
	mustPostLocalForTestNoAdvanceClock(t, ctc, asUser, conv, msg)
	ctc.advanceFakeClock(time.Second)
}

func TestChatSrvNewConversationLocal(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "NewConversationLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())

		tc := ctc.world.Tcs[users[0].Username]
		ctx := ctc.as(t, users[0]).startCtx
		uid := users[0].User.GetUID().ToBytes()
		conv, _, err := GetUnverifiedConv(ctx, tc.Context(), uid, created.Id, false)
		require.NoError(t, err)
		if len(conv.MaxMsgSummaries) == 0 {
			t.Fatalf("created conversation does not have a message")
		}

		switch mt {
		case chat1.ConversationMembersType_KBFS:
			if conv.MaxMsgSummaries[0].TlfName !=
				string(kbtest.CanonicalTlfNameForTest(ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username)) {
				t.Fatalf("unexpected TLF name in created conversation. expected %s, got %s", ctc.as(t, users[0]).user().Username+","+ctc.as(t, users[1]).user().Username, conv.MaxMsgs[0].ClientHeader.TlfName)
			}
		case chat1.ConversationMembersType_TEAM:
			teamName := ctc.teamCache[teamKey(ctc.users())]
			require.Equal(t, teamName, conv.MaxMsgSummaries[0].TlfName)
		}
	})
}

func TestChatSrvNewChatConversationLocalTwice(t *testing.T) {
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

func TestChatSrvNewConversationMultiTeam(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "NewConversationLocalTeams", 2)
		defer ctc.cleanup()
		users := ctc.users()

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		tc := ctc.as(t, users[0])
		topicName := "MIKETIME"
		arg := chat1.NewConversationLocalArg{
			TlfName:       conv.TlfName,
			TopicName:     &topicName,
			TopicType:     chat1.TopicType_CHAT,
			TlfVisibility: keybase1.TLFVisibility_PRIVATE,
			MembersType:   mt,
		}
		ncres, err := tc.chatLocalHandler().NewConversationLocal(tc.startCtx, arg)
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			require.NoError(t, err)
			require.Equal(t, topicName, ncres.Conv.Info.TopicName)
			require.NotEqual(t, conv.Id, ncres.Conv.GetConvID())
		case chat1.ConversationMembersType_KBFS:
			require.Equal(t, conv.Id, ncres.Conv.GetConvID())
		}
		if err != nil {
			t.Fatalf("NewConversationLocal error: %v\n", err)
		}

		// Try some invalid names
		topicName = "#mike"
		_, err = tc.chatLocalHandler().NewConversationLocal(tc.startCtx, arg)
		require.Error(t, err)
		topicName = "/mike"
		_, err = tc.chatLocalHandler().NewConversationLocal(tc.startCtx, arg)
		require.Error(t, err)
		topicName = "mi.ke"
		_, err = tc.chatLocalHandler().NewConversationLocal(tc.startCtx, arg)
		require.Error(t, err)
		topicName = ""
		_, err = tc.chatLocalHandler().NewConversationLocal(tc.startCtx, arg)
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			require.NoError(t, err)
		case chat1.ConversationMembersType_TEAM:
			require.Error(t, err)
		}
		topicName = "dskjdskdjskdjskdjskdjskdjskdjskjdskjdskdskdjksdjks"
		_, err = tc.chatLocalHandler().NewConversationLocal(tc.startCtx, arg)
		require.Error(t, err)
	})
}

func TestChatSrvGetInboxAndUnboxLocal(t *testing.T) {
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

		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()

		conv, _, err := GetUnverifiedConv(ctx, tc.Context(), uid, created.Id, false)
		require.NoError(t, err)
		if conversations[0].Info.TlfName != conv.MaxMsgSummaries[0].TlfName {
			t.Fatalf("unexpected TlfName in response from GetInboxAndUnboxLocal. %s != %s (mt = %v)", conversations[0].Info.TlfName, conv.MaxMsgSummaries[0].TlfName, mt)
		}
		if !conversations[0].Info.Id.Eq(created.Id) {
			t.Fatalf("unexpected Id in response from GetInboxAndUnboxLocal. %s != %s\n", conversations[0].Info.Id, created.Id)
		}
		if conversations[0].Info.Triple.TopicType != chat1.TopicType_CHAT {
			t.Fatalf("unexpected topicType in response from GetInboxAndUnboxLocal. %s != %s\n", conversations[0].Info.Triple.TopicType, chat1.TopicType_CHAT)
		}
	})
}
func TestChatSrvGetInboxNonblockLocalMetadata(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetInboxNonblockLocalLocalMetadata", 6)
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

			mustPostLocalForTest(t, ctc, users[i+1], created,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: fmt.Sprintf("%d", i+1),
				}))

			switch mt {
			case chat1.ConversationMembersType_TEAM:
				mustPostLocalForTest(t, ctc, users[i+1], created,
					chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
						ConversationTitle: fmt.Sprintf("%d", i+1),
					}))
			}
		}

		ctx := ctc.as(t, users[0]).startCtx
		_, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
			chat1.GetInboxNonblockLocalArg{
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			},
		)
		require.NoError(t, err)

		select {
		case ibox := <-inboxCb:
			require.NotNil(t, ibox.InboxRes, "nil inbox")
			require.Equal(t, numconvs, len(ibox.InboxRes.Items))
			for _, conv := range ibox.InboxRes.Items {
				require.Nil(t, conv.LocalMetadata)
			}
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

		_, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
			chat1.GetInboxNonblockLocalArg{
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			},
		)
		require.NoError(t, err)

		select {
		case ibox := <-inboxCb:
			require.NotNil(t, ibox.InboxRes, "nil inbox")
			require.Equal(t, numconvs, len(ibox.InboxRes.Items))
			for index, conv := range ibox.InboxRes.Items {
				require.NotNil(t, conv.LocalMetadata)
				require.Equal(t, fmt.Sprintf("%d", numconvs-index), conv.LocalMetadata.Snippet)
				require.Equal(t, 2, len(conv.LocalMetadata.WriterNames))
				switch mt {
				case chat1.ConversationMembersType_TEAM:
					require.Equal(t, fmt.Sprintf("%d", numconvs-index), conv.LocalMetadata.ChannelName)
				}
			}
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
	})
}

func TestChatSrvGetInboxNonblock(t *testing.T) {
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
			switch mt {
			case chat1.ConversationMembersType_TEAM:
				require.Equal(t, numconvs, len(ibox.InboxRes.Items))
			default:
				require.Zero(t, len(ibox.InboxRes.Items), "wrong size inbox")
			}
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
			require.Equal(t, len(convs), len(ibox.InboxRes.Items), "wrong size inbox")
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

func TestChatSrvGetInboxAndUnboxLocalTlfName(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		var name string
		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAM:
			name = ctc.as(t, users[1]).user().Username + "," + ctc.as(t, users[0]).user().Username // not canonical
		case chat1.ConversationMembersType_TEAM:
			name = ctc.teamCache[teamKey(ctc.users())]
		}

		visibility := keybase1.TLFVisibility_PRIVATE
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
		require.NoError(t, err)
		conversations := gilres.Conversations
		require.Equal(t, 1, len(conversations))
		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()
		conv, _, err := GetUnverifiedConv(ctx, tc.Context(), uid, created.Id, false)
		require.NoError(t, err)
		require.Equal(t, conversations[0].Info.TlfName, conv.MaxMsgSummaries[0].TlfName)
		require.Equal(t, conversations[0].Info.Id, created.Id)
		require.Equal(t, chat1.TopicType_CHAT, conversations[0].Info.Triple.TopicType)
	})
}

func TestChatSrvPostLocal(t *testing.T) {
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
		uid := users[0].User.GetUID().ToBytes()
		tc := ctc.world.Tcs[users[0].Username]
		ctx := ctc.as(t, users[0]).startCtx
		tv, _, err := tc.Context().ConvSource.Pull(ctx, created.Id, uid, nil,
			nil)
		require.NoError(t, err)
		require.NotZero(t, len(tv.Messages))
		msg := tv.Messages[0]

		if mt == chat1.ConversationMembersType_KBFS {
			require.NotEqual(t, created.TlfName, msg.Valid().ClientHeader.TlfName)
		}
		require.NotZero(t, len(msg.Valid().ClientHeader.Sender.Bytes()))
		require.NotZero(t, len(msg.Valid().ClientHeader.SenderDevice.Bytes()))

		t.Logf("try headline specific RPC interface")
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostHeadline(ctx, chat1.PostHeadlineArg{
			ConversationID:   created.Id,
			TlfName:          created.TlfName,
			TlfPublic:        false,
			Headline:         "HI",
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		require.NoError(t, err)
		tv, _, err = tc.Context().ConvSource.Pull(ctx, created.Id, uid, nil,
			nil)
		require.NoError(t, err)
		require.NotZero(t, len(tv.Messages))
		msg = tv.Messages[0]
		require.Equal(t, chat1.MessageType_HEADLINE, msg.GetMessageType())
	})
}

func TestChatSrvPostLocalAtMention(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "PostLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAM:
			return
		}

		listener := newServerChatListener()
		ctc.as(t, users[1]).h.G().SetService()
		ctc.as(t, users[1]).h.G().NotifyRouter.SetListener(listener)
		ctx := ctc.as(t, users[0]).startCtx

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		consumeNewMsg(t, listener, chat1.MessageType_JOIN)

		text := fmt.Sprintf("@%s", users[1].Username)
		mustPostLocalForTest(t, ctc, users[0], created,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: text}))

		select {
		case info := <-listener.newMessage:
			require.True(t, info.Message.IsValid())
			require.Equal(t, chat1.MessageType_TEXT, info.Message.GetMessageType())
			require.Equal(t, 1, len(info.Message.Valid().AtMentions))
			require.Equal(t, users[1].Username, info.Message.Valid().AtMentions[0])
			require.True(t, info.DisplayDesktopNotification)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message")
		}

		// Test that edits work
		postRes, err := ctc.as(t, users[0]).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
			ConversationID: created.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        created.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     created.TlfName,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "HI",
				}),
			},
		})
		require.NoError(t, err)
		consumeNewMsg(t, listener, chat1.MessageType_TEXT)
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
			ConversationID: created.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        created.Triple,
					MessageType: chat1.MessageType_EDIT,
					TlfName:     created.TlfName,
					Supersedes:  postRes.MessageID,
				},
				MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
					MessageID: postRes.MessageID,
					Body:      fmt.Sprintf("@%s", users[1].Username),
				}),
			},
		})
		require.NoError(t, err)
		select {
		case info := <-listener.newMessage:
			require.True(t, info.Message.IsValid())
			require.Equal(t, chat1.MessageType_EDIT, info.Message.GetMessageType())
			require.Equal(t, 1, len(info.Message.Valid().AtMentions))
			require.Equal(t, users[1].Username, info.Message.Valid().AtMentions[0])
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message")
		}
		threadRes, err := ctc.as(t, users[1]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: created.Id,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			},
		})
		require.NoError(t, err)
		require.Equal(t, 2, len(threadRes.Thread.Messages))
		require.True(t, threadRes.Thread.Messages[0].IsValid())
		require.Equal(t, 1, len(threadRes.Thread.Messages[0].Valid().AtMentionUsernames))
		require.Equal(t, users[1].Username, threadRes.Thread.Messages[0].Valid().AtMentionUsernames[0])

		// Make sure @channel works
		mustPostLocalForTest(t, ctc, users[0], created,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: "@channel"}))
		select {
		case info := <-listener.newMessage:
			require.True(t, info.Message.IsValid())
			require.Equal(t, chat1.MessageType_TEXT, info.Message.GetMessageType())
			require.Zero(t, len(info.Message.Valid().AtMentions))
			require.Equal(t, chat1.ChannelMention_ALL, info.Message.Valid().ChannelMention)
			require.True(t, info.DisplayDesktopNotification)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message")
		}
	})
}

func TestChatSrvPostLocalLengthLimit(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "PostLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		maxTextBody := strings.Repeat(".", msgchecker.TextMessageMaxLength)
		_, err := postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: maxTextBody}))
		require.NoError(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: maxTextBody + "!"}))
		require.Error(t, err)

		maxHeadlineBody := strings.Repeat(".", msgchecker.HeadlineMaxLength)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: maxHeadlineBody}))
		require.NoError(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: maxHeadlineBody + "!"}))
		require.Error(t, err)

		maxTopicBody := strings.Repeat("a", msgchecker.TopicMaxLength)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: maxTopicBody}))
		require.NoError(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: maxTopicBody + "a"}))
		require.Error(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: "#mike"}))
		require.Error(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: "mii.ke"}))
		require.Error(t, err)
	})
}

func TestChatSrvGetThreadLocal(t *testing.T) {
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
		require.NoError(t, err)

		tv := tvres.Thread
		expectedMessages := 2
		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAM:
		case chat1.ConversationMembersType_TEAM:
			expectedMessages++ // the join message
		default:
			t.Fatalf("unknown members type: %v", mt)
		}
		require.Len(t, tv.Messages, expectedMessages,
			"unexpected response from GetThreadLocal . number of messages")
		require.Equal(t, "hello!", tv.Messages[0].Valid().MessageBody.Text().Body)
	})
}

func TestChatSrvGetThreadLocalMarkAsRead(t *testing.T) {
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
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Conversations))
		require.Equal(t, res.Conversations[0].Info.Id.String(), withUser1.Id.String())
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
		require.True(t, found)

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
		require.NoError(t, err)
		tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: withUser1.Id,
			Query: &chat1.GetThreadQuery{
				MarkAsRead: true,
			},
		})
		require.NoError(t, err)

		expectedMessages := 4 // 3 messges and 1 TLF
		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAM:
		case chat1.ConversationMembersType_TEAM:
			expectedMessages++ // and the join message
		default:
			require.Fail(t, "unknown members type: %v", mt)
		}
		require.Len(t, tv.Thread.Messages, expectedMessages,
			"unexpected response from GetThreadLocal . number of messages")

		res, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxSummaryForCLILocal(ctx, chat1.GetInboxSummaryForCLILocalQuery{
			TopicType: chat1.TopicType_CHAT,
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Conversations))
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
		require.True(t, found)
	})
}

type messageSabotagerRemote struct {
	chat1.RemoteInterface
}

func (m messageSabotagerRemote) GetThreadRemote(ctx context.Context, arg chat1.GetThreadRemoteArg) (chat1.GetThreadRemoteRes, error) {
	res, err := m.RemoteInterface.GetThreadRemote(ctx, arg)
	if err != nil {
		return res, err
	}
	if len(res.Thread.Messages) > 0 {
		res.Thread.Messages[0].BodyCiphertext.E[0] += 50
	}
	return res, nil
}

func TestChatSrvGracefulUnboxing(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GracefulUnboxing", 2)
		defer ctc.cleanup()
		users := ctc.users()

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener)

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "innocent hello"}))
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "evil hello"}))

		var joinMessage int
		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAM:
		case chat1.ConversationMembersType_TEAM:
			joinMessage = 1
		default:
			t.Fatalf("unknown members type: %v", mt)
		}

		// Wait for message notifications so we don't race cache clear with incoming message
		for i := 0; i < 2+joinMessage; i++ {
			select {
			case <-listener.newMessage:
			case <-time.After(20 * time.Second):
				require.Fail(t, "no msg cb")
			}
		}

		// make evil hello evil
		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()
		require.NoError(t, tc.Context().ConvSource.Clear(created.Id, uid))

		ri := ctc.as(t, users[0]).ri
		sabRemote := messageSabotagerRemote{RemoteInterface: ri}
		tc.Context().ConvSource.SetRemoteInterface(func() chat1.RemoteInterface { return sabRemote })
		ctx := ctc.as(t, users[0]).startCtx
		tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: created.Id,
		})
		tc.Context().ConvSource.SetRemoteInterface(func() chat1.RemoteInterface { return ri })
		if err != nil {
			t.Fatalf("GetThreadLocal error: %v", err)
		}

		require.Len(t, tv.Thread.Messages, 3+joinMessage,
			"unexpected response from GetThreadLocal . number of messages")

		if tv.Thread.Messages[0].IsValid() || len(tv.Thread.Messages[0].Error().ErrMsg) == 0 {
			t.Fatalf("unexpected response from GetThreadLocal. expected an error message from bad msg, got %#+v\n", tv.Thread.Messages[0])
		}
		if !tv.Thread.Messages[1].IsValid() || tv.Thread.Messages[1].Valid().MessageBody.Text().Body != "innocent hello" {
			t.Fatalf("unexpected response from GetThreadLocal. expected 'innocent hello' got %#+v\n", tv.Thread.Messages[1].Valid())
		}
	})
}

func TestChatSrvGetInboxSummaryForCLILocal(t *testing.T) {
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
		// TODO: fix this when merging master back in... (what?)
		expectedMessages := 2
		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAM:
		case chat1.ConversationMembersType_TEAM:
			expectedMessages++ // the join message
		default:
			t.Fatalf("unknown members type: %v", mt)
		}
		require.Len(t, res.Conversations[0].MaxMessages, expectedMessages,
			"unexpected response from GetInboxSummaryForCLILocal . number of messages in the first conversation")

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

func TestChatSrvGetMessagesLocal(t *testing.T) {
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

func TestChatSrvGetOutbox(t *testing.T) {
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
		}, nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
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

func TestChatSrvGap(t *testing.T) {
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

		require.Len(t, mres.Msgs, 1, "number of messages")

		ooMsg := mres.Msgs[0]
		ooMsg.ServerHeader.MessageID = 5

		payload := chat1.NewMessagePayload{
			Action:  types.ActionNewMessage,
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
			System_: gregor1.System(types.PushActivity),
			Body_:   data,
		}))

		select {
		case updates := <-listener.threadsStale:
			require.Equal(t, 1, len(updates))
			require.Equal(t, created.Id, updates[0].ConvID, "wrong cid")
			require.Equal(t, chat1.StaleUpdateType_CLEAR, updates[0].UpdateType)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to receive stale event")
		}

		ooMsg.ServerHeader.MessageID = 6
		payload = chat1.NewMessagePayload{
			Action:  types.ActionNewMessage,
			ConvID:  created.Id,
			Message: ooMsg,
		}
		enc = codec.NewEncoderBytes(&data, &mh)
		require.NoError(t, enc.Encode(payload))
		require.NoError(t, ph.Activity(ctx, &gregor1.OutOfBandMessage{
			Uid_:    u.User.GetUID().ToBytes(),
			System_: gregor1.System(types.PushActivity),
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
	libkb.NoopNotifyListener
	newMessage              chan chat1.IncomingMessage
	threadsStale            chan []chat1.ConversationStaleUpdate
	inboxStale              chan struct{}
	joinedConv              chan chat1.InboxUIItem
	leftConv                chan chat1.ConversationID
	resetConv               chan chat1.ConversationID
	membersUpdate           chan chat1.MembersUpdateInfo
	appNotificationSettings chan chat1.SetAppNotificationSettingsInfo
	identifyUpdate          chan keybase1.CanonicalTLFNameAndIDWithBreaks
	teamType                chan chat1.TeamTypeInfo
	inboxSynced             chan chat1.ChatSyncResult
}

func (n *serverChatListener) ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	n.identifyUpdate <- update
}
func (n *serverChatListener) ChatInboxStale(uid keybase1.UID) {
	n.inboxStale <- struct{}{}
}
func (n *serverChatListener) ChatThreadsStale(uid keybase1.UID, cids []chat1.ConversationStaleUpdate) {
	n.threadsStale <- cids
}
func (n *serverChatListener) ChatInboxSynced(uid keybase1.UID, syncRes chat1.ChatSyncResult) {
	n.inboxSynced <- syncRes
}
func (n *serverChatListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity) {
	typ, _ := activity.ActivityType()
	switch typ {
	case chat1.ChatActivityType_INCOMING_MESSAGE:
		n.newMessage <- activity.IncomingMessage()
	case chat1.ChatActivityType_MEMBERS_UPDATE:
		n.membersUpdate <- activity.MembersUpdate()
	case chat1.ChatActivityType_SET_APP_NOTIFICATION_SETTINGS:
		n.appNotificationSettings <- activity.SetAppNotificationSettings()
	case chat1.ChatActivityType_TEAMTYPE:
		n.teamType <- activity.Teamtype()
	}
}
func (n *serverChatListener) ChatJoinedConversation(uid keybase1.UID, conv chat1.InboxUIItem) {
	n.joinedConv <- conv
}
func (n *serverChatListener) ChatLeftConversation(uid keybase1.UID, convID chat1.ConversationID) {
	n.leftConv <- convID
}
func (n *serverChatListener) ChatResetConversation(uid keybase1.UID, convID chat1.ConversationID) {
	n.resetConv <- convID
}

func newServerChatListener() *serverChatListener {
	return &serverChatListener{
		newMessage:              make(chan chat1.IncomingMessage, 100),
		threadsStale:            make(chan []chat1.ConversationStaleUpdate, 100),
		inboxStale:              make(chan struct{}, 100),
		joinedConv:              make(chan chat1.InboxUIItem, 100),
		leftConv:                make(chan chat1.ConversationID, 100),
		resetConv:               make(chan chat1.ConversationID, 100),
		membersUpdate:           make(chan chat1.MembersUpdateInfo, 100),
		appNotificationSettings: make(chan chat1.SetAppNotificationSettingsInfo, 100),
		identifyUpdate:          make(chan keybase1.CanonicalTLFNameAndIDWithBreaks, 100),
		teamType:                make(chan chat1.TeamTypeInfo, 100),
		inboxSynced:             make(chan chat1.ChatSyncResult, 100),
	}
}

func TestChatSrvPostLocalNonblock(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "PostLocalNonblock", 2)
		defer ctc.cleanup()
		users := ctc.users()

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener)
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true

		var err error
		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		t.Logf("send a text message")
		arg := chat1.PostTextNonblockArg{
			ConversationID:   created.Id,
			TlfName:          created.TlfName,
			TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
			Body:             "hi",
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		tc := ctc.as(t, users[0])
		res, err := ctc.as(t, users[0]).chatLocalHandler().PostTextNonblock(tc.startCtx, arg)
		require.NoError(t, err)
		var unboxed chat1.UIMessage
		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAM:
			// pass
		case chat1.ConversationMembersType_TEAM:
			select {
			case info := <-listener.newMessage:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				if unboxed.GetMessageType() != chat1.MessageType_JOIN {
					t.Logf("failing.. expected JOIN")
					select {
					case info2 := <-listener.newMessage:
						t.Logf("info (1): %v", spew.Sdump(info))
						t.Logf("info (2): %v", spew.Sdump(info2))
					case <-time.After(30 * time.Second):
						t.Logf("no second message in the pipe")
					}
					t.Logf("info (1): %v", spew.Sdump(info))
					require.Equal(t, chat1.MessageType_JOIN, unboxed.GetMessageType(), "unexpected type")
				}
				require.Equal(t, chat1.MessageType_JOIN, unboxed.GetMessageType(), "unexpected type")
				require.Nil(t, unboxed.Valid().OutboxID, "surprise outbox ID on JOIN")
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
		default:
			t.Fatalf("unknown members type: %v", mt)
		}
		select {
		case info := <-listener.newMessage:
			unboxed = info.Message
			require.True(t, unboxed.IsValid(), "invalid message")
			require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
			require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
			require.Equal(t, chat1.MessageType_TEXT, unboxed.GetMessageType(), "invalid type")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no event received")
		}

		t.Logf("post text message with prefetched outbox ID")
		genOutboxID, err := ctc.as(t, users[0]).chatLocalHandler().GenerateOutboxID(context.TODO())
		require.NoError(t, err)
		arg = chat1.PostTextNonblockArg{
			ConversationID:   created.Id,
			TlfName:          created.TlfName,
			TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
			Body:             "hi",
			OutboxID:         &genOutboxID,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		res, err = ctc.as(t, users[0]).chatLocalHandler().PostTextNonblock(tc.startCtx, arg)
		require.NoError(t, err)
		select {
		case info := <-listener.newMessage:
			unboxed = info.Message
			require.True(t, unboxed.IsValid(), "invalid message")
			require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
			require.Equal(t, genOutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
			require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
			require.Equal(t, chat1.MessageType_TEXT, unboxed.GetMessageType(), "invalid type")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no event received")
		}

		t.Logf("edit the message")
		earg := chat1.PostEditNonblockArg{
			ConversationID:   created.Id,
			TlfName:          created.TlfName,
			TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
			Supersedes:       unboxed.GetMessageID(),
			Body:             "hi2",
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		res, err = ctc.as(t, users[0]).chatLocalHandler().PostEditNonblock(tc.startCtx, earg)
		require.NoError(t, err)
		select {
		case info := <-listener.newMessage:
			unboxed = info.Message
			require.True(t, unboxed.IsValid(), "invalid message")
			require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
			require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
			require.Equal(t, chat1.MessageType_EDIT, unboxed.GetMessageType(), "invalid type")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no event received")
		}

		t.Logf("delete the message")
		darg := chat1.PostDeleteNonblockArg{
			ConversationID:   created.Id,
			TlfName:          created.TlfName,
			TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
			Supersedes:       unboxed.GetMessageID(),
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		res, err = ctc.as(t, users[0]).chatLocalHandler().PostDeleteNonblock(tc.startCtx, darg)
		require.NoError(t, err)
		select {
		case info := <-listener.newMessage:
			unboxed = info.Message
			require.True(t, unboxed.IsValid(), "invalid message")
			require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
			require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
			require.Equal(t, chat1.MessageType_DELETE, unboxed.GetMessageType(), "invalid type")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no event received")
		}

		t.Logf("post headline")
		headline := "SILENCE!"
		harg := chat1.PostHeadlineNonblockArg{
			ConversationID:   created.Id,
			TlfName:          created.TlfName,
			TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			Headline:         headline,
		}
		res, err = ctc.as(t, users[0]).chatLocalHandler().PostHeadlineNonblock(tc.startCtx, harg)
		require.NoError(t, err)
		select {
		case info := <-listener.newMessage:
			unboxed = info.Message
			require.True(t, unboxed.IsValid(), "invalid message")
			require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
			require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
			require.Equal(t, chat1.MessageType_HEADLINE, unboxed.GetMessageType(), "invalid type")
			switch mt {
			case chat1.ConversationMembersType_TEAM:
				require.Equal(t, headline, unboxed.Valid().MessageBody.Headline().Headline)
			}
		case <-time.After(20 * time.Second):
			require.Fail(t, "no event received")
		}
	})
}

func TestChatSrvFindConversations(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// XXX: Public chats can't work with teams yet
		if mt == chat1.ConversationMembersType_TEAM {
			return
		}

		// CORE-6335 remove this
		if mt == chat1.ConversationMembersType_IMPTEAM {
			return
		}

		ctc := makeChatTestContext(t, "FindConversations", 3)
		defer ctc.cleanup()
		users := ctc.users()

		t.Logf("basic test")
		created := mustCreatePublicConversationForTest(t, ctc, users[2], chat1.TopicType_CHAT,
			mt, users[1])
		t.Logf("created public conversation: %+v", created)
		if useRemoteMock {
			convRemote := ctc.world.GetConversationByID(created.Id)
			require.NotNil(t, convRemote)
			convRemote.Metadata.Visibility = keybase1.TLFVisibility_PUBLIC
			convRemote.Metadata.ActiveList =
				[]gregor1.UID{users[2].User.GetUID().ToBytes(), users[1].User.GetUID().ToBytes()}
		}

		ctx := ctc.as(t, users[0]).startCtx
		ctx2 := ctc.as(t, users[2]).startCtx
		res, err := ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          created.TlfName,
				MembersType:      mt,
				Visibility:       keybase1.TLFVisibility_PUBLIC,
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
				Visibility:       keybase1.TLFVisibility_PUBLIC,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		require.Equal(t, 0, len(res.Conversations), "conv found")

		res, err = ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          created.TlfName,
				MembersType:      mt,
				Visibility:       keybase1.TLFVisibility_PUBLIC,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				TopicName:        "MIKE",
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Conversations), "conv found")
		require.Equal(t, created.Id, res.Conversations[0].GetConvID(), "wrong conv")
	})
}

func receiveThreadResult(t *testing.T, cb chan kbtest.NonblockThreadResult) (res *chat1.UIMessages) {
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

func TestChatSrvGetThreadNonblock(t *testing.T) {
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

func TestChatSrvGetThreadNonblockError(t *testing.T) {
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
		case updates := <-listener.threadsStale:
			require.Equal(t, 1, len(updates))
			require.Equal(t, chat1.StaleUpdateType_NEWACTIVITY, updates[0].UpdateType)
		case <-time.After(2 * time.Second):
			require.Fail(t, "no threads stale message received")
		}
	})
}

func TestChatSrvGetInboxNonblockError(t *testing.T) {
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
		ri := ctc.as(t, users[0]).ri
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
			return ri
		})
		ctc.world.Fc.Advance(time.Hour)

		select {
		case updates := <-listener.threadsStale:
			require.Equal(t, 1, len(updates))
			require.Equal(t, chat1.StaleUpdateType_NEWACTIVITY, updates[0].UpdateType)
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
			return ri
		})
		ctc.world.Fc.Advance(time.Hour)
		select {
		case <-listener.inboxStale:
		case <-time.After(20 * time.Second):
			require.Fail(t, "no threads stale message received")
		}

		rquery, _, err := g.InboxSource.GetInboxQueryLocalToRemote(context.TODO(), query)
		require.NoError(t, err)
		_, lconvs, _, err := storage.NewInbox(g, uid).Read(context.TODO(), rquery, p)
		require.NoError(t, err)
		require.Equal(t, 1, len(lconvs))
		require.Equal(t, lconvs[0].GetConvID(), conv.Id)
	})
}

func TestChatSrvMakePreview(t *testing.T) {
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

func consumeNewMsg(t *testing.T, listener *serverChatListener, typ chat1.MessageType) {
	select {
	case msg := <-listener.newMessage:
		require.Equal(t, typ, msg.Message.GetMessageType())
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get new message notification")
	}
}

func consumeTeamType(t *testing.T, listener *serverChatListener) {
	select {
	case <-listener.teamType:
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get team type notification")
	}
}

func consumeMembersUpdate(t *testing.T, listener *serverChatListener) {
	select {
	case <-listener.membersUpdate:
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get team type notification")
	}
}

func consumeJoinConv(t *testing.T, listener *serverChatListener) {
	select {
	case <-listener.joinedConv:
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get team type notification")
	}
}

func consumeLeaveConv(t *testing.T, listener *serverChatListener) {
	select {
	case <-listener.leftConv:
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get team type notification")
	}
}

func TestChatSrvTeamChannels(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatTeamChannels", 3)
		defer ctc.cleanup()
		users := ctc.users()

		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctx := ctc.as(t, users[0]).startCtx
		ctx1 := ctc.as(t, users[1]).startCtx

		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)

		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().SetService()
		ctc.as(t, users[1]).h.G().NotifyRouter.SetListener(listener1)

		listener2 := newServerChatListener()
		ctc.as(t, users[2]).h.G().SetService()
		ctc.as(t, users[2]).h.G().NotifyRouter.SetListener(listener2)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener1, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener2, chat1.MessageType_JOIN)
		t.Logf("first conv: %s", conv.Id)

		t.Logf("create a conversation, and join user 1 into by sending a message")
		topicName := "zjoinonsend"
		ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       conv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener0, chat1.MessageType_TEXT)
		consumeNewMsg(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsg(t, listener2, chat1.MessageType_TEXT)
		_, err = postLocalForTest(t, ctc, users[1], ncres.Conv.Info, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: fmt.Sprintf("JOINME"),
		}))
		consumeAllMsgJoins := func(listener *serverChatListener) {
			msgMap := make(map[chat1.MessageType]bool)
			for i := 0; i < 2; i++ {
				select {
				case msg := <-listener.newMessage:
					t.Logf("recvd: %v convID: %s", msg.Message.GetMessageType(), msg.ConvID)
					msgMap[msg.Message.GetMessageType()] = true
				case <-time.After(20 * time.Second):
					require.Fail(t, "missing incoming")
				}
			}
			require.True(t, msgMap[chat1.MessageType_TEXT])
			require.True(t, msgMap[chat1.MessageType_JOIN])
		}
		consumeAllMsgJoins(listener0)
		consumeAllMsgJoins(listener1)
		select {
		case conv := <-listener1.joinedConv:
			require.Equal(t, conv.GetConvID(), ncres.Conv.GetConvID())
			require.Equal(t, topicName, conv.Channel)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get joined notification")
		}
		select {
		case act := <-listener0.membersUpdate:
			require.Equal(t, act.ConvID, ncres.Conv.GetConvID())
			require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, act.Status)
			require.Equal(t, users[1].Username, act.Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		t.Logf("send headline on first convo")
		headline := "The headline is foobar!"
		_, err = postLocalForTest(t, ctc, users[1], ncres.Conv.Info, chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: headline}))
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_HEADLINE)
		consumeNewMsg(t, listener1, chat1.MessageType_HEADLINE)

		t.Logf("create a new channel, and check GetTLFConversation result")
		topicName = "miketime"
		ncres, err = ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       conv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		getTLFRes, err := ctc.as(t, users[1]).chatLocalHandler().GetTLFConversationsLocal(ctx1,
			chat1.GetTLFConversationsLocalArg{
				TlfName:     conv.TlfName,
				TopicType:   chat1.TopicType_CHAT,
				MembersType: chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		require.Equal(t, 3, len(getTLFRes.Convs))
		require.Equal(t, DefaultTeamTopic, getTLFRes.Convs[0].Channel)
		require.Equal(t, topicName, getTLFRes.Convs[1].Channel)
		creatorInfo := getTLFRes.Convs[2].CreatorInfo
		require.NotNil(t, creatorInfo)
		require.Equal(t, creatorInfo.Username, users[0].Username)
		tvres, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: getTLFRes.Convs[2].GetConvID(),
		})
		require.NoError(t, err)
		require.Equal(t, headline, tvres.Thread.Messages[0].Valid().MessageBody.Headline().Headline)

		t.Logf("join user 1 into new convo manually")
		_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationLocal(ctx1, chat1.JoinConversationLocalArg{
			TlfName:    conv.TlfName,
			TopicType:  chat1.TopicType_CHAT,
			Visibility: keybase1.TLFVisibility_PRIVATE,
			TopicName:  topicName,
		})
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener1, chat1.MessageType_JOIN)
		select {
		case conv := <-listener1.joinedConv:
			require.Equal(t, conv.GetConvID(), getTLFRes.Convs[1].GetConvID())
			require.Equal(t, topicName, conv.Channel)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get joined notification")
		}
		select {
		case act := <-listener0.membersUpdate:
			require.Equal(t, act.ConvID, getTLFRes.Convs[1].GetConvID())
			require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, act.Status)
			require.Equal(t, users[1].Username, act.Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		t.Logf("@mention in user2")
		_, err = postLocalForTest(t, ctc, users[1], ncres.Conv.Info, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: fmt.Sprintf("FAIL: @%s", users[2].Username),
		}))
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_TEXT)
		consumeNewMsg(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsg(t, listener2, chat1.MessageType_TEXT)

		_, err = ctc.as(t, users[1]).chatLocalHandler().LeaveConversationLocal(ctx1,
			ncres.Conv.GetConvID())
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_LEAVE)
		consumeNewMsg(t, listener1, chat1.MessageType_LEAVE)
		consumeNewMsg(t, listener2, chat1.MessageType_LEAVE)
		select {
		case convID := <-listener1.leftConv:
			require.Equal(t, convID, getTLFRes.Convs[1].GetConvID())
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get joined notification")
		}
		select {
		case act := <-listener0.membersUpdate:
			require.Equal(t, act.ConvID, getTLFRes.Convs[1].GetConvID())
			require.Equal(t, chat1.ConversationMemberStatus_REMOVED, act.Status)
			require.Equal(t, users[1].Username, act.Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		_, err = postLocalForTest(t, ctc, users[2], ncres.Conv.Info, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "FAIL",
		}))
		require.NoError(t, err)
		consumeAllMsgJoins(listener0)
		consumeAllMsgJoins(listener2)
		select {
		case conv := <-listener2.joinedConv:
			require.Equal(t, conv.GetConvID(), getTLFRes.Convs[1].GetConvID())
			require.Equal(t, topicName, conv.Channel)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get joined notification")
		}
		select {
		case act := <-listener0.membersUpdate:
			require.Equal(t, act.ConvID, getTLFRes.Convs[1].GetConvID())
			require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, act.Status)
			require.Equal(t, users[2].Username, act.Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationLocal(ctx1, chat1.JoinConversationLocalArg{
			TlfName:    conv.TlfName,
			TopicType:  chat1.TopicType_CHAT,
			Visibility: keybase1.TLFVisibility_PRIVATE,
			TopicName:  topicName,
		})
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener1, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener2, chat1.MessageType_JOIN)

		switch mt {
		case chat1.ConversationMembersType_KBFS:
		case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAM:
			t.Logf("u2 gets messages and looks for u1's LEAVE message")
			tvres, err := ctc.as(t, users[2]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
				ConversationID: ncres.Conv.GetConvID(),
				Query: &chat1.GetThreadQuery{
					MessageTypes: []chat1.MessageType{chat1.MessageType_LEAVE},
				},
			})
			require.NoError(t, err)
			require.Len(t, tvres.Thread.Messages, 1, "expected number of LEAVE messages")
		default:
			t.Fatalf("unknown members type: %v", mt)
		}
	})
}

func TestChatSrvSetAppNotificationSettings(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvSetAppNotificationSettings", 2)
		defer ctc.cleanup()
		users := ctc.users()

		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		ctx := ctc.as(t, users[0]).startCtx

		gilres, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{conv.Id},
			},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(gilres.Conversations))
		require.Equal(t, conv.Id, gilres.Conversations[0].GetConvID())
		gconv := gilres.Conversations[0]
		require.True(t, gconv.Notifications.Settings[keybase1.DeviceType_DESKTOP][chat1.NotificationKind_GENERIC])
		require.Equal(t, 2, len(gconv.Notifications.Settings))
		require.Equal(t, 2, len(gconv.Notifications.Settings[keybase1.DeviceType_DESKTOP]))
		require.Equal(t, 2, len(gconv.Notifications.Settings[keybase1.DeviceType_MOBILE]))

		mustPostLocalForTest(t, ctc, users[1], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		switch mt {
		case chat1.ConversationMembersType_KBFS:
		case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAM:
			// Get the join messages
			select {
			case info := <-listener0.newMessage:
				require.Equal(t, chat1.MessageType_JOIN, info.Message.GetMessageType())
				require.False(t, info.DisplayDesktopNotification)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no new message event")
			}
		default:
			t.Fatalf("unknown members type: %v", mt)
		}
		select {
		case info := <-listener0.newMessage:
			require.Equal(t, chat1.MessageType_TEXT, info.Message.GetMessageType())
			require.True(t, info.DisplayDesktopNotification)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message event")
		}

		setting := chat1.AppNotificationSettingLocal{
			DeviceType: keybase1.DeviceType_DESKTOP,
			Kind:       chat1.NotificationKind_GENERIC,
			Enabled:    false,
		}
		_, err = ctc.as(t, users[0]).chatLocalHandler().SetAppNotificationSettingsLocal(ctx,
			chat1.SetAppNotificationSettingsLocalArg{
				ConvID:   conv.Id,
				Settings: []chat1.AppNotificationSettingLocal{setting},
			})
		require.NoError(t, err)
		select {
		case rsettings := <-listener0.appNotificationSettings:
			require.Equal(t, gconv.GetConvID(), rsettings.ConvID)
			require.Equal(t, 2, len(rsettings.Settings.Settings))
			require.False(t, rsettings.Settings.ChannelWide)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no app notification received")
		}

		gilres, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{conv.Id},
			},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(gilres.Conversations))
		require.Equal(t, conv.Id, gilres.Conversations[0].GetConvID())
		gconv = gilres.Conversations[0]
		require.False(t, gconv.Notifications.Settings[keybase1.DeviceType_DESKTOP][chat1.NotificationKind_GENERIC])
		require.Equal(t, 2, len(gconv.Notifications.Settings))
		require.Equal(t, 2, len(gconv.Notifications.Settings[keybase1.DeviceType_DESKTOP]))
		require.Equal(t, 2, len(gconv.Notifications.Settings[keybase1.DeviceType_MOBILE]))
		require.False(t, gconv.Notifications.ChannelWide)

		mustPostLocalForTest(t, ctc, users[1], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		select {
		case info := <-listener0.newMessage:
			require.False(t, info.DisplayDesktopNotification)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message event")
		}

		validateDisplayAtMention := func(name string) {
			text := fmt.Sprintf("@%s", name)
			mustPostLocalForTest(t, ctc, users[1], conv,
				chat1.NewMessageBodyWithText(chat1.MessageText{Body: text}))
			select {
			case info := <-listener0.newMessage:
				require.True(t, info.DisplayDesktopNotification)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no new message event")
			}
		}
		validateDisplayAtMention(users[0].Username)

		_, err = ctc.as(t, users[0]).chatLocalHandler().SetAppNotificationSettingsLocal(ctx,
			chat1.SetAppNotificationSettingsLocalArg{
				ConvID:      conv.Id,
				ChannelWide: true,
			})
		require.NoError(t, err)
		select {
		case rsettings := <-listener0.appNotificationSettings:
			require.Equal(t, gconv.GetConvID(), rsettings.ConvID)
			require.True(t, rsettings.Settings.ChannelWide)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no app notification received")
		}
		validateDisplayAtMention("channel")
		validateDisplayAtMention("everyone")
		validateDisplayAtMention("here")
	})

}

func TestChatSrvTopicNameState(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvTopicNameState", 1)
		defer ctc.cleanup()
		users := ctc.users()

		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		ctx := ctc.as(t, users[0]).startCtx
		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()
		ri := ctc.as(t, users[0]).ri
		convRemote, _, err := GetUnverifiedConv(ctx, tc.Context(), uid, conv.Id, true)
		require.NoError(t, err)

		// Creating a conversation with same topic name just returns the matching one
		topicName := "random"
		ncarg := chat1.NewConversationLocalArg{
			TlfName:       conv.TlfName,
			TopicName:     &topicName,
			TopicType:     chat1.TopicType_CHAT,
			TlfVisibility: keybase1.TLFVisibility_PRIVATE,
			MembersType:   chat1.ConversationMembersType_TEAM,
		}
		ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx, ncarg)
		require.NoError(t, err)
		randomConvID := ncres.Conv.GetConvID()
		ncres, err = ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx, ncarg)
		require.NoError(t, err)
		require.Equal(t, randomConvID, ncres.Conv.GetConvID())

		// Try to change topic name to one that exists
		plarg := chat1.PostLocalArg{
			ConversationID: conv.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        conv.Triple,
					MessageType: chat1.MessageType_METADATA,
					TlfName:     conv.TlfName,
				},
				MessageBody: chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
					ConversationTitle: topicName,
				}),
			},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostLocal(ctx, plarg)
		require.Error(t, err)
		require.IsType(t, DuplicateTopicNameError{}, err)
		plarg.Msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
			ConversationTitle: "EULALIA",
		})
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostLocal(ctx, plarg)
		require.NoError(t, err)

		// Create race with topic name state, and make sure we do the right thing
		plarg.Msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
			ConversationTitle: "ANOTHERONE",
		})
		sender := NewBlockingSender(tc.Context(), NewBoxer(tc.Context()), nil,
			func() chat1.RemoteInterface { return ri })
		msg1, _, _, _, ts1, err := sender.Prepare(ctx, plarg.Msg, mt, &convRemote)
		require.NoError(t, err)
		msg2, _, _, _, ts2, err := sender.Prepare(ctx, plarg.Msg, mt, &convRemote)
		require.NoError(t, err)
		require.True(t, ts1.Eq(*ts2))

		/*_, err = ri.PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: conv.Id,
			MessageBoxed:   *msg1,
		})
		require.Error(t, err)
		require.IsType(t, libkb.ChatClientError{}, err)*/
		_, err = ri.PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: conv.Id,
			MessageBoxed:   *msg1,
			TopicNameState: ts1,
		})
		require.NoError(t, err)
		_, err = ri.PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: conv.Id,
			MessageBoxed:   *msg2,
			TopicNameState: ts2,
		})
		require.Error(t, err)
		require.IsType(t, libkb.ChatStalePreviousStateError{}, err)

	})
}

func TestChatSrvUnboxMobilePushNotification(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvUnboxMobilePushNotification", 1)
		defer ctc.cleanup()
		users := ctc.users()

		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctx := ctc.as(t, users[0]).startCtx
		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		convRemote, _, err := GetUnverifiedConv(ctx, tc.Context(), uid, conv.Id, true)
		require.NoError(t, err)
		plarg := chat1.PostLocalArg{
			ConversationID: conv.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        conv.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     conv.TlfName,
					Sender:      uid,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "PUSH",
				}),
			},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		ri := ctc.as(t, users[0]).ri
		sender := NewBlockingSender(tc.Context(), NewBoxer(tc.Context()), nil,
			func() chat1.RemoteInterface { return ri })
		msg, _, _, _, _, err := sender.Prepare(ctx, plarg.Msg, mt, &convRemote)
		require.NoError(t, err)
		msg.ServerHeader = &chat1.MessageServerHeader{
			MessageID: 10,
		}

		mh := codec.MsgpackHandle{WriteExt: true}
		var data []byte
		enc := codec.NewEncoderBytes(&data, &mh)
		require.NoError(t, enc.Encode(msg))
		encMsg := base64.StdEncoding.EncodeToString(data)
		unboxRes, err := ctc.as(t, users[0]).chatLocalHandler().UnboxMobilePushNotification(context.TODO(),
			chat1.UnboxMobilePushNotificationArg{
				ConvID:      conv.Id.String(),
				MembersType: mt,
				Payload:     encMsg,
			})
		require.NoError(t, err)
		require.Equal(t, fmt.Sprintf("%s (%s#%s): PUSH", users[0].Username, conv.TlfName, "general"),
			unboxRes)
	})
}

func TestChatSrvImplicitConversation(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		if mt != chat1.ConversationMembersType_IMPTEAM {
			return
		}
		ctc := makeChatTestContext(t, "ImplicitConversation", 2)
		defer ctc.cleanup()

		users := ctc.users()
		displayName := users[0].Username + "," + users[1].Username

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener)

		tc := ctc.world.Tcs[users[0].Username]
		ctx := ctc.as(t, users[0]).startCtx
		res, err := ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          displayName,
				MembersType:      chat1.ConversationMembersType_IMPTEAM,
				Visibility:       keybase1.TLFVisibility_PRIVATE,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		require.Equal(t, 0, len(res.Conversations), "conv found")

		// create a new conversation
		ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:          displayName,
				TlfVisibility:    keybase1.TLFVisibility_PRIVATE,
				TopicType:        chat1.TopicType_CHAT,
				MembersType:      chat1.ConversationMembersType_IMPTEAM,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)

		ctx = ctc.as(t, users[0]).startCtx
		uid := users[0].User.GetUID().ToBytes()
		conv, _, err := GetUnverifiedConv(ctx, tc.Context(), uid, ncres.Conv.Info.Id, false)
		require.NoError(t, err)
		require.NotEmpty(t, conv.MaxMsgSummaries, "created conversation does not have a message")
		require.Equal(t, ncres.Conv.Info.MembersType, chat1.ConversationMembersType_IMPTEAM, "implicit team")

		t.Logf("ncres tlf name: %s", ncres.Conv.Info.TlfName)

		// user 0 sends a message to conv
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
			ConversationID: ncres.Conv.Info.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        ncres.Conv.Info.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     ncres.Conv.Info.TlfName,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "HI",
				}),
			},
		})
		require.NoError(t, err)

		// check identify updates
		var update keybase1.CanonicalTLFNameAndIDWithBreaks
		select {
		case update = <-listener.identifyUpdate:
			t.Logf("identify update: %+v", update)
		case <-time.After(20 * time.Second):
			t.Fatal("timed out waiting for identify update")
		}
		require.EqualValues(t, update.CanonicalName, ncres.Conv.Info.TlfName)
		require.Empty(t, update.Breaks.Breaks)

		// user 1 sends a message to conv
		ctx = ctc.as(t, users[1]).startCtx
		_, err = ctc.as(t, users[1]).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
			ConversationID: ncres.Conv.Info.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        ncres.Conv.Info.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     ncres.Conv.Info.TlfName,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "Hello",
				}),
			},
		})
		require.NoError(t, err)

		// user 1 finds the conversation
		tc = ctc.world.Tcs[users[1].Username]
		ctx = ctc.as(t, users[1]).startCtx
		res, err = ctc.as(t, users[1]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          displayName,
				MembersType:      chat1.ConversationMembersType_IMPTEAM,
				Visibility:       keybase1.TLFVisibility_PRIVATE,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Conversations), "no convs found")
	})
}

func TestChatSrvImpTeamExistingKBFS(t *testing.T) {
	os.Setenv("KEYBASE_CHAT_MEMBER_TYPE", "impteam")
	defer os.Setenv("KEYBASE_CHAT_MEMBER_TYPE", "")
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	c1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, chat1.ConversationMembersType_KBFS, ctc.as(t, users[1]).user())
	c2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, chat1.ConversationMembersType_IMPTEAM, ctc.as(t, users[1]).user())

	t.Logf("c1: %v c2: %v", c1, c2)
	if !c2.Id.Eq(c1.Id) {
		t.Fatalf("2nd call to NewConversationLocal as IMPTEAM for a KBFS conversation did not return the same conversation ID")
	}
}

func TestChatSrvTeamTypeChanged(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvTeamTypeChanged", 2)
		defer ctc.cleanup()
		users := ctc.users()

		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctx := ctc.as(t, users[0]).startCtx
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)
		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().SetService()
		ctc.as(t, users[1]).h.G().NotifyRouter.SetListener(listener1)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener1, chat1.MessageType_JOIN)

		topicName := "zjoinonsend"
		channel, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       conv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		t.Logf("conv: %s chan: %s", conv.Id, channel.Conv.GetConvID())
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		select {
		case info := <-listener1.teamType:
			require.Equal(t, conv.Id, info.ConvID)
			require.Equal(t, chat1.TeamType_COMPLEX, info.TeamType)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no team type")
		}
		select {
		case info := <-listener0.teamType:
			require.Equal(t, conv.Id, info.ConvID)
			require.Equal(t, chat1.TeamType_COMPLEX, info.TeamType)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no team type")
		}

		inboxRes, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{
				Query: &chat1.GetInboxLocalQuery{
					ConvIDs: []chat1.ConversationID{conv.Id},
				},
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(inboxRes.Conversations))
		require.Equal(t, chat1.TeamType_COMPLEX, inboxRes.Conversations[0].Info.TeamType)
	})

}

func TestChatSrvDeleteConversation(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvTeamTypeChanged", 2)
		defer ctc.cleanup()
		users := ctc.users()

		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctx := ctc.as(t, users[0]).startCtx
		ctx1 := ctc.as(t, users[1]).startCtx
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)
		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().SetService()
		ctc.as(t, users[1]).h.G().NotifyRouter.SetListener(listener1)
		inboxCb := make(chan kbtest.NonblockInboxResult, 100)
		threadCb := make(chan kbtest.NonblockThreadResult, 100)
		ui := kbtest.NewChatUI(inboxCb, threadCb)
		ctc.as(t, users[0]).h.mockChatUI = ui
		ctc.as(t, users[1]).h.mockChatUI = ui

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener1, chat1.MessageType_JOIN)

		_, err := ctc.as(t, users[0]).chatLocalHandler().DeleteConversationLocal(ctx,
			chat1.DeleteConversationLocalArg{
				ConvID: conv.Id,
			})
		require.Error(t, err)
		require.IsType(t, libkb.ChatClientError{}, err)

		topicName := "zjoinonsend"
		channel, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       conv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		t.Logf("conv: %s chan: %s", conv.Id, channel.Conv.GetConvID())
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		consumeTeamType(t, listener0)
		consumeTeamType(t, listener1)
		consumeNewMsg(t, listener0, chat1.MessageType_TEXT)
		consumeNewMsg(t, listener1, chat1.MessageType_TEXT)

		_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationByIDLocal(ctx1,
			channel.Conv.GetConvID())
		require.NoError(t, err)
		consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsg(t, listener1, chat1.MessageType_JOIN)
		consumeMembersUpdate(t, listener0)
		consumeJoinConv(t, listener1)

		_, err = ctc.as(t, users[1]).chatLocalHandler().DeleteConversationLocal(ctx1,
			chat1.DeleteConversationLocalArg{
				ConvID: channel.Conv.GetConvID(),
			})
		require.Error(t, err)
		require.IsType(t, libkb.ChatClientError{}, err)

		_, err = ctc.as(t, users[0]).chatLocalHandler().DeleteConversationLocal(ctx,
			chat1.DeleteConversationLocalArg{
				ConvID: channel.Conv.GetConvID(),
			})
		require.NoError(t, err)
		consumeLeaveConv(t, listener0)
		consumeLeaveConv(t, listener1)
		consumeMembersUpdate(t, listener0)
		consumeMembersUpdate(t, listener1)
		consumeTeamType(t, listener0)
		consumeTeamType(t, listener1)

		iboxRes, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
	})
}

func TestChatSrvUserReset(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvUserReset", 2)
		defer ctc.cleanup()
		users := ctc.users()

		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAM:
		default:
			return
		}

		ctx := ctc.as(t, users[0]).startCtx
		ctx1 := ctc.as(t, users[1]).startCtx
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().SetService()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)
		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().SetService()
		ctc.as(t, users[1]).h.G().NotifyRouter.SetListener(listener1)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			consumeNewMsg(t, listener0, chat1.MessageType_JOIN)
			consumeNewMsg(t, listener1, chat1.MessageType_JOIN)
		default:
		}

		require.NoError(t, ctc.as(t, users[1]).h.G().LoginState().ResetAccount(users[1].Username))
		select {
		case act := <-listener0.membersUpdate:
			require.Equal(t, act.ConvID, conv.Id)
			require.Equal(t, chat1.ConversationMemberStatus_RESET, act.Status)
			require.Equal(t, users[1].Username, act.Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}
		select {
		case convID := <-listener1.resetConv:
			require.Equal(t, convID, conv.Id)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		iboxRes, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
		require.Equal(t, 2, len(iboxRes.Conversations[0].Info.WriterNames))
		require.Equal(t, 1, len(iboxRes.Conversations[0].Info.ResetNames))
		require.Equal(t, users[1].Username, iboxRes.Conversations[0].Info.ResetNames[0])

		iboxRes, err = ctc.as(t, users[1]).chatLocalHandler().GetInboxAndUnboxLocal(ctx1,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
		require.Equal(t, chat1.ConversationMemberStatus_RESET, iboxRes.Conversations[0].Info.MemberStatus)

		_, err = ctc.as(t, users[1]).chatLocalHandler().PostLocal(ctx1, chat1.PostLocalArg{
			ConversationID: conv.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        conv.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     conv.TlfName,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "Hello",
				}),
			},
		})
		require.Error(t, err)

		g1 := ctc.as(t, users[1]).h.G().ExternalG()
		require.NoError(t, g1.Logout())
		require.NoError(t, users[1].Login(g1))

		teamID, err := tlfIDToTeamdID(conv.Triple.Tlfid)
		require.NoError(t, err)
		require.NoError(t, teams.ReAddMemberAfterReset(ctx, ctc.as(t, users[0]).h.G().ExternalG(),
			teamID, users[1].Username))
		consumeMembersUpdate(t, listener0)
		consumeJoinConv(t, listener1)

		iboxRes, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
		require.Equal(t, 2, len(iboxRes.Conversations[0].Info.WriterNames))
		require.Zero(t, len(iboxRes.Conversations[0].Info.ResetNames))

		iboxRes, err = ctc.as(t, users[1]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
		require.Equal(t, 2, len(iboxRes.Conversations[0].Info.WriterNames))
		require.Zero(t, len(iboxRes.Conversations[0].Info.ResetNames))
		require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, iboxRes.Conversations[0].Info.MemberStatus)

		_, err = ctc.as(t, users[1]).chatLocalHandler().PostLocal(ctx1, chat1.PostLocalArg{
			ConversationID: conv.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        conv.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     conv.TlfName,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "Hello",
				}),
			},
		})
		require.NoError(t, err)
	})
}
