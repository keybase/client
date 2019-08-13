// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package chat

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/bots"
	"github.com/keybase/client/go/kbhttp/manager"

	"golang.org/x/net/context"

	"encoding/base64"

	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/chat/commands"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/chat/search"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/chat/wallet"
	"github.com/keybase/client/go/gregor"
	grutils "github.com/keybase/client/go/gregor/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"
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

func (g *gregorTestConnection) Connect(ctx context.Context) (err error) {
	defer g.Trace(ctx, func() error { return err }, "Connect")()
	uri, err := rpc.ParseFMPURI(g.G().Env.GetGregorURI())
	if err != nil {
		return err
	}
	opts := rpc.ConnectionOpts{
		TagsFunc:      logger.LogTagsFromContextRPC,
		WrapErrorFunc: libkb.MakeWrapError(g.G().ExternalG()),
	}
	trans := rpc.NewConnectionTransport(uri, libkb.NewRPCLogFactory(g.G().ExternalG()), libkb.MakeWrapError(g.G().ExternalG()), rpc.DefaultMaxFrameLength)
	conn := rpc.NewConnectionWithTransport(g, trans,
		libkb.NewContextifiedErrorUnwrapper(g.G().ExternalG()),
		logger.LogOutputWithDepthAdder{Logger: g.G().Log}, opts)
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
	if ibm := m.ToInBandMessage(); ibm != nil {
		if creation := ibm.ToStateUpdateMessage().Creation(); creation != nil {
			switch creation.Category().String() {
			case "team.sbs":
				var msg keybase1.TeamSBSMsg
				if err := json.Unmarshal(creation.Body().Bytes(), &msg); err != nil {
					g.G().Log.CDebugf(ctx, "error unmarshaling team.sbs item: %s", err)
					return err
				}
				teams.HandleSBSRequest(ctx, g.G().ExternalG(), msg)
			case "team.change":
				var msg []keybase1.TeamChangeRow
				if err := json.Unmarshal(creation.Body().Bytes(), &msg); err != nil {
					g.G().Log.CDebugf(ctx, "error unmarshaling team.change items: %s", err)
					return err
				}
				teams.HandleChangeNotification(ctx, g.G().ExternalG(), msg, keybase1.TeamChangeSet{})
			}
		}
	}
	return nil
}

func (g *gregorTestConnection) State(ctx context.Context) (gregor.State, error) {
	return gregor1.IncomingClient{Cli: g.cli}.State(ctx, gregor1.StateArg{
		Uid: g.uid,
	})
}

func (g *gregorTestConnection) UpdateCategory(ctx context.Context, cat string, body []byte,
	dtime gregor1.TimeOrOffset) (gregor1.MsgID, error) {
	msg, err := grutils.TemplateMessage(g.uid)
	if err != nil {
		return nil, err
	}
	msgID := msg.Ibm_.StateUpdate_.Md_.MsgID_
	msg.Ibm_.StateUpdate_.Creation_ = &gregor1.Item{
		Category_: gregor1.Category(cat),
		Body_:     gregor1.Body(body),
		Dtime_:    dtime,
	}
	msg.Ibm_.StateUpdate_.Dismissal_ = &gregor1.Dismissal{
		Ranges_: []gregor1.MsgRange{
			gregor1.MsgRange{
				Category_:   gregor1.Category(cat),
				SkipMsgIDs_: []gregor1.MsgID{msgID},
			}},
	}
	return msgID, gregor1.IncomingClient{Cli: g.cli}.ConsumeMessage(ctx, msg)
}

func (g *gregorTestConnection) DismissItem(ctx context.Context, cli gregor1.IncomingInterface, id gregor.MsgID) error {
	msg, err := grutils.FormMessageForDismissItem(ctx, g.uid, id)
	if err != nil {
		return err
	}
	return gregor1.IncomingClient{Cli: g.cli}.ConsumeMessage(ctx, msg.(gregor1.Message))
}

func (g *gregorTestConnection) InjectItem(ctx context.Context, cat string, body []byte,
	dtime gregor1.TimeOrOffset) (gregor1.MsgID, error) {
	msg, err := grutils.FormMessageForInjectItem(ctx, g.uid, cat, body, dtime)
	if err != nil {
		return nil, err
	}
	retMsgID := gregor1.MsgID(msg.ToInBandMessage().Metadata().MsgID().Bytes())
	return retMsgID, gregor1.IncomingClient{Cli: g.cli}.ConsumeMessage(ctx, msg.(gregor1.Message))
}

func (g *gregorTestConnection) LocalDismissItem(ctx context.Context, id gregor.MsgID) error {
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
	if tc.ChatG.CtxFactory == nil {
		g := globals.NewContext(tc.G, tc.ChatG)
		g.CtxFactory = NewCtxFactory(g)
	}
	return globals.ChatCtx(context.Background(), tc.Context(), keybase1.TLFIdentifyBehavior_CHAT_CLI,
		nil, NewCachingIdentifyNotifier(tc.Context()))
}

func newTestContextWithTlfMock(tc *kbtest.ChatTestContext, tlfMock types.NameInfoSource) context.Context {
	ctx := newTestContext(tc)
	return globals.CtxAddOverrideNameInfoSource(ctx, tlfMock)
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
	require.NoError(tc.T, err)

	name := fmt.Sprintf("TeAm%v", hex.EncodeToString(b))
	_, err = teams.CreateRootTeam(context.TODO(), tc.G, name, keybase1.TeamSettings{})
	require.NoError(tc.T, err)
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
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	t.Logf("Team Stage Begin")
	start := time.Now()
	f(chat1.ConversationMembersType_TEAM)
	t.Logf("Team Stage End: %v", time.Now().Sub(start))

	t.Logf("Implicit Team Stage Begin")
	os.Setenv("KEYBASE_FEATURES", "admin")
	defer os.Setenv("KEYBASE_FEATURES", "")
	start = time.Now()
	f(chat1.ConversationMembersType_IMPTEAMNATIVE)
	t.Logf("Implicit Team Stage End: %v", time.Now().Sub(start))
}

func runWithEphemeral(t *testing.T, mt chat1.ConversationMembersType, f func(ephemeralLifetime *gregor1.DurationSec)) {
	switch mt {
	case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAMUPGRADE, chat1.ConversationMembersType_IMPTEAMNATIVE:
		f(nil)
		lifetime := gregor1.DurationSec(24 * 60 * 60 * 6)
		f(&lifetime)
	default:
		f(nil)
	}
}

func runWithRetentionPolicyTypes(t *testing.T, f func(policy chat1.RetentionPolicy, ephemeralLifetime *gregor1.DurationSec)) {
	age := gregor1.DurationSec(1)
	t.Logf("using EXPIRE retention policy")
	f(chat1.NewRetentionPolicyWithExpire(chat1.RpExpire{Age: age}), nil)
	t.Logf("using EPHEMERAL retention policy")
	f(chat1.NewRetentionPolicyWithEphemeral(chat1.RpEphemeral{Age: age}), &age)
}

type chatTestUserContext struct {
	startCtx context.Context
	u        *kbtest.FakeUser
	h        *Server
	ri       chat1.RemoteInterface
	m        libkb.MetaContext
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
	require.NotNil(t, user)

	if tuc, ok := c.userContextCache[user.Username]; ok {
		return tuc
	}

	tc, ok := c.world.Tcs[user.Username]
	require.True(t, ok)
	g := globals.NewContext(tc.G, tc.ChatG)
	h := NewServer(g, nil, testUISource{})
	uid := gregor1.UID(user.User.GetUID().ToBytes())

	var tlf *kbtest.TlfMock
	var ri chat1.RemoteInterface
	if useRemoteMock {
		mockRemote := kbtest.NewChatRemoteMock(c.world)
		mockRemote.SetCurrentUser(user.User.GetUID().ToBytes())
		tlf = kbtest.NewTlfMock(c.world)
		ri = mockRemote
		ctx = newTestContextWithTlfMock(tc, tlf)
	} else {
		ctx = newTestContext(tc)
		nist, err := tc.G.ActiveDevice.NIST(context.TODO())
		require.NoError(t, err)
		sessionToken := nist.Token().String()
		gh := newGregorTestConnection(tc.Context(), uid, sessionToken)
		g.GregorState = gh
		require.NoError(t, gh.Connect(ctx))
		ri = gh.GetClient()
	}

	h.boxer = NewBoxer(g)

	chatStorage := storage.New(g, nil)
	chatStorage.SetClock(c.world.Fc)
	g.CtxFactory = NewCtxFactory(g)
	g.ConvSource = NewHybridConversationSource(g, h.boxer, chatStorage,
		func() chat1.RemoteInterface { return ri })
	chatStorage.SetAssetDeleter(g.ConvSource)
	g.InboxSource = NewHybridInboxSource(g, badges.NewBadger(g.ExternalG()),
		func() chat1.RemoteInterface { return ri })
	g.InboxSource.Start(context.TODO(), uid)
	g.InboxSource.Connected(context.TODO())
	g.ServerCacheVersions = storage.NewServerVersions(g)
	chatSyncer := NewSyncer(g)
	g.Syncer = chatSyncer
	g.ConnectivityMonitor = &libkb.NullConnectivityMonitor{}
	searcher := search.NewRegexpSearcher(g)
	// Force small pages during tests to ensure we fetch context from new pages
	searcher.SetPageSize(2)
	g.RegexpSearcher = searcher
	indexer := search.NewIndexer(g)
	ictx := globals.CtxAddIdentifyMode(context.Background(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil)
	indexer.Start(ictx, uid)
	indexer.SetPageSize(2)
	indexer.SetStartSyncDelay(0)
	g.Indexer = indexer

	h.setTestRemoteClient(ri)

	tc.G.SetService()
	baseSender := NewBlockingSender(g, h.boxer, func() chat1.RemoteInterface { return ri })
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
	g.EphemeralPurger = types.DummyEphemeralPurger{}
	g.CommandsSource = commands.NewSource(g)

	pushHandler := NewPushHandler(g)
	g.PushHandler = pushHandler
	g.TeamChannelSource = NewTeamChannelSource(g)
	g.AttachmentURLSrv = types.DummyAttachmentHTTPSrv{}
	g.ActivityNotifier = NewNotifyRouterActivityRouter(g)
	g.Unfurler = types.DummyUnfurler{}
	g.StellarLoader = types.DummyStellarLoader{}
	g.StellarSender = types.DummyStellarSender{}
	g.TeamMentionLoader = types.DummyTeamMentionLoader{}
	g.CoinFlipManager = NewFlipManager(g, func() chat1.RemoteInterface { return ri })
	g.CoinFlipManager.Start(context.TODO(), uid)
	g.BotCommandManager = bots.NewCachingBotCommandManager(g, func() chat1.RemoteInterface { return ri })
	g.BotCommandManager.Start(context.TODO(), uid)

	tc.G.ChatHelper = NewHelper(g, func() chat1.RemoteInterface { return ri })

	tuc := &chatTestUserContext{
		h:        h,
		u:        user,
		startCtx: ctx,
		ri:       ri,
		m:        libkb.NewMetaContext(ctx, tc.G),
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
		nil, keybase1.TLFVisibility_PUBLIC, membersType, others...)
	ctc.advanceFakeClock(time.Second)
	return created
}

func mustCreateConversationForTest(t *testing.T, ctc *chatTestContext, creator *kbtest.FakeUser,
	topicType chat1.TopicType, membersType chat1.ConversationMembersType, others ...*kbtest.FakeUser) (created chat1.ConversationInfoLocal) {
	created = mustCreateConversationForTestNoAdvanceClock(t, ctc, creator, topicType,
		nil, keybase1.TLFVisibility_PRIVATE, membersType, others...)
	ctc.advanceFakeClock(time.Second)
	return created
}

func mustCreateChannelForTest(t *testing.T, ctc *chatTestContext, creator *kbtest.FakeUser,
	topicType chat1.TopicType, topicName *string, membersType chat1.ConversationMembersType,
	others ...*kbtest.FakeUser) (created chat1.ConversationInfoLocal) {
	created = mustCreateConversationForTestNoAdvanceClock(t, ctc, creator, topicType,
		topicName, keybase1.TLFVisibility_PRIVATE, membersType, others...)
	ctc.advanceFakeClock(time.Second)
	return created
}

func mustCreateConversationForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext,
	creator *kbtest.FakeUser, topicType chat1.TopicType, topicName *string, visibility keybase1.TLFVisibility,
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
	case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAMNATIVE,
		chat1.ConversationMembersType_IMPTEAMUPGRADE:
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
			TlfName:          name,
			TopicType:        topicType,
			TopicName:        topicName,
			TlfVisibility:    visibility,
			MembersType:      membersType,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
	require.NoError(t, err)

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

func postLocalEphemeralForTest(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody, ephemeralLifetime *gregor1.DurationSec) (chat1.PostLocalRes, error) {
	defer ctc.advanceFakeClock(time.Second)
	mt, err := msg.MessageType()
	require.NoError(t, err)
	tc := ctc.as(t, asUser)
	var ephemeralMetadata *chat1.MsgEphemeralMetadata
	if ephemeralLifetime != nil {
		ephemeralMetadata = &chat1.MsgEphemeralMetadata{
			Lifetime: *ephemeralLifetime,
		}
	}
	return tc.chatLocalHandler().PostLocal(tc.startCtx, chat1.PostLocalArg{
		ConversationID: conv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:              conv.Triple,
				MessageType:       mt,
				TlfName:           conv.TlfName,
				EphemeralMetadata: ephemeralMetadata,
			},
			MessageBody: msg,
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
}

func mustPostLocalEphemeralForTest(t *testing.T, ctc *chatTestContext,
	asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody, ephemeralLifetime *gregor1.DurationSec) chat1.MessageID {
	res, err := postLocalEphemeralForTest(t, ctc, asUser, conv, msg, ephemeralLifetime)
	require.NoError(t, err)
	ctc.advanceFakeClock(time.Second)
	return res.MessageID
}

func postLocalForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) (chat1.PostLocalRes, error) {
	mt, err := msg.MessageType()
	require.NoError(t, err)
	tc := ctc.as(t, asUser)
	return tc.chatLocalHandler().PostLocal(tc.startCtx, chat1.PostLocalArg{
		ConversationID: conv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Triple,
				MessageType: mt,
				TlfName:     conv.TlfName,
			},
			MessageBody: msg,
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
}

func postLocalForTest(t *testing.T, ctc *chatTestContext,
	asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) (chat1.PostLocalRes, error) {
	defer ctc.advanceFakeClock(time.Second)
	return postLocalForTestNoAdvanceClock(t, ctc, asUser, conv, msg)
}

func mustPostLocalForTestNoAdvanceClock(t *testing.T, ctc *chatTestContext,
	asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) chat1.MessageID {
	x, err := postLocalForTestNoAdvanceClock(t, ctc, asUser, conv, msg)
	require.NoError(t, err)
	return x.MessageID
}

func mustPostLocalForTest(t *testing.T, ctc *chatTestContext,
	asUser *kbtest.FakeUser, conv chat1.ConversationInfoLocal, msg chat1.MessageBody) chat1.MessageID {
	msgID := mustPostLocalForTestNoAdvanceClock(t, ctc, asUser, conv, msg)
	ctc.advanceFakeClock(time.Second)
	return msgID
}

func mustSetConvRetentionLocal(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser,
	convID chat1.ConversationID, policy chat1.RetentionPolicy) {
	tc := ctc.as(t, asUser)
	err := tc.chatLocalHandler().SetConvRetentionLocal(tc.startCtx, chat1.SetConvRetentionLocalArg{
		ConvID: convID,
		Policy: policy,
	})
	require.NoError(t, err)
}

func mustSetTeamRetentionLocal(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser,
	teamID keybase1.TeamID, policy chat1.RetentionPolicy) {
	tc := ctc.as(t, asUser)
	err := tc.chatLocalHandler().SetTeamRetentionLocal(tc.startCtx, chat1.SetTeamRetentionLocalArg{
		TeamID: teamID,
		Policy: policy,
	})
	require.NoError(t, err)
}

func mustSetConvRetention(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser,
	convID chat1.ConversationID, policy chat1.RetentionPolicy, sweepChannel uint64) {
	tc := ctc.as(t, asUser)
	// Use the remote version instead of the local version in order to have access to sweepChannel.
	_, err := tc.ri.SetConvRetention(tc.startCtx, chat1.SetConvRetentionArg{
		ConvID:       convID,
		Policy:       policy,
		SweepChannel: sweepChannel,
	})
	require.NoError(t, err)
}

func mustSetTeamRetention(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser,
	teamID keybase1.TeamID, policy chat1.RetentionPolicy, sweepChannel uint64) {
	tc := ctc.as(t, asUser)
	// Use the remote version instead of the local version in order to have access to sweepChannel.
	_, err := tc.ri.SetTeamRetention(tc.startCtx, chat1.SetTeamRetentionArg{
		TeamID:       teamID,
		Policy:       policy,
		SweepChannel: sweepChannel,
	})
	require.NoError(t, err)
}

func mustJoinConversationByID(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, convID chat1.ConversationID) {
	tc := ctc.as(t, asUser)
	_, err := tc.chatLocalHandler().JoinConversationByIDLocal(tc.startCtx, convID)
	require.NoError(t, err)
}

// Make chatsweeperd run a particular conversation until messages are deleted.
// The RPC does not need to run as a particular user, that's just an easy way to get a remote client.
// Consumes expunge notifications from `listener` and returns the latest one.
// `upto` is optional (0 means any)
func sweepPollForDeletion(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, listener *serverChatListener, convID chat1.ConversationID, uptoWant chat1.MessageID) chat1.ExpungeInfo {
	t.Logf("sweepPollForDeletion(convID: %v, uptoWant: %v", convID, uptoWant)
	tc := ctc.as(t, asUser)
	maxTime := 5 * time.Second
	afterCh := time.After(maxTime)
	var foundTaskCount int
	var upto chat1.MessageID
	for i := 0; ; i++ {
		ctx := globals.ChatCtx(context.Background(), tc.h.G(), keybase1.TLFIdentifyBehavior_CLI, nil, nil)
		trace, _ := globals.CtxTrace(ctx)
		t.Logf("+ RetentionSweepConv(%v) (uptoWant %v) [chat-trace=%v]", convID.String(), uptoWant, trace)
		res, err := tc.ri.RetentionSweepConv(ctx, convID)
		t.Logf("- RetentionSweepConv res: %+v", res)
		require.NoError(t, err)
		if res.FoundTask {
			foundTaskCount++
		}
		if res.DeletedMessages {
			var expungeInfo chat1.ExpungeInfo
			for {
				expungeInfo = consumeExpunge(t, listener)
				if expungeInfo.Expunge == res.Expunge {
					break
				}
				t.Logf("sweepPollForDeletion %+v != %+v, trying consumeExpunge again",
					expungeInfo.Expunge, res.Expunge)
			}
			require.Equal(t, convID, expungeInfo.ConvID, "accidentally consumed expunge info for other conv")
			upto = res.Expunge.Upto
			if upto >= uptoWant {
				return expungeInfo
			}
			t.Logf("sweepPollForDeletion ignoring expungeInfo: %+v (uptoWant:%v)", expungeInfo.Expunge, uptoWant)
		}
		time.Sleep(10 * time.Millisecond)
		select {
		case <-afterCh:
			require.FailNow(t, fmt.Sprintf("no messages deleted after %v runs, %v hit, upto %v, %v",
				i, foundTaskCount, upto, maxTime))
		default:
		}
	}
}

// Sweep a conv and assert that no deletion occurred
func sweepNoDeletion(t *testing.T, ctc *chatTestContext, asUser *kbtest.FakeUser, convID chat1.ConversationID) {
	t.Logf("sweepNoDeletion(convID: %v)", convID)
	tc := ctc.as(t, asUser)
	res, err := tc.ri.RetentionSweepConv(tc.startCtx, convID)
	require.NoError(t, err)
	require.False(t, res.DeletedMessages, "messages deleted")
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
		conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, created.Id,
			types.InboxSourceDataSourceRemoteOnly)
		require.NoError(t, err)
		require.NotZero(t, len(conv.Conv.MaxMsgSummaries))
		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAMNATIVE:
			refName := string(kbtest.CanonicalTlfNameForTest(
				ctc.as(t, users[0]).user().Username + "," + ctc.as(t, users[1]).user().Username),
			)
			require.Equal(t, refName, conv.Conv.MaxMsgSummaries[0].TlfName)
		case chat1.ConversationMembersType_TEAM:
			teamName := ctc.teamCache[teamKey(ctc.users())]
			require.Equal(t, strings.ToLower(teamName), conv.Conv.MaxMsgSummaries[0].TlfName)
		}
	})
}

func TestChatSrvNewChatConversationLocalTwice(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "NewConversationLocalTwice", 2)
		defer ctc.cleanup()
		users := ctc.users()

		c1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		c2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		t.Logf("c1: %v c2: %v", c1, c2)
		require.True(t, c2.Id.Eq(c1.Id))
	})
}

func TestChatNewDevConversationLocalTwice(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "NewDevConversationLocalTwice", 2)
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
			TlfName:          conv.TlfName,
			TopicName:        &topicName,
			TopicType:        chat1.TopicType_CHAT,
			TlfVisibility:    keybase1.TLFVisibility_PRIVATE,
			MembersType:      mt,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		ncres, err := tc.chatLocalHandler().NewConversationLocal(tc.startCtx, arg)
		require.NoError(t, err)
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			require.NoError(t, err)
			require.Equal(t, topicName, ncres.Conv.Info.TopicName)
			require.NotEqual(t, conv.Id, ncres.Conv.GetConvID())
		case chat1.ConversationMembersType_KBFS:
			require.Equal(t, conv.Id, ncres.Conv.GetConvID())
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
		arg.TopicName = nil
		ncres, err = tc.chatLocalHandler().NewConversationLocal(tc.startCtx, arg)
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			require.NoError(t, err)
		case chat1.ConversationMembersType_TEAM:
			require.NoError(t, err)
			require.Equal(t, globals.DefaultTeamTopic, ncres.Conv.Info.TopicName)
		}
		arg.TopicName = &topicName
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
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
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

		conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, created.Id,
			types.InboxSourceDataSourceRemoteOnly)
		require.NoError(t, err)
		if conversations[0].Info.TlfName != conv.Conv.MaxMsgSummaries[0].TlfName {
			t.Fatalf("unexpected TlfName in response from GetInboxAndUnboxLocal. %s != %s (mt = %v)", conversations[0].Info.TlfName, conv.Conv.MaxMsgSummaries[0].TlfName, mt)
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
		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui

		var firstConv chat1.ConversationInfoLocal
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			firstConv = mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt, users[1:]...)
		default:
		}

		// Create a bunch of blank convos
		ctx := ctc.as(t, users[0]).startCtx
		convs := make(map[string]bool)
		for i := 0; i < numconvs; i++ {
			var created chat1.ConversationInfoLocal
			switch mt {
			case chat1.ConversationMembersType_TEAM:
				topicName := fmt.Sprintf("%d", i+1)
				ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
					chat1.NewConversationLocalArg{
						TlfName:          firstConv.TlfName,
						TopicName:        &topicName,
						TopicType:        chat1.TopicType_CHAT,
						TlfVisibility:    keybase1.TLFVisibility_PRIVATE,
						MembersType:      chat1.ConversationMembersType_TEAM,
						IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
					})
				require.NoError(t, err)
				created = ncres.Conv.Info
			default:
				created = mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
					mt, ctc.as(t, users[i+1]).user())
			}
			t.Logf("created: %s", created.Id)
			convs[created.Id.String()] = true

			mustPostLocalForTest(t, ctc, users[i+1], created,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: fmt.Sprintf("%d", i+1),
				}))
			time.Sleep(100 * time.Millisecond)
		}

		_, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
			chat1.GetInboxNonblockLocalArg{
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			},
		)
		require.NoError(t, err)

		// Account for initial team convo
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			numconvs++
		default:
		}

		select {
		case ibox := <-ui.InboxCb:
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
			case conv := <-ui.InboxCb:
				require.NotNil(t, conv.ConvRes, "no conv")
				delete(convs, conv.ConvID.String())
			case <-time.After(20 * time.Second):
				require.Fail(t, "no conv received")
			}
		}
		require.Equal(t, 0, len(convs), "didn't get all convs")

		_, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
			chat1.GetInboxNonblockLocalArg{
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			},
		)
		require.NoError(t, err)

		select {
		case ibox := <-ui.InboxCb:
			require.NotNil(t, ibox.InboxRes, "nil inbox")
			require.Equal(t, numconvs, len(ibox.InboxRes.Items))
			for index, conv := range ibox.InboxRes.Items {
				t.Logf("metadata snippet: index: %d snippet: %s time: %v", index, conv.LocalMetadata.Snippet,
					conv.Time)
			}
			sort.Slice(ibox.InboxRes.Items, func(i, j int) bool {
				return ibox.InboxRes.Items[i].Time.After(ibox.InboxRes.Items[j].Time)
			})
			for index, conv := range ibox.InboxRes.Items {
				require.NotNil(t, conv.LocalMetadata)
				switch mt {
				case chat1.ConversationMembersType_TEAM:
					if conv.ConvID == firstConv.Id.String() {
						continue
					}
					require.Equal(t, fmt.Sprintf("%d", numconvs-index-1), conv.LocalMetadata.ChannelName)
					require.Equal(t,
						fmt.Sprintf("%s: %d", users[numconvs-index-1].Username, numconvs-index-1),
						conv.LocalMetadata.Snippet)
					require.Zero(t, len(conv.LocalMetadata.WriterNames))
				default:
					require.Equal(t, fmt.Sprintf("%d", numconvs-index), conv.LocalMetadata.Snippet)
					require.Equal(t, 2, len(conv.LocalMetadata.WriterNames))
				}
			}
		case <-time.After(20 * time.Second):
			require.Fail(t, "no inbox received")
		}
		// Get all convos
		for i := 0; i < numconvs; i++ {
			select {
			case conv := <-ui.InboxCb:
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
		ui := kbtest.NewChatUI()
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
		case ibox := <-ui.InboxCb:
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
			case conv := <-ui.InboxCb:
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
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
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
		case ibox := <-ui.InboxCb:
			require.NotNil(t, ibox.InboxRes, "nil inbox")
			require.Equal(t, len(convs), len(ibox.InboxRes.Items), "wrong size inbox")
		case <-time.After(20 * time.Second):
			require.Fail(t, "no inbox received")
		}
		// Get all convos
		for i := 0; i < numconvs; i++ {
			select {
			case conv := <-ui.InboxCb:
				require.NotNil(t, conv.ConvRes, "no conv")
				delete(convs, conv.ConvID.String())
			case <-time.After(20 * time.Second):
				require.Fail(t, "no conv received")
			}
		}
		require.Equal(t, 0, len(convs), "didnt get all convs")

		// Make sure there is nothing left
		select {
		case <-ui.InboxCb:
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
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAMNATIVE,
			chat1.ConversationMembersType_IMPTEAMUPGRADE:
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
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		require.NoError(t, err)
		conversations := gilres.Conversations
		require.Equal(t, 1, len(conversations))
		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()
		conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, created.Id,
			types.InboxSourceDataSourceRemoteOnly)
		require.NoError(t, err)
		require.Equal(t, conversations[0].Info.TlfName, conv.Conv.MaxMsgSummaries[0].TlfName)
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
		tv, err := tc.Context().ConvSource.Pull(ctx, created.Id, uid, chat1.GetThreadReason_GENERAL, nil,
			nil)
		require.NoError(t, err)
		t.Logf("nmsg: %v", len(tv.Messages))
		require.NotZero(t, len(tv.Messages))
		msg := tv.Messages[0]

		if mt == chat1.ConversationMembersType_KBFS {
			require.NotEqual(t, created.TlfName, msg.Valid().ClientHeader.TlfName)
		}
		require.NotZero(t, len(msg.Valid().ClientHeader.Sender.Bytes()))
		require.NotZero(t, len(msg.Valid().ClientHeader.SenderDevice.Bytes()))

		t.Logf("try headline specific RPC interface")
		res, err := ctc.as(t, users[0]).chatLocalHandler().PostHeadline(ctx, chat1.PostHeadlineArg{
			ConversationID:   created.Id,
			TlfName:          created.TlfName,
			TlfPublic:        false,
			Headline:         "HI",
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		require.NoError(t, err)
		t.Logf("headline -> msgid:%v", res.MessageID)
		tv, err = tc.Context().ConvSource.Pull(ctx, created.Id, uid, chat1.GetThreadReason_GENERAL, nil,
			nil)
		require.NoError(t, err)
		t.Logf("nmsg: %v", len(tv.Messages))
		require.NotZero(t, len(tv.Messages))
		msg = tv.Messages[0]
		require.Equal(t, chat1.MessageType_HEADLINE, msg.GetMessageType())

		t.Logf("try delete-history RPC interface")
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostDeleteHistoryByAge(ctx, chat1.PostDeleteHistoryByAgeArg{
			ConversationID:   created.Id,
			TlfName:          created.TlfName,
			TlfPublic:        false,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			Age:              0,
		})
		require.NoError(t, err)
		tv, err = tc.Context().ConvSource.Pull(ctx, created.Id, uid, chat1.GetThreadReason_GENERAL, nil, nil)
		require.NoError(t, err)
		t.Logf("nmsg: %v", len(tv.Messages))
		// Teams don't use the remote mock. So PostDeleteHistoryByAge won't have gotten a good answer from GetMessageBefore.
		if useRemoteMock {
			t.Logf("check that the deletable messages are gone")
			for _, m := range tv.Messages {
				require.False(t, chat1.IsDeletableByDeleteHistory(m.GetMessageType()),
					"deletable message found: %v %v", m.GetMessageID(), m.GetMessageType())
			}
		}
	})
}

func TestChatSrvPostLocalAtMention(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "PostLocal", 2)
		defer ctc.cleanup()
		users := ctc.users()

		switch mt {
		case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAMNATIVE,
			chat1.ConversationMembersType_IMPTEAMUPGRADE:
			return
		}

		listener := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener)
		ctx := ctc.as(t, users[0]).startCtx

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		text := fmt.Sprintf("@%s", users[1].Username)
		mustPostLocalForTest(t, ctc, users[0], created,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: text}))

		select {
		case info := <-listener.newMessageRemote:
			require.True(t, info.Message.IsValid())
			require.Equal(t, chat1.MessageType_TEXT, info.Message.GetMessageType())
			require.Equal(t, 1, len(info.Message.Valid().AtMentions))
			require.Equal(t, users[1].Username, info.Message.Valid().AtMentions[0])
			require.True(t, info.DisplayDesktopNotification)
			require.NotEqual(t, "", info.DesktopNotificationSnippet)
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
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
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
		case info := <-listener.newMessageRemote:
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
		case info := <-listener.newMessageRemote:
			require.True(t, info.Message.IsValid())
			require.Equal(t, chat1.MessageType_TEXT, info.Message.GetMessageType())
			require.Zero(t, len(info.Message.Valid().AtMentions))
			require.Equal(t, chat1.ChannelMention_ALL, info.Message.Valid().ChannelMention)
			require.True(t, info.DisplayDesktopNotification)
			require.NotEqual(t, "", info.DesktopNotificationSnippet)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message")
		}

		// Test that system messages do the right thing
		subBody := chat1.NewMessageSystemWithAddedtoteam(chat1.MessageSystemAddedToTeam{
			Addee: users[1].Username,
		})
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithSystem(subBody))
		select {
		case info := <-listener.newMessageRemote:
			require.True(t, info.Message.IsValid())
			require.Equal(t, chat1.MessageType_SYSTEM, info.Message.GetMessageType())
			require.Equal(t, 1, len(info.Message.Valid().AtMentions))
			require.Equal(t, users[1].Username, info.Message.Valid().AtMentions[0])
			require.Equal(t, chat1.ChannelMention_NONE, info.Message.Valid().ChannelMention)
			require.True(t, info.DisplayDesktopNotification)
			require.NotEqual(t, "", info.DesktopNotificationSnippet)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message")
		}

		// Test that flip messages do the right thing
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithFlip(chat1.MessageFlip{
			Text: fmt.Sprintf("/flip @%s", users[1].Username),
		}))
		select {
		case info := <-listener.newMessageRemote:
			require.True(t, info.Message.IsValid())
			require.Equal(t, chat1.MessageType_FLIP, info.Message.GetMessageType())
			require.Equal(t, 1, len(info.Message.Valid().AtMentions))
			require.Equal(t, users[1].Username, info.Message.Valid().AtMentions[0])
			require.Equal(t, chat1.ChannelMention_NONE, info.Message.Valid().ChannelMention)
			require.True(t, info.DisplayDesktopNotification)
			require.NotEqual(t, "", info.DesktopNotificationSnippet)
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

		var created chat1.ConversationInfoLocal
		var dev chat1.ConversationInfoLocal
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			firstConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
				mt, ctc.as(t, users[1]).user())
			topicName := "MIKE"
			ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(context.TODO(),
				chat1.NewConversationLocalArg{
					TlfName:       firstConv.TlfName,
					TopicName:     &topicName,
					TopicType:     chat1.TopicType_CHAT,
					TlfVisibility: keybase1.TLFVisibility_PRIVATE,
					MembersType:   chat1.ConversationMembersType_TEAM,
				})
			require.NoError(t, err)
			created = ncres.Conv.Info
		default:
			created = mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
				mt, ctc.as(t, users[1]).user())
		}
		dev = mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_DEV,
			mt, ctc.as(t, users[1]).user())

		// text msg
		maxTextBody := strings.Repeat(".", msgchecker.TextMessageMaxLength)
		_, err := postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: maxTextBody}))
		require.NoError(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: maxTextBody + "!"}))
		require.Error(t, err)

		// dev text
		maxDevTextBody := strings.Repeat(".", msgchecker.DevTextMessageMaxLength)
		_, err = postLocalForTest(t, ctc, users[0], dev,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: maxDevTextBody}))
		require.NoError(t, err)
		_, err = postLocalForTest(t, ctc, users[0], dev,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: maxDevTextBody + "!"}))
		require.Error(t, err)

		// headline
		maxHeadlineBody := strings.Repeat(".", msgchecker.HeadlineMaxLength)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: maxHeadlineBody}))
		require.NoError(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: maxHeadlineBody + "!"}))
		require.Error(t, err)

		// topic
		maxTopicBody := strings.Repeat("a", msgchecker.TopicMaxLength)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: maxTopicBody}))
		require.NoError(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: maxTopicBody + "a"}))
		require.Error(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: "#mike"}))
		require.Error(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: "mii.ke"}))
		require.Error(t, err)

		// request payment
		maxPaymentNote := strings.Repeat(".", msgchecker.RequestPaymentTextMaxLength)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithRequestpayment(
			chat1.MessageRequestPayment{
				RequestID: stellar1.KeybaseRequestID("dummy id"),
				Note:      maxPaymentNote,
			}))
		require.NoError(t, err)
		_, err = postLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithRequestpayment(
			chat1.MessageRequestPayment{
				RequestID: stellar1.KeybaseRequestID("dummy id"),
				Note:      maxPaymentNote + "!",
			}))
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
		msgID1, err := postLocalForTest(t, ctc, users[0], created,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		require.NoError(t, err)
		t.Logf("msgID1: %d", msgID1.MessageID)

		ctx := ctc.as(t, users[0]).startCtx
		tvres, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: created.Id,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			},
		})
		require.NoError(t, err)

		tv := tvres.Thread
		expectedMessages := 1
		require.Len(t, tv.Messages, expectedMessages,
			"unexpected response from GetThreadLocal . number of messages")
		require.Equal(t, "hello!", tv.Messages[0].Valid().MessageBody.Text().Body)

		// Test message ID control
		plres, err := postLocalForTest(t, ctc, users[0], created,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		require.NoError(t, err)
		t.Logf("msgID2: %d", plres.MessageID)
		msgID3, err := postLocalForTest(t, ctc, users[0], created,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		require.NoError(t, err)
		t.Logf("msgID3: %d", msgID3.MessageID)
		tvres, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: created.Id,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
				MessageIDControl: &chat1.MessageIDControl{
					Pivot: &plres.MessageID,
					Mode:  chat1.MessageIDControlMode_NEWERMESSAGES,
					Num:   1,
				},
			},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(tvres.Thread.Messages))
		require.Equal(t, msgID3.MessageID, tvres.Thread.Messages[0].GetMessageID())
		tvres, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: created.Id,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
				MessageIDControl: &chat1.MessageIDControl{
					Pivot: &plres.MessageID,
					Mode:  chat1.MessageIDControlMode_OLDERMESSAGES,
					Num:   1,
				},
			},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(tvres.Thread.Messages))
		require.Equal(t, msgID1.MessageID, tvres.Thread.Messages[0].GetMessageID())

		tvres, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: created.Id,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
				MessageIDControl: &chat1.MessageIDControl{
					Num: 2,
				},
			},
		})
		require.NoError(t, err)
		require.Equal(t, 2, len(tvres.Thread.Messages))
		require.Equal(t, msgID3.MessageID, tvres.Thread.Messages[0].GetMessageID())
		require.Equal(t, plres.MessageID, tvres.Thread.Messages[1].GetMessageID())
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
				require.NotEqual(t, res.Conversations[0].ReaderInfo.ReadMsgid, m.GetMessageID())
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
				require.Equal(t, res.Conversations[0].ReaderInfo.ReadMsgid,
					m.GetMessageID())
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
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "innocent hello"}))
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "evil hello"}))

		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)

		// make evil hello evil
		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()
		require.NoError(t, tc.Context().ConvSource.Clear(context.TODO(), created.Id, uid))

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

		require.Len(t, tv.Thread.Messages, 3,
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
			t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 1 item, got %d\n", len(res.Conversations))
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
			t.Fatalf("unexpected response from GetInboxSummaryForCLILocal . expected 1 item, got %d\n", len(res.Conversations))
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
		}, nil, nil, nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
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
		tc.G.NotifyRouter.AddListener(listener)

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

		updates := consumeNewThreadsStale(t, listener)
		require.Equal(t, 1, len(updates))
		require.Equal(t, created.Id, updates[0].ConvID, "wrong cid")
		require.Equal(t, chat1.StaleUpdateType_CLEAR, updates[0].UpdateType)

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

type resolveRes struct {
	convID chat1.ConversationID
	info   chat1.ConversationResolveInfo
}

type serverChatListener struct {
	libkb.NoopNotifyListener

	// ChatActivity channels
	newMessageLocal         chan chat1.IncomingMessage
	newMessageRemote        chan chat1.IncomingMessage
	newConversation         chan chat1.NewConversationInfo
	membersUpdate           chan chat1.MembersUpdateInfo
	appNotificationSettings chan chat1.SetAppNotificationSettingsInfo
	teamType                chan chat1.TeamTypeInfo
	expunge                 chan chat1.ExpungeInfo
	ephemeralPurge          chan chat1.EphemeralPurgeNotifInfo
	reactionUpdate          chan chat1.ReactionUpdateNotif
	messagesUpdated         chan chat1.MessagesUpdated
	readMessage             chan chat1.ReadMessageInfo
	convsUpdated            chan []chat1.InboxUIItem

	threadsStale     chan []chat1.ConversationStaleUpdate
	inboxStale       chan struct{}
	joinedConv       chan *chat1.InboxUIItem
	leftConv         chan chat1.ConversationID
	resetConv        chan chat1.ConversationID
	identifyUpdate   chan keybase1.CanonicalTLFNameAndIDWithBreaks
	inboxSynced      chan chat1.ChatSyncResult
	setConvRetention chan chat1.ConversationID
	setTeamRetention chan keybase1.TeamID
	setConvSettings  chan chat1.ConversationID
	kbfsUpgrade      chan chat1.ConversationID
	resolveConv      chan resolveRes
	subteamRename    chan []chat1.ConversationID
	unfurlPrompt     chan chat1.MessageID
	setStatus        chan chat1.SetStatusInfo
}

var _ libkb.NotifyListener = (*serverChatListener)(nil)

func (n *serverChatListener) ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	n.identifyUpdate <- update
}
func (n *serverChatListener) ChatInboxStale(uid keybase1.UID) {
	n.inboxStale <- struct{}{}
}
func (n *serverChatListener) ChatThreadsStale(uid keybase1.UID, cids []chat1.ConversationStaleUpdate) {
	n.threadsStale <- cids
}
func (n *serverChatListener) ChatInboxSynced(uid keybase1.UID, topicType chat1.TopicType,
	syncRes chat1.ChatSyncResult) {
	switch topicType {
	case chat1.TopicType_CHAT, chat1.TopicType_NONE:
		n.inboxSynced <- syncRes
	}
}
func (n *serverChatListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity,
	source chat1.ChatActivitySource) {
	typ, _ := activity.ActivityType()
	switch typ {
	case chat1.ChatActivityType_INCOMING_MESSAGE:
		switch source {
		case chat1.ChatActivitySource_LOCAL:
			n.newMessageLocal <- activity.IncomingMessage()
		case chat1.ChatActivitySource_REMOTE:
			n.newMessageRemote <- activity.IncomingMessage()
		}
	case chat1.ChatActivityType_READ_MESSAGE:
		n.readMessage <- activity.ReadMessage()
	case chat1.ChatActivityType_NEW_CONVERSATION:
		n.newConversation <- activity.NewConversation()
	case chat1.ChatActivityType_MEMBERS_UPDATE:
		n.membersUpdate <- activity.MembersUpdate()
	case chat1.ChatActivityType_SET_APP_NOTIFICATION_SETTINGS:
		n.appNotificationSettings <- activity.SetAppNotificationSettings()
	case chat1.ChatActivityType_TEAMTYPE:
		n.teamType <- activity.Teamtype()
	case chat1.ChatActivityType_EXPUNGE:
		n.expunge <- activity.Expunge()
	case chat1.ChatActivityType_EPHEMERAL_PURGE:
		n.ephemeralPurge <- activity.EphemeralPurge()
	case chat1.ChatActivityType_REACTION_UPDATE:
		n.reactionUpdate <- activity.ReactionUpdate()
	case chat1.ChatActivityType_MESSAGES_UPDATED:
		n.messagesUpdated <- activity.MessagesUpdated()
	case chat1.ChatActivityType_SET_STATUS:
		n.setStatus <- activity.SetStatus()
	case chat1.ChatActivityType_CONVS_UPDATED:
		n.convsUpdated <- activity.ConvsUpdated().Items
	}
}
func (n *serverChatListener) ChatJoinedConversation(uid keybase1.UID, convID chat1.ConversationID,
	conv *chat1.InboxUIItem) {
	n.joinedConv <- conv
}
func (n *serverChatListener) ChatLeftConversation(uid keybase1.UID, convID chat1.ConversationID) {
	n.leftConv <- convID
}
func (n *serverChatListener) ChatResetConversation(uid keybase1.UID, convID chat1.ConversationID) {
	n.resetConv <- convID
}
func (n *serverChatListener) ChatTLFResolve(uid keybase1.UID, convID chat1.ConversationID,
	info chat1.ConversationResolveInfo) {
	n.resolveConv <- resolveRes{
		convID: convID,
		info:   info,
	}
}
func (n *serverChatListener) ChatSetConvRetention(uid keybase1.UID, convID chat1.ConversationID) {
	n.setConvRetention <- convID
}
func (n *serverChatListener) ChatSetTeamRetention(uid keybase1.UID, teamID keybase1.TeamID) {
	n.setTeamRetention <- teamID
}
func (n *serverChatListener) ChatSetConvSettings(uid keybase1.UID, convID chat1.ConversationID) {
	n.setConvSettings <- convID
}
func (n *serverChatListener) ChatKBFSToImpteamUpgrade(uid keybase1.UID, convID chat1.ConversationID) {
	n.kbfsUpgrade <- convID
}
func (n *serverChatListener) ChatSubteamRename(uid keybase1.UID, convIDs []chat1.ConversationID) {
	n.subteamRename <- convIDs
}
func (n *serverChatListener) ChatPromptUnfurl(uid keybase1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, domain string) {
	n.unfurlPrompt <- msgID
}
func newServerChatListener() *serverChatListener {
	buf := 100
	return &serverChatListener{
		newMessageLocal:         make(chan chat1.IncomingMessage, buf),
		newMessageRemote:        make(chan chat1.IncomingMessage, buf),
		newConversation:         make(chan chat1.NewConversationInfo, buf),
		readMessage:             make(chan chat1.ReadMessageInfo, buf),
		membersUpdate:           make(chan chat1.MembersUpdateInfo, buf),
		appNotificationSettings: make(chan chat1.SetAppNotificationSettingsInfo, buf),
		teamType:                make(chan chat1.TeamTypeInfo, buf),
		expunge:                 make(chan chat1.ExpungeInfo, buf),
		ephemeralPurge:          make(chan chat1.EphemeralPurgeNotifInfo, buf),
		reactionUpdate:          make(chan chat1.ReactionUpdateNotif, buf),
		messagesUpdated:         make(chan chat1.MessagesUpdated, buf),
		convsUpdated:            make(chan []chat1.InboxUIItem, buf),

		threadsStale:     make(chan []chat1.ConversationStaleUpdate, buf),
		inboxStale:       make(chan struct{}, buf),
		joinedConv:       make(chan *chat1.InboxUIItem, buf),
		leftConv:         make(chan chat1.ConversationID, buf),
		resetConv:        make(chan chat1.ConversationID, buf),
		identifyUpdate:   make(chan keybase1.CanonicalTLFNameAndIDWithBreaks, buf),
		inboxSynced:      make(chan chat1.ChatSyncResult, buf),
		setConvRetention: make(chan chat1.ConversationID, buf),
		setTeamRetention: make(chan keybase1.TeamID, buf),
		setConvSettings:  make(chan chat1.ConversationID, buf),
		kbfsUpgrade:      make(chan chat1.ConversationID, buf),
		resolveConv:      make(chan resolveRes, buf),
		subteamRename:    make(chan []chat1.ConversationID, buf),
		unfurlPrompt:     make(chan chat1.MessageID, buf),
		setStatus:        make(chan chat1.SetStatusInfo, buf),
	}
}

func TestChatSrvPostLocalNonblock(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		runWithEphemeral(t, mt, func(ephemeralLifetime *gregor1.DurationSec) {
			ctc := makeChatTestContext(t, "PostLocalNonblock", 2)
			defer ctc.cleanup()
			users := ctc.users()

			ui := kbtest.NewChatUI()
			ctc.as(t, users[0]).h.mockChatUI = ui
			tc := ctc.as(t, users[0])
			listener := newServerChatListener()
			ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
			ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true
			if ephemeralLifetime != nil {
				tc.m.G().GetUPAKLoader().ClearMemory()
			}

			assertEphemeral := func(ephemeralLifetime *gregor1.DurationSec, unboxed chat1.UIMessage) {
				valid := unboxed.Valid()
				require.False(t, valid.IsEphemeralExpired)
				require.Nil(t, valid.ExplodedBy)
				require.False(t, valid.MessageBody.IsNil())
				if ephemeralLifetime == nil {
					require.False(t, valid.IsEphemeral)
					require.EqualValues(t, valid.Etime, 0)
				} else {
					require.True(t, valid.IsEphemeral)
					lifetime := ephemeralLifetime.ToDuration()
					require.True(t, time.Now().Add(lifetime).Sub(valid.Etime.Time()) <= lifetime)
				}
			}

			assertNotEphemeral := func(ephemeralLifetime *gregor1.DurationSec, unboxed chat1.UIMessage) {
				valid := unboxed.Valid()
				require.False(t, valid.IsEphemeralExpired)
				require.False(t, valid.IsEphemeral)
				require.EqualValues(t, valid.Etime, 0)
				require.Nil(t, valid.ExplodedBy)
				require.False(t, valid.MessageBody.IsNil())
			}

			assertReactionUpdate := func(convID chat1.ConversationID, targetMsgID chat1.MessageID, reactionMap chat1.ReactionMap) {
				info := consumeReactionUpdate(t, listener)
				require.Equal(t, convID, info.ConvID)
				require.Len(t, info.ReactionUpdates, 1)
				reactionUpdate := info.ReactionUpdates[0]
				require.Equal(t, targetMsgID, reactionUpdate.TargetMsgID)
				for _, reactions := range reactionUpdate.Reactions.Reactions {
					for k, r := range reactions {
						require.NotZero(t, r.Ctime)
						r.Ctime = 0
						reactions[k] = r
					}
				}
				require.Equal(t, reactionMap, reactionUpdate.Reactions)
			}

			var err error
			var created chat1.ConversationInfoLocal
			switch mt {
			case chat1.ConversationMembersType_TEAM:
				first := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
					mt, ctc.as(t, users[1]).user())
				consumeNewConversation(t, listener, first.Id)
				topicName := "mike"
				ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(tc.startCtx,
					chat1.NewConversationLocalArg{
						TlfName:       first.TlfName,
						TopicName:     &topicName,
						TopicType:     chat1.TopicType_CHAT,
						TlfVisibility: keybase1.TLFVisibility_PRIVATE,
						MembersType:   chat1.ConversationMembersType_TEAM,
					})
				require.NoError(t, err)
				created = ncres.Conv.Info
				consumeNewConversation(t, listener, created.Id)
				consumeNewMsgLocal(t, listener, chat1.MessageType_JOIN)
				consumeNewMsgRemote(t, listener, chat1.MessageType_JOIN)
				consumeNewPendingMsg(t, listener)
				consumeNewMsgLocal(t, listener, chat1.MessageType_SYSTEM)
				consumeNewMsgRemote(t, listener, chat1.MessageType_SYSTEM)
			default:
				created = mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
					mt, ctc.as(t, users[1]).user())
			}

			t.Logf("send a text message")
			arg := chat1.PostTextNonblockArg{
				ConversationID:   created.Id,
				TlfName:          created.TlfName,
				TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
				Body:             "hi",
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			}
			res, err := ctc.as(t, users[0]).chatLocalHandler().PostTextNonblock(tc.startCtx, arg)
			require.NoError(t, err)
			consumeNewPendingMsg(t, listener)
			var unboxed chat1.UIMessage
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, chat1.MessageType_TEXT, unboxed.GetMessageType(), "invalid type")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_TEXT)

			t.Logf("post text message with prefetched outbox ID")
			genOutboxID, err := ctc.as(t, users[0]).chatLocalHandler().GenerateOutboxID(context.TODO())
			require.NoError(t, err)
			arg = chat1.PostTextNonblockArg{
				ConversationID:    created.Id,
				TlfName:           created.TlfName,
				TlfPublic:         created.Visibility == keybase1.TLFVisibility_PUBLIC,
				Body:              "hi",
				OutboxID:          &genOutboxID,
				IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
				EphemeralLifetime: ephemeralLifetime,
			}
			res, err = ctc.as(t, users[0]).chatLocalHandler().PostTextNonblock(tc.startCtx, arg)
			require.NoError(t, err)
			consumeNewMsgLocal(t, listener, chat1.MessageType_TEXT) // pending message

			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, genOutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, chat1.MessageType_TEXT, unboxed.GetMessageType(), "invalid type")
				assertEphemeral(ephemeralLifetime, unboxed)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_TEXT)

			textUnboxed := unboxed

			t.Logf("react to the message")
			// An ephemeralLifetime is added if we are reacting to an ephemeral message
			reactionKey := ":+1:"
			rarg := chat1.PostReactionNonblockArg{
				ConversationID:   created.Id,
				TlfName:          created.TlfName,
				TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
				Supersedes:       textUnboxed.GetMessageID(),
				Body:             reactionKey,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			}
			res, err = ctc.as(t, users[0]).chatLocalHandler().PostReactionNonblock(tc.startCtx, rarg)
			require.NoError(t, err)
			consumeNewPendingMsg(t, listener)
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, chat1.MessageType_REACTION, unboxed.GetMessageType(), "invalid type")
				assertEphemeral(ephemeralLifetime, unboxed)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_REACTION)
			reactionUnboxed := unboxed
			expectedReactionMap := chat1.ReactionMap{
				Reactions: map[string]map[string]chat1.Reaction{
					":+1:": map[string]chat1.Reaction{
						users[0].Username: chat1.Reaction{
							ReactionMsgID: reactionUnboxed.GetMessageID(),
						},
					},
				},
			}
			assertReactionUpdate(created.Id, textUnboxed.GetMessageID(), expectedReactionMap)

			t.Logf("edit the message")
			// An ephemeralLifetime is added if we are editing an ephemeral message
			targetMsgID := textUnboxed.GetMessageID()
			earg := chat1.PostEditNonblockArg{
				ConversationID: created.Id,
				TlfName:        created.TlfName,
				TlfPublic:      created.Visibility == keybase1.TLFVisibility_PUBLIC,
				Target: chat1.EditTarget{
					MessageID: &targetMsgID,
				},
				Body:             "hi2",
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			}
			res, err = ctc.as(t, users[0]).chatLocalHandler().PostEditNonblock(tc.startCtx, earg)
			require.NoError(t, err)
			consumeNewPendingMsg(t, listener)
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, chat1.MessageType_EDIT, unboxed.GetMessageType(), "invalid type")
				assertEphemeral(ephemeralLifetime, unboxed)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_EDIT)

			// Repost a reaction and ensure it is deleted
			t.Logf("repost reaction = delete reaction")
			res, err = ctc.as(t, users[0]).chatLocalHandler().PostReactionNonblock(tc.startCtx, rarg)
			require.NoError(t, err)
			consumeNewPendingMsg(t, listener)
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, chat1.MessageType_DELETE, unboxed.GetMessageType(), "invalid type")
				assertNotEphemeral(ephemeralLifetime, unboxed)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_DELETE)
			assertReactionUpdate(created.Id, textUnboxed.GetMessageID(), chat1.ReactionMap{})

			t.Logf("delete the message")
			darg := chat1.PostDeleteNonblockArg{
				ConversationID:   created.Id,
				TlfName:          created.TlfName,
				TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
				Supersedes:       textUnboxed.GetMessageID(),
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			}
			res, err = ctc.as(t, users[0]).chatLocalHandler().PostDeleteNonblock(tc.startCtx, darg)
			require.NoError(t, err)
			consumeNewPendingMsg(t, listener)
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, chat1.MessageType_DELETE, unboxed.GetMessageType(), "invalid type")
				assertNotEphemeral(ephemeralLifetime, unboxed)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_DELETE)

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
			consumeNewPendingMsg(t, listener)
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, chat1.MessageType_HEADLINE, unboxed.GetMessageType(), "invalid type")
				switch mt {
				case chat1.ConversationMembersType_TEAM:
					require.Equal(t, headline, unboxed.Valid().MessageBody.Headline().Headline)
				}
				assertNotEphemeral(ephemeralLifetime, unboxed)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_HEADLINE)

			t.Logf("change name")
			topicName := "NEWNAME"
			marg := chat1.PostMetadataNonblockArg{
				ConversationID:   created.Id,
				TlfName:          created.TlfName,
				TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				ChannelName:      topicName,
			}
			res, err = ctc.as(t, users[0]).chatLocalHandler().PostMetadataNonblock(tc.startCtx, marg)
			require.NoError(t, err)
			consumeNewPendingMsg(t, listener)
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, chat1.MessageType_METADATA, unboxed.GetMessageType(), "invalid type")
				switch mt {
				case chat1.ConversationMembersType_TEAM:
					require.Equal(t, topicName, unboxed.Valid().MessageBody.Metadata().ConversationTitle)
				}
				assertNotEphemeral(ephemeralLifetime, unboxed)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_METADATA)
		})
	})
}

func filterOutboxMessages(tv chat1.ThreadView) (res []chat1.MessageUnboxed) {
	for _, m := range tv.Messages {
		if !m.IsOutbox() {
			res = append(res, m)
		}
	}
	return res
}

func TestChatSrvPostEditNonblock(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			return
		}
		ctc := makeChatTestContext(t, "TestChatSrvPostEditNonblock", 1)
		defer ctc.cleanup()
		users := ctc.users()

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
		tc := ctc.world.Tcs[users[0].Username]
		tc.ChatG.Syncer.(*Syncer).isConnected = true
		ctx := ctc.as(t, users[0]).startCtx
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		t.Logf("test convID: %x", conv.Id.DbShortForm())
		checkMessage := func(intended string, num int) {
			res, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
				ConversationID: conv.Id,
				Query: &chat1.GetThreadQuery{
					MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
				},
			})
			require.NoError(t, err)
			thread := filterOutboxMessages(res.Thread)
			require.Equal(t, num, len(thread))
			require.True(t, thread[0].IsValid())
			require.Equal(t, intended, thread[0].Valid().MessageBody.Text().Body)
		}

		outboxID, err := storage.NewOutboxID()
		require.NoError(t, err)
		postRes, err := ctc.as(t, users[0]).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
			ConversationID: conv.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        conv.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     conv.TlfName,
					OutboxID:    &outboxID,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "hi",
				}),
			},
		})
		require.NoError(t, err)
		consumeNewMsgLocal(t, listener, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostEditNonblock(ctx, chat1.PostEditNonblockArg{
			ConversationID: conv.Id,
			TlfName:        conv.TlfName,
			Target: chat1.EditTarget{
				MessageID: &postRes.MessageID,
			},
			Body: "hi!",
		})
		require.NoError(t, err)
		consumeNewMsgLocal(t, listener, chat1.MessageType_EDIT)
		consumeNewMsgRemote(t, listener, chat1.MessageType_EDIT)
		checkMessage("hi!", 1)

		_, err = ctc.as(t, users[0]).chatLocalHandler().PostEditNonblock(ctx, chat1.PostEditNonblockArg{
			ConversationID: conv.Id,
			TlfName:        conv.TlfName,
			Target: chat1.EditTarget{
				OutboxID: &outboxID,
			},
			Body: "hi!!",
		})
		require.NoError(t, err)
		consumeNewMsgLocal(t, listener, chat1.MessageType_EDIT)
		consumeNewMsgRemote(t, listener, chat1.MessageType_EDIT)
		checkMessage("hi!!", 1)
	})
}

func TestChatSrvFindConversations(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_KBFS:
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

func TestChatSrvFindConversationsWithSBS(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_KBFS:
			return
		}

		ctc := makeChatTestContext(t, "FindConversations", 2)
		defer ctc.cleanup()
		users := ctc.users()

		// Create a conversation between both users. Attempt to send to
		// `user1,user2@rooter` and make sure we resolve and find the
		// conversation correctly.
		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, users[1])
		tc1 := ctc.world.Tcs[users[1].Username]
		sbsName := strings.Join([]string{users[0].Username, fmt.Sprintf("%s@rooter", users[1].Username)}, ",")

		ctx := ctc.as(t, users[0]).startCtx
		// Fail since we haven't proved rooter yet
		res, err := ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          sbsName,
				MembersType:      mt,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		require.Zero(t, len(res.Conversations))

		proveRooter(t, tc1.Context().ExternalG(), users[1])
		res, err = ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          sbsName,
				MembersType:      mt,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Conversations), "no conv found")
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

func TestChatSrvGetThreadNonblockServerPage(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvGetThreadNonblockIncremental", 1)
		defer ctc.cleanup()
		users := ctc.users()

		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui

		query := chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}
		ctx := ctc.as(t, users[0]).startCtx
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)

		t.Logf("send a bunch of messages")
		numMsgs := 5
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		for i := 0; i < numMsgs; i++ {
			mustPostLocalForTest(t, ctc, users[0], conv, msg)
		}

		// Basic
		delay := 10 * time.Minute
		clock := clockwork.NewFakeClock()
		ctc.as(t, users[0]).h.uiThreadLoader.clock = clock
		ctc.as(t, users[0]).h.uiThreadLoader.cachedThreadDelay = nil
		ctc.as(t, users[0]).h.uiThreadLoader.remoteThreadDelay = &delay
		ctc.as(t, users[0]).h.uiThreadLoader.validatedDelay = 0
		cb := make(chan struct{})
		p := utils.PresentPagination(&chat1.Pagination{
			Num: 1,
		})
		go func() {
			_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
				chat1.GetThreadNonblockArg{
					ConversationID:   conv.Id,
					IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
					Query:            &query,
					Pagination:       p,
					Pgmode:           chat1.GetThreadNonblockPgMode_SERVER,
				},
			)
			require.NoError(t, err)
			close(cb)
		}()
		clock.Advance(50 * time.Millisecond)
		select {
		case res := <-ui.ThreadCb:
			require.False(t, res.Full)
			require.Equal(t, 1, len(res.Thread.Messages))
			require.NotNil(t, res.Thread.Pagination)
			require.False(t, res.Thread.Pagination.Last)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		clock.Advance(20 * time.Minute)
		select {
		case res := <-ui.ThreadCb:
			require.True(t, res.Full)
			require.Equal(t, 1, len(res.Thread.Messages))
			require.Equal(t, chat1.MessageID(6), res.Thread.Messages[0].GetMessageID())
			p = res.Thread.Pagination
			require.NotNil(t, p)
			require.False(t, p.Last)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		select {
		case <-cb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "GetThread never finished")
		}

		cb = make(chan struct{})
		p.Num = 1
		p.Next = "deadbeef"
		go func() {
			_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
				chat1.GetThreadNonblockArg{
					ConversationID:   conv.Id,
					IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
					Query:            &query,
					Pagination:       p,
					Pgmode:           chat1.GetThreadNonblockPgMode_SERVER,
				},
			)
			require.NoError(t, err)
			close(cb)
		}()
		clock.Advance(50 * time.Millisecond)
		select {
		case res := <-ui.ThreadCb:
			require.False(t, res.Full)
			require.Equal(t, 1, len(res.Thread.Messages))
			require.NotNil(t, res.Thread.Pagination)
			require.False(t, res.Thread.Pagination.Last)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		clock.Advance(20 * time.Minute)
		select {
		case res := <-ui.ThreadCb:
			require.True(t, res.Full)
			require.Equal(t, 1, len(res.Thread.Messages))
			require.Equal(t, chat1.MessageID(5), res.Thread.Messages[0].GetMessageID())
			p = res.Thread.Pagination
			require.NotNil(t, p)
			require.False(t, p.Last)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		select {
		case <-cb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "GetThread never finished")
		}

		for i := 0; i < 5; i++ {
			p.Num = 50
			cb = make(chan struct{})
			go func() {
				_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
					chat1.GetThreadNonblockArg{
						ConversationID:   conv.Id,
						IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
						Query:            &query,
						Pagination:       p,
						Pgmode:           chat1.GetThreadNonblockPgMode_SERVER,
					},
				)
				require.NoError(t, err)
				close(cb)
			}()
			clock.Advance(50 * time.Millisecond)
			if i == 0 {
				select {
				case res := <-ui.ThreadCb:
					require.False(t, res.Full)
					require.Equal(t, 3, len(res.Thread.Messages))
					require.NotNil(t, res.Thread.Pagination)
					require.True(t, res.Thread.Pagination.Last)
				case <-time.After(20 * time.Second):
					require.Fail(t, "no thread cb")
				}
			} else {
				select {
				case <-ui.ThreadCb:
					require.Fail(t, "no callback expected")
				default:
				}
			}
			clock.Advance(20 * time.Minute)
			if i == 0 {
				select {
				case res := <-ui.ThreadCb:
					require.True(t, res.Full)
					require.Equal(t, 3, len(res.Thread.Messages))
					require.Equal(t, chat1.MessageID(4), res.Thread.Messages[0].GetMessageID())
					require.NotNil(t, res.Thread.Pagination.Last)
					require.True(t, res.Thread.Pagination.Last)
				case <-time.After(20 * time.Second):
					require.Fail(t, "no thread cb")
				}
			} else {
				select {
				case <-ui.ThreadCb:
					require.Fail(t, "no callback expected")
				default:
				}
			}
			select {
			case <-cb:
			case <-time.After(20 * time.Second):
				require.Fail(t, "GetThread never finished")
			}
		}
	})
}

func TestChatSrvGetThreadNonblockIncremental(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvGetThreadNonblockIncremental", 1)
		defer ctc.cleanup()
		users := ctc.users()

		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui

		query := chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}
		ctx := ctc.as(t, users[0]).startCtx
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)

		t.Logf("send a bunch of messages")
		numMsgs := 20
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		for i := 0; i < numMsgs; i++ {
			mustPostLocalForTest(t, ctc, users[0], conv, msg)
		}

		// Basic
		delay := 10 * time.Minute
		clock := clockwork.NewFakeClock()
		ctc.as(t, users[0]).h.uiThreadLoader.clock = clock
		ctc.as(t, users[0]).h.uiThreadLoader.cachedThreadDelay = nil
		ctc.as(t, users[0]).h.uiThreadLoader.remoteThreadDelay = &delay
		ctc.as(t, users[0]).h.uiThreadLoader.validatedDelay = 0
		cb := make(chan struct{})
		go func() {
			_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
				chat1.GetThreadNonblockArg{
					ConversationID:   conv.Id,
					IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
					Query:            &query,
				},
			)
			require.NoError(t, err)
			close(cb)
		}()
		clock.Advance(50 * time.Millisecond)
		select {
		case res := <-ui.ThreadCb:
			require.False(t, res.Full)
			require.Equal(t, numMsgs, len(res.Thread.Messages))
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		clock.Advance(20 * time.Minute)
		select {
		case res := <-ui.ThreadCb:
			require.True(t, res.Full)
			require.Equal(t, numMsgs, len(res.Thread.Messages))
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		select {
		case <-cb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "GetThread never finished")
		}

		// Incremental
		cb = make(chan struct{})
		go func() {
			_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
				chat1.GetThreadNonblockArg{
					ConversationID:   conv.Id,
					IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
					Query:            &query,
					CbMode:           chat1.GetThreadNonblockCbMode_INCREMENTAL,
				},
			)
			require.NoError(t, err)
			close(cb)
		}()
		clock.Advance(50 * time.Millisecond)
		select {
		case res := <-ui.ThreadCb:
			require.False(t, res.Full)
			require.Equal(t, numMsgs, len(res.Thread.Messages))
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		mustPostLocalForTest(t, ctc, users[0], conv, msg)
		clock.Advance(20 * time.Minute)
		select {
		case res := <-ui.ThreadCb:
			require.True(t, res.Full)
			require.Equal(t, 1, len(res.Thread.Messages))
			require.True(t, res.Thread.Pagination.Last)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		select {
		case <-cb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "GetThread never finished")
		}

	})
}

func msgState(t *testing.T, msg chat1.UIMessage) chat1.MessageUnboxedState {
	state, err := msg.State()
	require.NoError(t, err)
	return state
}

func confirmIsPlaceholder(t *testing.T, msgID chat1.MessageID, msg chat1.UIMessage, hidden bool) {
	require.Equal(t, msgID, msg.GetMessageID())
	require.Equal(t, chat1.MessageUnboxedState_PLACEHOLDER, msgState(t, msg))
	require.Equal(t, hidden, msg.Placeholder().Hidden)
}

func confirmIsText(t *testing.T, msgID chat1.MessageID, msg chat1.UIMessage, text string) {
	require.Equal(t, msgID, msg.GetMessageID())
	require.Equal(t, chat1.MessageUnboxedState_VALID, msgState(t, msg))
	require.Equal(t, chat1.MessageType_TEXT, msg.GetMessageType())
	require.Equal(t, text, msg.Valid().MessageBody.Text().Body)
}

func TestChatSrvGetThreadNonblockSupersedes(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetThreadNonblockSupersedes", 1)
		defer ctc.cleanup()
		users := ctc.users()

		uid := gregor1.UID(users[0].GetUID().ToBytes())
		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		ctx := ctc.as(t, users[0]).startCtx
		<-ctc.as(t, users[0]).h.G().ConvLoader.Stop(ctx)
		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		cs := ctc.world.Tcs[users[0].Username].ChatG.ConvSource
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		msgID1 := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		msgRes, err := ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(ctx, chat1.GetMessagesLocalArg{
			ConversationID:           conv.Id,
			MessageIDs:               []chat1.MessageID{msgID1},
			DisableResolveSupersedes: true,
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(msgRes.Messages))
		msg1 := msgRes.Messages[0]
		editMsgID1 := mustEditMsg(ctx, t, ctc, users[0], conv, msgID1)
		consumeNewMsgRemote(t, listener, chat1.MessageType_EDIT)

		msgIDs := []chat1.MessageID{editMsgID1, msgID1, 1}
		require.NoError(t, cs.Clear(context.TODO(), conv.Id, uid))
		err = cs.PushUnboxed(ctx, conv.Id, uid, []chat1.MessageUnboxed{msg1})
		require.NoError(t, err)

		delay := 10 * time.Minute
		clock := clockwork.NewFakeClock()
		ctc.as(t, users[0]).h.uiThreadLoader.clock = clock
		ctc.as(t, users[0]).h.uiThreadLoader.cachedThreadDelay = nil
		ctc.as(t, users[0]).h.uiThreadLoader.remoteThreadDelay = &delay
		ctc.as(t, users[0]).h.uiThreadLoader.validatedDelay = 0
		cb := make(chan struct{})
		query := chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}
		go func() {
			_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
				chat1.GetThreadNonblockArg{
					ConversationID: conv.Id,
					Query:          &query,
					CbMode:         chat1.GetThreadNonblockCbMode_INCREMENTAL,
				},
			)
			require.NoError(t, err)
			close(cb)
		}()
		clock.Advance(50 * time.Millisecond)
		select {
		case res := <-ui.ThreadCb:
			require.False(t, res.Full)
			require.Equal(t, len(msgIDs), len(res.Thread.Messages))
			// Not unread
			require.Equal(t, msgIDs, utils.PluckUIMessageIDs(res.Thread.Messages))
			confirmIsText(t, msgID1, res.Thread.Messages[1], "hi")
			require.False(t, res.Thread.Messages[1].Valid().Superseded)
			confirmIsPlaceholder(t, editMsgID1, res.Thread.Messages[0], false)
			confirmIsPlaceholder(t, 1, res.Thread.Messages[2], false)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		clock.Advance(20 * time.Minute)
		select {
		case res := <-ui.ThreadCb:
			require.True(t, res.Full)
			require.Equal(t, len(msgIDs), len(res.Thread.Messages))
			// Not unread
			confirmIsPlaceholder(t, editMsgID1, res.Thread.Messages[0], true)
			confirmIsText(t, msgID1, res.Thread.Messages[1], "edited")
			confirmIsPlaceholder(t, 1, res.Thread.Messages[2], true)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		select {
		case <-cb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "GetThread never finished")
		}

		deleteMsgID := mustDeleteMsg(ctx, t, ctc, users[0], conv, msgID1)
		consumeNewMsgRemote(t, listener, chat1.MessageType_DELETE)
		msgIDs = []chat1.MessageID{deleteMsgID, editMsgID1, msgID1, 1}
		require.NoError(t, cs.Clear(context.TODO(), conv.Id, uid))
		err = cs.PushUnboxed(ctx, conv.Id, uid, []chat1.MessageUnboxed{msg1})
		require.NoError(t, err)
		cb = make(chan struct{})
		go func() {
			_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
				chat1.GetThreadNonblockArg{
					ConversationID: conv.Id,
					Query:          &query,
					CbMode:         chat1.GetThreadNonblockCbMode_INCREMENTAL,
				},
			)
			require.NoError(t, err)
			close(cb)
		}()
		clock.Advance(50 * time.Millisecond)
		select {
		case res := <-ui.ThreadCb:
			require.False(t, res.Full)
			require.Equal(t, len(msgIDs), len(res.Thread.Messages))
			// Not unread
			require.Equal(t, msgIDs, utils.PluckUIMessageIDs(res.Thread.Messages))
			confirmIsPlaceholder(t, deleteMsgID, res.Thread.Messages[0], false)
			confirmIsPlaceholder(t, editMsgID1, res.Thread.Messages[1], false)
			confirmIsText(t, msgID1, res.Thread.Messages[2], "hi")
			require.False(t, res.Thread.Messages[2].Valid().Superseded)
			confirmIsPlaceholder(t, 1, res.Thread.Messages[3], false)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		clock.Advance(20 * time.Minute)
		select {
		case res := <-ui.ThreadCb:
			require.True(t, res.Full)
			require.Equal(t, len(msgIDs), len(res.Thread.Messages))
			// Not unread
			confirmIsPlaceholder(t, deleteMsgID, res.Thread.Messages[0], true)
			confirmIsPlaceholder(t, editMsgID1, res.Thread.Messages[1], true)
			confirmIsPlaceholder(t, msgID1, res.Thread.Messages[2], true)
			confirmIsPlaceholder(t, 1, res.Thread.Messages[3], true)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		select {
		case <-cb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "GetThread never finished")
		}
	})
}

func TestChatSrvGetUnreadLine(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetUnreadLine", 2)
		defer ctc.cleanup()
		users := ctc.users()

		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		ctc.as(t, users[1]).h.mockChatUI = ui
		ctx1 := ctc.as(t, users[0]).startCtx
		ctx2 := ctc.as(t, users[1]).startCtx
		<-ctc.as(t, users[0]).h.G().ConvLoader.Stop(ctx1)
		<-ctc.as(t, users[1]).h.G().ConvLoader.Stop(ctx2)
		listener1 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener1)
		listener2 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener2)
		g1 := ctc.world.Tcs[users[0].Username].ChatG
		g2 := ctc.world.Tcs[users[1].Username].ChatG

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt, users[1])
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		msgID1 := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_TEXT)

		mustEditMsg(ctx1, t, ctc, users[0], conv, msgID1)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_EDIT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_EDIT)

		assertUnreadline := func(ctx context.Context, g *globals.ChatContext, user *kbtest.FakeUser,
			readMsgID, unreadLineID chat1.MessageID) {
			for i := 0; i < 1; i++ {
				if i == 0 {
					require.NoError(t, g.ConvSource.Clear(ctx, conv.Id, user.GetUID().ToBytes()))
				}
				res, err := ctc.as(t, user).chatLocalHandler().GetUnreadline(ctx,
					chat1.GetUnreadlineArg{
						ConvID:    conv.Id,
						ReadMsgID: readMsgID,
					})
				require.NoError(t, err)
				if unreadLineID == 0 {
					require.Nil(t, res.UnreadlineID)
				} else {
					require.NotNil(t, res.UnreadlineID)
					require.Equal(t, unreadLineID, *res.UnreadlineID)
				}
			}
		}

		// user2 will have an unread id of the TEXT message even after the edit
		assertUnreadline(ctx1, g1, users[0], 1, msgID1)
		assertUnreadline(ctx1, g1, users[0], msgID1, 0)
		assertUnreadline(ctx2, g2, users[1], 1, msgID1)
		assertUnreadline(ctx2, g2, users[1], msgID1, 0)

		// subsequent TEXT post leaves unreadline unchanged.
		msg = chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		msgID2 := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_TEXT)
		assertUnreadline(ctx2, g2, users[1], 1, msgID1)
		// If user2 has read to msgID1, msgID2 is the next candidate
		assertUnreadline(ctx2, g2, users[1], msgID1, msgID2)

		// reaction does not affect things
		mustReactToMsg(ctx1, t, ctc, users[0], conv, msgID2, ":+1:")
		consumeNewMsgRemote(t, listener1, chat1.MessageType_REACTION)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_REACTION)
		assertUnreadline(ctx2, g2, users[1], 1, msgID1)

		// user2 will bump unreadLineID to msgID which the next visible msg
		mustDeleteMsg(ctx1, t, ctc, users[0], conv, msgID1)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETE)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETE)
		assertUnreadline(ctx2, g2, users[1], 1, msgID2)

		// user2 will have no unread id since the only visible message was now deleted
		msgID3 := mustDeleteMsg(ctx1, t, ctc, users[0], conv, msgID2)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETE)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_DELETE)
		assertUnreadline(ctx2, g2, users[1], 1, 0)

		// if we are fully read, there is no line and we don't go to the server
		g1.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return chat1.RemoteClient{Cli: errorClient{}}
		})
		assertUnreadline(ctx1, g1, users[0], msgID3, 0)
		g2.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return chat1.RemoteClient{Cli: errorClient{}}
		})
		assertUnreadline(ctx2, g2, users[1], msgID3, 0)
	})
}

func mustDeleteHistory(ctx context.Context, t *testing.T, ctc *chatTestContext, user *kbtest.FakeUser,
	conv chat1.ConversationInfoLocal, upto chat1.MessageID) chat1.MessageID {
	delH := chat1.MessageDeleteHistory{
		Upto: upto,
	}
	postRes, err := ctc.as(t, user).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
		ConversationID: conv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:          conv.Triple,
				MessageType:   chat1.MessageType_DELETEHISTORY,
				TlfName:       conv.TlfName,
				DeleteHistory: &delH,
			},
			MessageBody: chat1.NewMessageBodyWithDeletehistory(delH),
		},
	})
	require.NoError(t, err)
	return postRes.MessageID
}

func mustDeleteMsg(ctx context.Context, t *testing.T, ctc *chatTestContext, user *kbtest.FakeUser,
	conv chat1.ConversationInfoLocal, msgID chat1.MessageID) chat1.MessageID {
	postRes, err := ctc.as(t, user).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
		ConversationID: conv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Triple,
				MessageType: chat1.MessageType_DELETE,
				TlfName:     conv.TlfName,
				Supersedes:  msgID,
			},
		},
	})
	require.NoError(t, err)
	return postRes.MessageID
}

func mustEditMsg(ctx context.Context, t *testing.T, ctc *chatTestContext, user *kbtest.FakeUser,
	conv chat1.ConversationInfoLocal, msgID chat1.MessageID) chat1.MessageID {
	postRes, err := ctc.as(t, user).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
		ConversationID: conv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Triple,
				MessageType: chat1.MessageType_EDIT,
				TlfName:     conv.TlfName,
				Supersedes:  msgID,
			},
			MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
				MessageID: msgID,
				Body:      "edited",
			}),
		},
	})
	require.NoError(t, err)
	return postRes.MessageID
}

func mustReactToMsg(ctx context.Context, t *testing.T, ctc *chatTestContext, user *kbtest.FakeUser,
	conv chat1.ConversationInfoLocal, msgID chat1.MessageID, reaction string) chat1.MessageID {
	postRes, err := ctc.as(t, user).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
		ConversationID: conv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Triple,
				MessageType: chat1.MessageType_REACTION,
				TlfName:     conv.TlfName,
				Supersedes:  msgID,
			},
			MessageBody: chat1.NewMessageBodyWithReaction(chat1.MessageReaction{
				MessageID: msgID,
				Body:      reaction,
			}),
		},
	})
	require.NoError(t, err)
	return postRes.MessageID
}

func TestChatSrvGetThreadNonblockPlaceholders(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetThreadNonblockPlaceholders", 1)
		defer ctc.cleanup()
		users := ctc.users()

		uid := gregor1.UID(users[0].GetUID().ToBytes())
		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		ctx := ctc.as(t, users[0]).startCtx
		<-ctc.as(t, users[0]).h.G().ConvLoader.Stop(ctx)
		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		cs := ctc.world.Tcs[users[0].Username].ChatG.ConvSource
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		msgID1 := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		editMsgID1 := mustEditMsg(ctx, t, ctc, users[0], conv, msgID1)
		consumeNewMsgRemote(t, listener, chat1.MessageType_EDIT)
		msgID2 := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		editMsgID2 := mustEditMsg(ctx, t, ctc, users[0], conv, msgID2)
		consumeNewMsgRemote(t, listener, chat1.MessageType_EDIT)
		msgID3 := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		msgRes, err := ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(ctx, chat1.GetMessagesLocalArg{
			ConversationID: conv.Id,
			MessageIDs:     []chat1.MessageID{msgID3},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(msgRes.Messages))
		msg3 := msgRes.Messages[0]
		msgIDs := []chat1.MessageID{msgID3, editMsgID2, msgID2, editMsgID1, msgID1, 1}

		require.NoError(t, cs.Clear(context.TODO(), conv.Id, uid))
		err = cs.PushUnboxed(ctx, conv.Id, uid, []chat1.MessageUnboxed{msg3})
		require.NoError(t, err)

		delay := 10 * time.Minute
		clock := clockwork.NewFakeClock()
		ctc.as(t, users[0]).h.uiThreadLoader.clock = clock
		ctc.as(t, users[0]).h.uiThreadLoader.cachedThreadDelay = nil
		ctc.as(t, users[0]).h.uiThreadLoader.remoteThreadDelay = &delay
		ctc.as(t, users[0]).h.uiThreadLoader.validatedDelay = 0
		cb := make(chan struct{})
		query := chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}
		go func() {
			_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
				chat1.GetThreadNonblockArg{
					ConversationID: conv.Id,
					Query:          &query,
					CbMode:         chat1.GetThreadNonblockCbMode_INCREMENTAL,
				},
			)
			require.NoError(t, err)
			close(cb)
		}()
		select {
		case res := <-ui.ThreadCb:
			require.False(t, res.Full)
			require.Equal(t, len(msgIDs), len(res.Thread.Messages))
			require.Equal(t, msgIDs, utils.PluckUIMessageIDs(res.Thread.Messages))
			confirmIsText(t, msgID3, res.Thread.Messages[0], "hi")
			confirmIsPlaceholder(t, editMsgID2, res.Thread.Messages[1], false)
			confirmIsPlaceholder(t, msgID2, res.Thread.Messages[2], false)
			confirmIsPlaceholder(t, editMsgID1, res.Thread.Messages[3], false)
			confirmIsPlaceholder(t, msgID1, res.Thread.Messages[4], false)
			confirmIsPlaceholder(t, 1, res.Thread.Messages[5], false)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		clock.Advance(20 * time.Minute)
		select {
		case res := <-ui.ThreadCb:
			require.True(t, res.Full)
			require.Equal(t, len(msgIDs)-1, len(res.Thread.Messages))
			confirmIsPlaceholder(t, editMsgID2, res.Thread.Messages[0], true)
			confirmIsText(t, msgID2, res.Thread.Messages[1], "edited")
			confirmIsPlaceholder(t, editMsgID1, res.Thread.Messages[2], true)
			confirmIsText(t, msgID1, res.Thread.Messages[3], "edited")
			confirmIsPlaceholder(t, 1, res.Thread.Messages[4], true)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		select {
		case <-cb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "GetThread never finished")
		}
	})
}

func TestChatSrvGetThreadNonblockPlaceholderFirst(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetThreadNonblockPlaceholdersFirst", 1)
		defer ctc.cleanup()
		users := ctc.users()

		uid := gregor1.UID(users[0].GetUID().ToBytes())
		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		ctx := ctc.as(t, users[0]).startCtx
		<-ctc.as(t, users[0]).h.G().ConvLoader.Stop(ctx)
		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		tc := ctc.world.Tcs[users[0].Username]
		cs := tc.ChatG.ConvSource
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		msgID1 := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		msgID2 := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		msgRes, err := ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(ctx, chat1.GetMessagesLocalArg{
			ConversationID: conv.Id,
			MessageIDs:     []chat1.MessageID{msgID1},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(msgRes.Messages))
		msg1 := msgRes.Messages[0]
		msgIDs := []chat1.MessageID{msgID2, msgID1, 1}

		require.NoError(t, cs.Clear(context.TODO(), conv.Id, uid))
		err = cs.PushUnboxed(ctx, conv.Id, uid, []chat1.MessageUnboxed{msg1})
		require.NoError(t, err)

		delay := 10 * time.Minute
		clock := clockwork.NewFakeClock()
		ctc.as(t, users[0]).h.uiThreadLoader.clock = clock
		ctc.as(t, users[0]).h.uiThreadLoader.cachedThreadDelay = nil
		ctc.as(t, users[0]).h.uiThreadLoader.remoteThreadDelay = &delay
		ctc.as(t, users[0]).h.uiThreadLoader.validatedDelay = 0
		cb := make(chan struct{})
		query := chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}
		go func() {
			_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
				chat1.GetThreadNonblockArg{
					ConversationID: conv.Id,
					Query:          &query,
					CbMode:         chat1.GetThreadNonblockCbMode_INCREMENTAL,
				},
			)
			require.NoError(t, err)
			close(cb)
		}()
		clock.Advance(50 * time.Millisecond)
		select {
		case res := <-ui.ThreadCb:
			require.False(t, res.Full)
			require.Equal(t, len(msgIDs), len(res.Thread.Messages))
			require.Equal(t, msgIDs, utils.PluckUIMessageIDs(res.Thread.Messages))
			confirmIsPlaceholder(t, msgID2, res.Thread.Messages[0], false)
			confirmIsText(t, msgID1, res.Thread.Messages[1], "hi")
			confirmIsPlaceholder(t, 1, res.Thread.Messages[2], false)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		clock.Advance(20 * time.Minute)
		select {
		case res := <-ui.ThreadCb:
			require.True(t, res.Full)
			require.Equal(t, len(msgIDs)-1, len(res.Thread.Messages))
			confirmIsText(t, msgID2, res.Thread.Messages[0], "hi")
			confirmIsPlaceholder(t, 1, res.Thread.Messages[1], true)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no thread cb")
		}
		select {
		case <-cb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "GetThread never finished")
		}
	})
}

func TestChatSrvGetThreadNonblockOldPages(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		if mt == chat1.ConversationMembersType_KBFS {
			return
		}
		ctc := makeChatTestContext(t, "GetThreadNonblock", 1)
		defer ctc.cleanup()
		users := ctc.users()

		uid := gregor1.UID(users[0].GetUID().ToBytes())
		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		ctx := ctc.as(t, users[0]).startCtx
		bgConvLoads := make(chan chat1.ConversationID, 10)
		ctc.as(t, users[0]).h.G().ConvLoader.Start(ctx, uid)
		ctc.as(t, users[0]).h.G().ConvLoader.(*BackgroundConvLoader).loads = bgConvLoads

		t.Logf("send a bunch of messages")
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		// need two for new conversation, plus the gregor message
		for i := 0; i < 2; i++ {
			select {
			case <-bgConvLoads:
			case <-time.After(20 * time.Second):
				require.Fail(t, "no bkg load")
			}
		}
		numMsgs := 20
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		for i := 0; i < numMsgs; i++ {
			mustPostLocalForTest(t, ctc, users[0], conv, msg)
		}
		select {
		case <-bgConvLoads:
			require.Fail(t, "no more bg loads")
		default:
		}
		_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
			chat1.GetThreadNonblockArg{
				ConversationID:   conv.Id,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				Pagination:       utils.PresentPagination(&chat1.Pagination{Num: 1}),
			},
		)
		require.NoError(t, err)
		res := receiveThreadResult(t, ui.ThreadCb)
		require.Equal(t, 1, len(res.Messages))
		select {
		case <-bgConvLoads:
		case <-time.After(20 * time.Second):
			require.Fail(t, "no bkg load")
		}
		select {
		case <-bgConvLoads:
			require.Fail(t, "no more bg loads")
		default:
		}
	})
}

func TestChatSrvGetThreadNonblock(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetThreadNonblock", 1)
		defer ctc.cleanup()
		users := ctc.users()

		ui := kbtest.NewChatUI()
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
		res := receiveThreadResult(t, ui.ThreadCb)
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
		res = receiveThreadResult(t, ui.ThreadCb)
		require.Equal(t, numMsgs, len(res.Messages))

		t.Logf("read back with a delay on the local pull")

		delay := 10 * time.Minute
		clock := clockwork.NewFakeClock()
		ctc.as(t, users[0]).h.uiThreadLoader.clock = clock
		ctc.as(t, users[0]).h.uiThreadLoader.cachedThreadDelay = &delay
		_, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
			chat1.GetThreadNonblockArg{
				ConversationID:   conv.Id,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				Query:            &query,
			},
		)
		require.NoError(t, err)
		res = receiveThreadResult(t, ui.ThreadCb)
		require.Equal(t, numMsgs, len(res.Messages))
		clock.Advance(20 * time.Minute)
		select {
		case <-ui.ThreadCb:
			require.Fail(t, "no cb expected")
		default:
		}
	})
}

func TestChatSrvGetThreadNonblockError(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetThreadNonblock", 1)
		defer ctc.cleanup()
		users := ctc.users()

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)

		uid := users[0].User.GetUID().ToBytes()
		ui := kbtest.NewChatUI()
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
		require.NoError(t,
			ctc.world.Tcs[users[0].Username].ChatG.ConvSource.Clear(context.TODO(), conv.Id, uid))
		g := ctc.world.Tcs[users[0].Username].ChatG
		ri := ctc.as(t, users[0]).ri
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
		g.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface { return ri })
		ctc.world.Fc.Advance(time.Hour)

		updates := consumeNewThreadsStale(t, listener)
		require.Equal(t, 1, len(updates))
		require.Equal(t, chat1.StaleUpdateType_NEWACTIVITY, updates[0].UpdateType)
	})
}

var errGetInboxNonblockFailingUI = errors.New("get outta here")

type getInboxNonblockFailingUI struct {
	*kbtest.ChatUI
	failUnverified, failVerified bool
}

func (u *getInboxNonblockFailingUI) ChatInboxUnverified(ctx context.Context,
	arg chat1.ChatInboxUnverifiedArg) error {
	if u.failUnverified {
		return errGetInboxNonblockFailingUI
	}
	return u.ChatUI.ChatInboxUnverified(ctx, arg)
}

func (u *getInboxNonblockFailingUI) ChatInboxConversation(ctx context.Context,
	arg chat1.ChatInboxConversationArg) error {
	if u.failVerified {
		return errGetInboxNonblockFailingUI
	}
	return u.ChatUI.ChatInboxConversation(ctx, arg)
}

func TestChatSrvGetInboxNonblockChatUIError(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestChatSrvGetInboxNonblockChatUIError", 2)
	defer ctc.cleanup()

	timeout := 2 * time.Second
	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	tui := kbtest.NewChatUI()
	ui := &getInboxNonblockFailingUI{ChatUI: tui, failUnverified: true, failVerified: true}
	ctc.as(t, users[0]).h.mockChatUI = ui
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HIIHIHIHI",
	}))
	_, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
		chat1.GetInboxNonblockLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{conv.Id},
			},
		})
	require.Error(t, err)
	require.Equal(t, errGetInboxNonblockFailingUI, err)
	tc.Context().FetchRetrier.Force(ctx)
	select {
	case <-listener0.threadsStale:
	case <-time.After(timeout):
		require.Fail(t, "no inbox stale")
	}
	_, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
		chat1.GetInboxNonblockLocalArg{})
	require.Error(t, err)
	require.Equal(t, errGetInboxNonblockFailingUI, err)
	tc.Context().FetchRetrier.Force(ctx)
	select {
	case <-listener0.inboxStale:
	case <-time.After(timeout):
		require.Fail(t, "no inbox stale")
	}

	ui.failUnverified = false
	_, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxNonblockLocal(ctx,
		chat1.GetInboxNonblockLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{conv.Id},
			},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
	require.NoError(t, err)
	select {
	case <-ui.InboxCb:
	case <-time.After(timeout):
		require.Fail(t, "no untrusted inbox")
	}
	tc.Context().FetchRetrier.Force(ctx)
	select {
	case upds := <-listener0.threadsStale:
		require.Equal(t, 1, len(upds))
		require.Equal(t, conv.Id, upds[0].ConvID)
	case <-time.After(timeout):
		require.Fail(t, "no conv stale")
	}
}

func TestChatSrvGetInboxNonblockError(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "GetInboxNonblockLocal", 1)
		defer ctc.cleanup()
		users := ctc.users()

		listener := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)

		ctx := ctc.as(t, users[0]).startCtx
		uid := users[0].User.GetUID().ToBytes()
		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		<-ctc.as(t, users[0]).h.G().ConvLoader.Stop(ctx)
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		numMsgs := 20
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		for i := 0; i < numMsgs; i++ {
			mustPostLocalForTest(t, ctc, users[0], conv, msg)
			consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		}
		g := ctc.world.Tcs[users[0].Username].Context()
		g.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return chat1.RemoteClient{Cli: errorClient{}}
		})
		require.NoError(t,
			ctc.world.Tcs[users[0].Username].ChatG.ConvSource.Clear(context.TODO(), conv.Id, uid))
		ri := ctc.as(t, users[0]).ri

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
		case <-ui.InboxCb:
		case <-time.After(20 * time.Second):
			require.Fail(t, "no untrusted inbox")
		}

		select {
		case nbres := <-ui.InboxCb:
			require.Error(t, nbres.Err)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no inbox load event")
		}

		// Advance clock and look for stale
		g.ConvSource.SetRemoteInterface(func() chat1.RemoteInterface {
			return ri
		})
		ctc.world.Fc.Advance(time.Hour)

		updates := consumeNewThreadsStale(t, listener)
		require.Equal(t, 1, len(updates))
		require.Equal(t, chat1.StaleUpdateType_NEWACTIVITY, updates[0].UpdateType)

		t.Logf("testing untrusted inbox load failure")
		ttype := chat1.TopicType_CHAT
		require.NoError(t, storage.NewInbox(g).Clear(context.TODO(), uid))
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
		_, lconvs, _, err := storage.NewInbox(g).Read(context.TODO(), uid, rquery, p)
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
	outboxID, err := storage.NewOutboxID()
	require.NoError(t, err)
	arg := chat1.MakePreviewArg{
		Filename: "testdata/ship.jpg",
		OutboxID: outboxID,
	}
	ri := ctc.as(t, user).ri
	tc := ctc.world.Tcs[user.Username]
	tc.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc.Context(),
		manager.NewSrv(tc.Context().ExternalG()),
		types.DummyAttachmentFetcher{},
		func() chat1.RemoteInterface { return ri })
	res, err := ctc.as(t, user).chatLocalHandler().MakePreview(context.TODO(), arg)
	require.NoError(t, err)
	require.NotNil(t, res.Location)
	typ, err := res.Location.Ltyp()
	require.NoError(t, err)
	require.Equal(t, chat1.PreviewLocationTyp_URL, typ)
	resp, err := http.Get(res.Location.Url())
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)
	require.NotNil(t, res.Metadata)
	require.Equal(t, "image/jpeg", res.MimeType)
	img := res.Metadata.Image()
	require.Equal(t, 640, img.Width)
	require.Equal(t, 480, img.Height)

	// MakePreview(pdf) shouldn't generate a preview file, but should return mimetype
	outboxID, err = storage.NewOutboxID()
	require.NoError(t, err)
	arg = chat1.MakePreviewArg{
		Filename: "testdata/weather.pdf",
		OutboxID: outboxID,
	}
	res, err = ctc.as(t, user).chatLocalHandler().MakePreview(context.TODO(), arg)
	require.NoError(t, err)
	require.Nil(t, res.Location)
	require.Nil(t, res.Metadata)
	require.Equal(t, "application/pdf", res.MimeType)
}

func inMessageTypes(x chat1.MessageType, ys []chat1.MessageType) bool {
	for _, y := range ys {
		if x == y {
			return true
		}
	}
	return false
}

func consumeNewPendingMsg(t *testing.T, listener *serverChatListener) {
	select {
	case msg := <-listener.newMessageLocal:
		require.True(t, msg.Message.IsOutbox())
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get new pending message notification")
	}
}

func consumeNewMsgLocal(t *testing.T, listener *serverChatListener, typ chat1.MessageType) chat1.UIMessage {
	return consumeNewMsgWhileIgnoring(t, listener, typ, nil, chat1.ChatActivitySource_LOCAL)
}

func consumeNewMsgRemote(t *testing.T, listener *serverChatListener, typ chat1.MessageType) chat1.UIMessage {
	return consumeNewMsgWhileIgnoring(t, listener, typ, nil, chat1.ChatActivitySource_REMOTE)
}

func consumeNewMsgWhileIgnoring(t *testing.T, listener *serverChatListener, typ chat1.MessageType,
	ignoreTypes []chat1.MessageType, source chat1.ChatActivitySource) chat1.UIMessage {
	require.False(t, inMessageTypes(typ, ignoreTypes), "can't ignore the hunted")
	timeoutCh := time.After(20 * time.Second)
	var newMsgCh chan chat1.IncomingMessage
	switch source {
	case chat1.ChatActivitySource_LOCAL:
		newMsgCh = listener.newMessageLocal
	case chat1.ChatActivitySource_REMOTE:
		newMsgCh = listener.newMessageRemote
	}
	for {
		select {
		case msg := <-newMsgCh:
			rtyp := msg.Message.GetMessageType()
			ignore := inMessageTypes(rtyp, ignoreTypes)
			ignoredStr := ""
			if ignore {
				ignoredStr = " (ignored)"
			}
			t.Logf("consumed newMessage(%v): %v%v", source, msg.Message.GetMessageType(), ignoredStr)
			if !ignore {
				require.Equal(t, typ, msg.Message.GetMessageType())
				return msg.Message
			}
		case <-timeoutCh:
			require.Fail(t, fmt.Sprintf("failed to get newMessage %v notification: %v", source, typ))
			return chat1.UIMessage{}
		}
	}
}

func consumeNewThreadsStale(t *testing.T, listener *serverChatListener) []chat1.ConversationStaleUpdate {
	select {
	case updates := <-listener.threadsStale:
		return updates
	case <-time.After(20 * time.Second):
		require.Fail(t, "no threads stale message received")
	}
	return nil
}

func assertNoNewConversation(t *testing.T, listener *serverChatListener) {
	select {
	case <-listener.newConversation:
		require.Fail(t, "unexpected newConversation")
	default:
	}
}

func consumeNewConversation(t *testing.T, listener *serverChatListener, convID chat1.ConversationID) {
	select {
	case convInfo := <-listener.newConversation:
		require.Equal(t, convID, convInfo.ConvID)
		require.NotNil(t, convInfo.Conv)
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get new conversation notification")
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
		require.Fail(t, "failed to get members update notification")
	}
}

func consumeJoinConv(t *testing.T, listener *serverChatListener) {
	select {
	case <-listener.joinedConv:
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get join conv notification")
	}
}

func consumeLeaveConv(t *testing.T, listener *serverChatListener) {
	select {
	case <-listener.leftConv:
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get leave conv notification")
	}
}

func consumeSetConvRetention(t *testing.T, listener *serverChatListener) chat1.ConversationID {
	select {
	case x := <-listener.setConvRetention:
		return x
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get setConvRetention notification")
		return chat1.ConversationID{}
	}
}

func consumeSetTeamRetention(t *testing.T, listener *serverChatListener) (res keybase1.TeamID) {
	select {
	case x := <-listener.setTeamRetention:
		return x
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get setTeamRetention notification")
		return res
	}
}

func consumeSetConvSettings(t *testing.T, listener *serverChatListener) chat1.ConversationID {
	select {
	case x := <-listener.setConvSettings:
		return x
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get setConvSettings notification")
		return chat1.ConversationID{}
	}
}

func consumeSubteamRename(t *testing.T, listener *serverChatListener) []chat1.ConversationID {
	select {
	case x := <-listener.subteamRename:
		return x
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get subteamRename notification")
		return nil
	}
}

func consumeExpunge(t *testing.T, listener *serverChatListener) chat1.ExpungeInfo {
	select {
	case x := <-listener.expunge:
		return x
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get expunge notification")
		return chat1.ExpungeInfo{}
	}
}

func consumeEphemeralPurge(t *testing.T, listener *serverChatListener) chat1.EphemeralPurgeNotifInfo {
	select {
	case x := <-listener.ephemeralPurge:
		return x
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get ephemeralPurge notification")
		return chat1.EphemeralPurgeNotifInfo{}
	}
}

func consumeReactionUpdate(t *testing.T, listener *serverChatListener) chat1.ReactionUpdateNotif {
	select {
	case x := <-listener.reactionUpdate:
		return x
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get reactionUpdate notification")
		return chat1.ReactionUpdateNotif{}
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
		ctx2 := ctc.as(t, users[2]).startCtx

		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true

		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
		ctc.world.Tcs[users[1].Username].ChatG.Syncer.(*Syncer).isConnected = true

		listener2 := newServerChatListener()
		ctc.as(t, users[2]).h.G().NotifyRouter.AddListener(listener2)
		ctc.world.Tcs[users[2].Username].ChatG.Syncer.(*Syncer).isConnected = true

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())
		t.Logf("first conv: %s", conv.Id)
		consumeNewConversation(t, listener0, conv.Id)
		consumeNewConversation(t, listener1, conv.Id)
		consumeNewConversation(t, listener2, conv.Id)

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
		consumeNewConversation(t, listener0, ncres.Conv.GetConvID())
		assertNoNewConversation(t, listener1)
		assertNoNewConversation(t, listener2)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_SYSTEM)
		_, err = postLocalForTest(t, ctc, users[1], ncres.Conv.Info, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: fmt.Sprintf("JOINME"),
		}))
		require.NoError(t, err)
		consumeAllMsgJoins := func(listener *serverChatListener) {
			msgMap := make(map[chat1.MessageType]bool)
			rounds := 2
			for i := 0; i < rounds; i++ {
				select {
				case msg := <-listener.newMessageRemote:
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
			require.Equal(t, 1, len(act.Members))
			require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, act.Members[0].Status)
			require.Equal(t, users[1].Username, act.Members[0].Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		t.Logf("send headline on first convo")
		headline := "The headline is foobar!"
		_, err = postLocalForTest(t, ctc, users[1], ncres.Conv.Info, chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: headline}))
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_HEADLINE)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_HEADLINE)

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
		consumeNewConversation(t, listener0, ncres.Conv.GetConvID())
		assertNoNewConversation(t, listener1)
		assertNoNewConversation(t, listener2)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		getTLFRes, err := ctc.as(t, users[1]).chatLocalHandler().GetTLFConversationsLocal(ctx1,
			chat1.GetTLFConversationsLocalArg{
				TlfName:     conv.TlfName,
				TopicType:   chat1.TopicType_CHAT,
				MembersType: chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		require.Equal(t, 3, len(getTLFRes.Convs))
		require.Equal(t, globals.DefaultTeamTopic, getTLFRes.Convs[0].Channel)
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
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
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
			require.Equal(t, 1, len(act.Members))
			require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, act.Members[0].Status)
			require.Equal(t, users[1].Username, act.Members[0].Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		t.Logf("@mention in user2")
		_, err = postLocalForTest(t, ctc, users[1], ncres.Conv.Info, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: fmt.Sprintf("FAIL: @%s", users[2].Username),
		}))
		require.NoError(t, err)
		consumeJoinConv(t, listener2)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_TEXT)

		t.Logf("user1 leaves: %s", ncres.Conv.GetConvID())
		_, err = ctc.as(t, users[1]).chatLocalHandler().LeaveConversationLocal(ctx1,
			ncres.Conv.GetConvID())
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_LEAVE)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_LEAVE)
		select {
		case convID := <-listener1.leftConv:
			require.Equal(t, convID, getTLFRes.Convs[1].GetConvID())
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get joined notification")
		}
		select {
		case act := <-listener0.membersUpdate:
			require.Equal(t, act.ConvID, getTLFRes.Convs[1].GetConvID())
			require.Equal(t, 1, len(act.Members))
			require.Equal(t, chat1.ConversationMemberStatus_REMOVED, act.Members[0].Status)
			require.Equal(t, users[1].Username, act.Members[0].Member)
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
			require.Equal(t, 1, len(act.Members))
			require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, act.Members[0].Status)
			require.Equal(t, users[2].Username, act.Members[0].Member)
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
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_JOIN)

		t.Logf("u2 gets messages and looks for u1's LEAVE message")
		tvres, err = ctc.as(t, users[2]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: ncres.Conv.GetConvID(),
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_LEAVE},
			},
		})
		require.NoError(t, err)
		require.Len(t, tvres.Thread.Messages, 1, "expected number of LEAVE messages")

		t.Logf("u2 leaves and explicitly previews channel")
		_, err = ctc.as(t, users[2]).chatLocalHandler().LeaveConversationLocal(ctx1,
			ncres.Conv.GetConvID())
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_LEAVE)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_LEAVE)
		consumeLeaveConv(t, listener2)
		_, err = ctc.as(t, users[2]).chatLocalHandler().PreviewConversationByIDLocal(ctx2, ncres.Conv.Info.Id)
		require.NoError(t, err)
		consumeJoinConv(t, listener2)
		iboxRes, err := ctc.as(t, users[2]).chatLocalHandler().GetInboxAndUnboxLocal(ctx2,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 2, len(iboxRes.Conversations))
		for _, conv := range iboxRes.Conversations {
			if conv.GetConvID().Eq(ncres.Conv.Info.Id) {
				require.Equal(t, chat1.ConversationMemberStatus_PREVIEW, conv.Info.MemberStatus)
			} else {
				require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, conv.Info.MemberStatus)
			}
		}
	})
}

func TestChatSrvTLFConversationsLocal(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "TestChatSrvTLFConversationsLocal", 2)
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
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true

		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
		ctc.world.Tcs[users[1].Username].ChatG.Syncer.(*Syncer).isConnected = true

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())
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

		_, err = postLocalForTest(t, ctc, users[1], ncres.Conv.Info, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: fmt.Sprintf("JOINME"),
		}))
		require.NoError(t, err)

		getTLFRes, err := ctc.as(t, users[1]).chatLocalHandler().GetTLFConversationsLocal(ctx1,
			chat1.GetTLFConversationsLocalArg{
				TlfName:     conv.TlfName,
				TopicType:   chat1.TopicType_CHAT,
				MembersType: chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		require.Equal(t, 2, len(getTLFRes.Convs))
		require.Equal(t, globals.DefaultTeamTopic, getTLFRes.Convs[0].Channel)
		require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, getTLFRes.Convs[1].MemberStatus)
		require.Equal(t, 2, len(getTLFRes.Convs[1].Participants))

		_, err = ctc.as(t, users[1]).chatLocalHandler().LeaveConversationLocal(ctx1,
			ncres.Conv.GetConvID())
		require.NoError(t, err)
		ignoreTypes := []chat1.MessageType{chat1.MessageType_SYSTEM, chat1.MessageType_JOIN, chat1.MessageType_TEXT}
		consumeNewMsgWhileIgnoring(t, listener0, chat1.MessageType_LEAVE, ignoreTypes, chat1.ChatActivitySource_REMOTE)

		// make sure both users have processed the leave in their inbox
		for i, user := range users {
			getTLFRes, err = ctc.as(t, user).chatLocalHandler().GetTLFConversationsLocal(ctc.as(t, user).startCtx,
				chat1.GetTLFConversationsLocalArg{
					TlfName:     conv.TlfName,
					TopicType:   chat1.TopicType_CHAT,
					MembersType: chat1.ConversationMembersType_TEAM,
				})
			require.NoError(t, err)
			require.Equal(t, 2, len(getTLFRes.Convs))
			require.Equal(t, globals.DefaultTeamTopic, getTLFRes.Convs[0].Channel)
			if i == 1 {
				require.Equal(t, chat1.ConversationMemberStatus_LEFT, getTLFRes.Convs[1].MemberStatus)
			} else {
				require.Equal(t, chat1.ConversationMemberStatus_ACTIVE, getTLFRes.Convs[1].MemberStatus)
			}
			require.Equal(t, 1, len(getTLFRes.Convs[1].Participants))
			require.Equal(t, users[0].Username, getTLFRes.Convs[1].Participants[0].Assertion)
		}

		// delete the channel make sure it's gone from both inboxes
		_, err = ctc.as(t, users[0]).chatLocalHandler().DeleteConversationLocal(ctx,
			chat1.DeleteConversationLocalArg{
				ConvID:    ncres.Conv.GetConvID(),
				Confirmed: true,
			})
		require.NoError(t, err)
		consumeLeaveConv(t, listener0)
		consumeTeamType(t, listener0)
		consumeLeaveConv(t, listener1)
		consumeTeamType(t, listener1)

		for _, user := range users {
			getTLFRes, err = ctc.as(t, user).chatLocalHandler().GetTLFConversationsLocal(ctc.as(t, user).startCtx,
				chat1.GetTLFConversationsLocalArg{
					TlfName:     conv.TlfName,
					TopicType:   chat1.TopicType_CHAT,
					MembersType: chat1.ConversationMembersType_TEAM,
				})
			require.NoError(t, err)
			require.Equal(t, 1, len(getTLFRes.Convs))
			require.Equal(t, globals.DefaultTeamTopic, getTLFRes.Convs[0].Channel)
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
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)

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
		select {
		case info := <-listener0.newMessageRemote:
			require.Equal(t, chat1.MessageType_TEXT, info.Message.GetMessageType())
			require.True(t, info.DisplayDesktopNotification)
			require.NotEqual(t, "", info.DesktopNotificationSnippet)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message event")
		}
		setting := chat1.AppNotificationSettingLocal{
			DeviceType: keybase1.DeviceType_DESKTOP,
			Kind:       chat1.NotificationKind_ATMENTION,
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
		mustPostLocalForTest(t, ctc, users[1], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: fmt.Sprintf("@%s", users[0].Username)}))
		select {
		case info := <-listener0.newMessageRemote:
			require.Equal(t, chat1.MessageType_TEXT, info.Message.GetMessageType())
			require.True(t, info.DisplayDesktopNotification)
			require.NotEqual(t, "", info.DesktopNotificationSnippet)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message event")
		}

		setting = chat1.AppNotificationSettingLocal{
			DeviceType: keybase1.DeviceType_DESKTOP,
			Kind:       chat1.NotificationKind_GENERIC,
			Enabled:    false,
		}
		setting2 := chat1.AppNotificationSettingLocal{
			DeviceType: keybase1.DeviceType_DESKTOP,
			Kind:       chat1.NotificationKind_ATMENTION,
			Enabled:    true,
		}
		_, err = ctc.as(t, users[0]).chatLocalHandler().SetAppNotificationSettingsLocal(ctx,
			chat1.SetAppNotificationSettingsLocalArg{
				ConvID:   conv.Id,
				Settings: []chat1.AppNotificationSettingLocal{setting, setting2},
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
		case info := <-listener0.newMessageRemote:
			require.False(t, info.DisplayDesktopNotification)
			require.Equal(t, "", info.DesktopNotificationSnippet)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no new message event")
		}

		validateDisplayAtMention := func(name string) {
			text := fmt.Sprintf("@%s", name)
			mustPostLocalForTest(t, ctc, users[1], conv,
				chat1.NewMessageBodyWithText(chat1.MessageText{Body: text}))
			select {
			case info := <-listener0.newMessageRemote:
				require.True(t, info.DisplayDesktopNotification)
				require.NotEqual(t, "", info.DesktopNotificationSnippet)
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

func randSweepChannel() uint64 {
	for {
		buf := make([]byte, 8)
		_, err := rand.Read(buf)
		if err != nil {
			panic(err)
		}
		x := binary.LittleEndian.Uint64(buf)
		// sql driver doesn't support all the bits
		// https://golang.org/src/database/sql/driver/types.go#L265
		if x < 1<<63 {
			return x
		}
	}
}

func TestChatSrvRetentionSweepConv(t *testing.T) {
	sweepChannel := randSweepChannel()
	t.Logf("sweepChannel: %v", sweepChannel)
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			t.Logf("skipping kbfs stage")
			return
		}
		runWithRetentionPolicyTypes(t, func(policy chat1.RetentionPolicy, ephemeralLifetime *gregor1.DurationSec) {

			ctc := makeChatTestContext(t, "TestChatSrvRetention", 2)
			defer ctc.cleanup()
			users := ctc.users()
			ctx := ctc.as(t, users[0]).startCtx

			listener := newServerChatListener()
			ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener)

			conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
				mt, ctc.as(t, users[1]).user())

			mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
			consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)

			mustPostLocalForTest(t, ctc, users[1], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
			consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)

			mustSetConvRetention(t, ctc, users[0], conv.Id, policy, sweepChannel)
			require.True(t, consumeSetConvRetention(t, listener).Eq(conv.Id))

			// This will take at least 1 second. For the deletable message to get old enough.
			expungeInfo := sweepPollForDeletion(t, ctc, users[1], listener, conv.Id, 4)
			require.True(t, expungeInfo.ConvID.Eq(conv.Id))
			require.Equal(t, chat1.Expunge{Upto: 4}, expungeInfo.Expunge, "expunge upto")

			tvres, err := ctc.as(t, users[1]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{ConversationID: conv.Id})
			require.NoError(t, err)
			require.Len(t, tvres.Thread.Messages, 1, "the TEXTs should be deleted")

			// If we are using an ephemeral policy make sure messages with a lifetime exceeding
			// the policy age are blocked.
			if ephemeralLifetime != nil {
				badLifetime := *ephemeralLifetime + 1
				_, err := postLocalEphemeralForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}), &badLifetime)
				require.Error(t, err)
				require.IsType(t, libkb.ChatEphemeralRetentionPolicyViolatedError{}, err)

				mustPostLocalEphemeralForTest(t, ctc, users[0], conv,
					chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}), ephemeralLifetime)
			}
		})
	})
}

func tlfIDToTeamIDForce(t *testing.T, tlfID chat1.TLFID) keybase1.TeamID {
	res, err := keybase1.TeamIDFromString(tlfID.String())
	require.NoError(t, err)
	return res
}

func TestChatSrvRetentionSweepTeam(t *testing.T) {
	sweepChannel := randSweepChannel()
	t.Logf("sweepChannel: %v", sweepChannel)
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			t.Logf("skipping %v stage", mt)
			return
		}
		runWithRetentionPolicyTypes(t, func(policy chat1.RetentionPolicy, ephemeralLifetime *gregor1.DurationSec) {
			ctc := makeChatTestContext(t, "TestChatSrvTeamRetention", 2)
			defer ctc.cleanup()
			users := ctc.users()
			ctx := ctc.as(t, users[0]).startCtx
			_ = ctc.as(t, users[1]).startCtx
			for i, u := range users {
				t.Logf("user[%v] %v %v", i, u.Username, u.User.GetUID())
				ctc.world.Tcs[u.Username].ChatG.Syncer.(*Syncer).isConnected = true
			}

			listener := newServerChatListener()
			ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener)

			// 3 convs
			// convA: inherit team expire policy (default)
			// convB: expire policy
			// convC: retain policy
			var convs []chat1.ConversationInfoLocal
			for i := 0; i < 3; i++ {
				t.Logf("creating conv %v", i)
				var topicName *string
				if i > 0 {
					s := fmt.Sprintf("regarding-%v-gons", i)
					topicName = &s
				}
				conv := mustCreateChannelForTest(t, ctc, users[0], chat1.TopicType_CHAT,
					topicName, mt, ctc.as(t, users[1]).user())
				convs = append(convs, conv)
				if i > 0 {
					mustJoinConversationByID(t, ctc, users[1], conv.Id)
					consumeJoinConv(t, listener)
				}
			}
			convA := convs[0]
			convB := convs[1]
			convC := convs[2]
			teamID := tlfIDToTeamIDForce(t, convA.Triple.Tlfid)

			// policy can be EXPIRE or EPHEMERAL here.
			teamPolicy := policy
			convExpirePolicy := policy
			convRetainPolicy := chat1.NewRetentionPolicyWithRetain(chat1.RpRetain{})

			latestMsgMap := make(map[string] /*convID*/ chat1.MessageID)
			latestMsg := func(convID chat1.ConversationID) chat1.MessageID {
				return latestMsgMap[convID.String()]
			}
			for i, conv := range convs {
				t.Logf("conv (%v/%v) %v in team %v", i+1, len(convs), conv.Id, tlfIDToTeamIDForce(t, conv.Triple.Tlfid))
				msgID := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
				latestMsgMap[conv.Id.String()] = msgID

				ignoreTypes := []chat1.MessageType{chat1.MessageType_SYSTEM, chat1.MessageType_JOIN}
				consumeNewMsgWhileIgnoring(t, listener, chat1.MessageType_TEXT, ignoreTypes, chat1.ChatActivitySource_REMOTE)
			}

			mustSetConvRetention(t, ctc, users[0], convB.Id, convExpirePolicy, sweepChannel)
			require.True(t, consumeSetConvRetention(t, listener).Eq(convB.Id))
			mustSetTeamRetention(t, ctc, users[0], teamID, teamPolicy, sweepChannel)
			require.True(t, consumeSetTeamRetention(t, listener).Eq(teamID))
			mustSetConvRetention(t, ctc, users[0], convC.Id, convRetainPolicy, sweepChannel)
			require.True(t, consumeSetConvRetention(t, listener).Eq(convC.Id))

			// This will take at least 1 second.
			sweepPollForDeletion(t, ctc, users[0], listener, convB.Id, latestMsg(convB.Id)+1)
			sweepPollForDeletion(t, ctc, users[0], listener, convA.Id, latestMsg(convA.Id)+1)
			sweepNoDeletion(t, ctc, users[0], convC.Id)

			checkThread := func(convID chat1.ConversationID, expectDeleted bool) {
				tvres, err := ctc.as(t, users[1]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{ConversationID: convID})
				require.NoError(t, err)
				var nText int
				for _, msg := range tvres.Thread.Messages {
					require.True(t, msg.IsValidFull())
					require.Equal(t, chat1.MessageID(0), msg.Valid().ServerHeader.SupersededBy)
					if msg.GetMessageType() == chat1.MessageType_TEXT {
						nText++
					}
				}
				if expectDeleted {
					require.Equal(t, 0, nText, "conv contents should be deleted: %v", convID.DbShortFormString())
				} else {
					require.Equal(t, 1, nText)
				}
			}

			checkThread(convA.Id, true)
			checkThread(convB.Id, true)
			checkThread(convC.Id, false)
			if ephemeralLifetime != nil {
				for _, conv := range []chat1.ConversationInfoLocal{convA, convB} {
					// If we are using an ephemeral policy make sure messages with a lifetime exceeding
					// the policy age are blocked.
					badLifetime := *ephemeralLifetime + 1
					_, err := postLocalEphemeralForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}), &badLifetime)
					require.Error(t, err)
					require.IsType(t, libkb.ChatEphemeralRetentionPolicyViolatedError{}, err)

					mustPostLocalEphemeralForTest(t, ctc, users[0], conv,
						chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}), ephemeralLifetime)
				}
			}
		})
	})
}

func verifyChangeRetentionSystemMessage(t *testing.T, msg chat1.UIMessage, expectedMsg chat1.MessageSystemChangeRetention) {
	require.True(t, msg.IsValid())
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	require.NoError(t, err)
	require.Equal(t, chat1.MessageType_SYSTEM, typ)
	sysMsg := body.System()
	sysTyp, err := sysMsg.SystemType()
	require.NoError(t, err)
	require.Equal(t, chat1.MessageSystemType_CHANGERETENTION, sysTyp)
	retMsg := sysMsg.Changeretention()
	require.Equal(t, expectedMsg, retMsg)
}

func TestChatSrvEphemeralConvRetention(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			t.Logf("skipping kbfs stage")
			return
		}

		ctc := makeChatTestContext(t, "TestChatSrvRetention", 2)
		defer ctc.cleanup()
		users := ctc.users()
		ctx := ctc.as(t, users[0]).startCtx

		listener := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		msgID := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)

		// set an ephemeral policy
		age := gregor1.ToDurationSec(time.Hour * 24)
		policy := chat1.NewRetentionPolicyWithEphemeral(chat1.RpEphemeral{Age: age})
		mustSetConvRetentionLocal(t, ctc, users[0], conv.Id, policy)
		require.True(t, consumeSetConvRetention(t, listener).Eq(conv.Id))
		msg := consumeNewMsgRemote(t, listener, chat1.MessageType_SYSTEM)
		verifyChangeRetentionSystemMessage(t, msg, chat1.MessageSystemChangeRetention{
			IsTeam:      false,
			IsInherit:   false,
			Policy:      policy,
			MembersType: mt,
			User:        users[0].Username,
		})

		// make sure we can supersede existing messages
		mustReactToMsg(ctx, t, ctc, users[0], conv, msgID, ":+1:")

		ephemeralMsgID := mustPostLocalEphemeralForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}), &age)
		mustReactToMsg(ctx, t, ctc, users[0], conv, ephemeralMsgID, ":+1:")
	})
}

func TestChatSrvEphemeralTeamRetention(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			t.Logf("skipping %v stage", mt)
			return
		}
		ctc := makeChatTestContext(t, "TestChatSrvTeamRetention", 2)
		defer ctc.cleanup()
		users := ctc.users()
		ctx := ctc.as(t, users[0]).startCtx
		_ = ctc.as(t, users[1]).startCtx
		for i, u := range users {
			t.Logf("user[%v] %v %v", i, u.Username, u.User.GetUID())
			ctc.world.Tcs[u.Username].ChatG.Syncer.(*Syncer).isConnected = true
		}
		listener := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener)

		// 3 convs
		// convA: inherit team expire policy (default)
		// convB: expire policy
		// convC: retain policy
		var convs []chat1.ConversationInfoLocal
		for i := 0; i < 3; i++ {
			t.Logf("creating conv %v", i)
			var topicName *string
			if i > 0 {
				s := fmt.Sprintf("regarding-%v-gons", i)
				topicName = &s
			}
			conv := mustCreateChannelForTest(t, ctc, users[0], chat1.TopicType_CHAT,
				topicName, mt, ctc.as(t, users[1]).user())
			convs = append(convs, conv)
			if i > 0 {
				mustJoinConversationByID(t, ctc, users[1], conv.Id)
				consumeJoinConv(t, listener)
			}
		}
		convA := convs[0]
		convB := convs[1]
		convC := convs[2]
		teamID := tlfIDToTeamIDForce(t, convA.Triple.Tlfid)

		age := gregor1.ToDurationSec(time.Hour * 24)
		policy := chat1.NewRetentionPolicyWithEphemeral(chat1.RpEphemeral{Age: age})
		teamPolicy := policy
		convExpirePolicy := policy
		convRetainPolicy := chat1.NewRetentionPolicyWithRetain(chat1.RpRetain{})

		latestMsgMap := make(map[string] /*convID*/ chat1.MessageID)
		latestMsg := func(convID chat1.ConversationID) chat1.MessageID {
			return latestMsgMap[convID.String()]
		}
		for i, conv := range convs {
			t.Logf("conv (%v/%v) %v in team %v", i+1, len(convs), conv.Id, tlfIDToTeamIDForce(t, conv.Triple.Tlfid))
			msgID := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
			latestMsgMap[conv.Id.String()] = msgID
		}

		// drain remote messages
		drain := func() {
			for {
				select {
				case msg := <-listener.newMessageRemote:
					t.Logf("drained %v", msg.Message.GetMessageType())
				case <-time.After(100 * time.Millisecond):
					return
				}
			}
		}
		drain()

		mustSetConvRetentionLocal(t, ctc, users[0], convB.Id, convExpirePolicy)
		require.True(t, consumeSetConvRetention(t, listener).Eq(convB.Id))
		msg := consumeNewMsgRemote(t, listener, chat1.MessageType_SYSTEM)
		verifyChangeRetentionSystemMessage(t, msg, chat1.MessageSystemChangeRetention{
			IsTeam:      false,
			IsInherit:   false,
			Policy:      convExpirePolicy,
			MembersType: mt,
			User:        users[0].Username,
		})

		mustSetTeamRetentionLocal(t, ctc, users[0], teamID, teamPolicy)
		require.True(t, consumeSetTeamRetention(t, listener).Eq(teamID))
		msg = consumeNewMsgRemote(t, listener, chat1.MessageType_SYSTEM)
		verifyChangeRetentionSystemMessage(t, msg, chat1.MessageSystemChangeRetention{
			IsTeam:      true,
			IsInherit:   false,
			Policy:      teamPolicy,
			MembersType: mt,
			User:        users[0].Username,
		})

		mustSetConvRetentionLocal(t, ctc, users[0], convC.Id, convRetainPolicy)
		require.True(t, consumeSetConvRetention(t, listener).Eq(convC.Id))
		msg = consumeNewMsgRemote(t, listener, chat1.MessageType_SYSTEM)
		verifyChangeRetentionSystemMessage(t, msg, chat1.MessageSystemChangeRetention{
			IsTeam:      false,
			IsInherit:   false,
			Policy:      convRetainPolicy,
			MembersType: mt,
			User:        users[0].Username,
		})

		for _, conv := range []chat1.ConversationInfoLocal{convA, convB} {
			mustReactToMsg(ctx, t, ctc, users[0], conv, latestMsg(conv.Id), ":+1:")
			consumeNewMsgRemote(t, listener, chat1.MessageType_REACTION)
			ephemeralMsgID := mustPostLocalEphemeralForTest(t, ctc, users[0], conv,
				chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}), &age)
			consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
			mustReactToMsg(ctx, t, ctc, users[0], conv, ephemeralMsgID, ":+1:")
			consumeNewMsgRemote(t, listener, chat1.MessageType_REACTION)
		}

		// revert convC to inherit
		convInheritPolicy := chat1.NewRetentionPolicyWithInherit(chat1.RpInherit{})
		mustSetConvRetentionLocal(t, ctc, users[0], convC.Id, convInheritPolicy)
		require.True(t, consumeSetConvRetention(t, listener).Eq(convC.Id))
		msg = consumeNewMsgRemote(t, listener, chat1.MessageType_SYSTEM)
		verifyChangeRetentionSystemMessage(t, msg, chat1.MessageSystemChangeRetention{
			IsTeam:      false,
			IsInherit:   true,
			MembersType: mt,
			Policy:      teamPolicy,
			User:        users[0].Username,
		})
	})
}
func TestChatSrvSetConvMinWriterRole(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			t.Logf("skipping %v stage", mt)
			return
		}

		ctc := makeChatTestContext(t, "TestChatSrvSetConvMinWriterRole", 2)
		defer ctc.cleanup()
		users := ctc.users()
		ctx := ctc.as(t, users[0]).startCtx

		tc1 := ctc.as(t, users[0])
		tc2 := ctc.as(t, users[1])

		listener1 := newServerChatListener()
		tc1.h.G().NotifyRouter.AddListener(listener1)
		listener2 := newServerChatListener()
		tc2.h.G().NotifyRouter.AddListener(listener2)

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, tc2.user())
		convID := created.Id
		consumeNewConversation(t, listener1, convID)
		consumeNewConversation(t, listener2, convID)

		verifyMinWriterRoleInfoOnConv := func(user *kbtest.FakeUser, role *keybase1.TeamRole, cannotWrite bool) {
			tc := ctc.as(t, user)

			var expectedInfo *chat1.ConversationMinWriterRoleInfo
			var expectedInfoLocal *chat1.ConversationMinWriterRoleInfoLocal
			if role != nil {
				expectedInfo = &chat1.ConversationMinWriterRoleInfo{
					Role: *role,
					Uid:  gregor1.UID(users[0].GetUID().ToBytes()),
				}
				expectedInfoLocal = &chat1.ConversationMinWriterRoleInfoLocal{
					Role:        *role,
					ChangedBy:   users[0].Username,
					CannotWrite: cannotWrite,
				}
			}

			conv, err := utils.GetUnverifiedConv(ctx, ctc.world.Tcs[user.Username].Context(),
				gregor1.UID(user.GetUID().ToBytes()), convID, types.InboxSourceDataSourceRemoteOnly)
			require.NoError(t, err)
			if role == nil {
				require.Nil(t, conv.Conv.ConvSettings)
			} else {
				require.NotNil(t, conv.Conv.ConvSettings)
				require.Equal(t, expectedInfo, conv.Conv.ConvSettings.MinWriterRoleInfo)
			}

			gilres, err := tc.chatLocalHandler().GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
				Query: &chat1.GetInboxLocalQuery{
					ConvIDs: []chat1.ConversationID{convID},
				},
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
			require.NoError(t, err)
			require.Len(t, gilres.Conversations, 1)
			convSettings := gilres.Conversations[0].ConvSettings
			if role == nil {
				require.Nil(t, convSettings)
			} else {
				require.NotNil(t, convSettings)
				require.Equal(t, expectedInfoLocal, convSettings.MinWriterRoleInfo)
			}
		}

		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_TEXT)
		verifyMinWriterRoleInfoOnConv(users[0], nil, false)
		verifyMinWriterRoleInfoOnConv(users[1], nil, false)

		role := keybase1.TeamRole_ADMIN
		err := tc1.chatLocalHandler().SetConvMinWriterRoleLocal(tc1.startCtx, chat1.SetConvMinWriterRoleLocalArg{
			ConvID: convID,
			Role:   role,
		})
		require.NoError(t, err)
		require.True(t, consumeSetConvSettings(t, listener1).Eq(created.Id))
		require.True(t, consumeSetConvSettings(t, listener2).Eq(created.Id))

		// u2 can't set this since they are not an admin
		err = tc2.chatLocalHandler().SetConvMinWriterRoleLocal(tc2.startCtx, chat1.SetConvMinWriterRoleLocalArg{
			ConvID: convID,
			Role:   keybase1.TeamRole_NONE,
		})
		require.Error(t, err)
		// Only u1's role update went through
		verifyMinWriterRoleInfoOnConv(users[0], &role, false)
		verifyMinWriterRoleInfoOnConv(users[1], &role, true)

		// u2 can't write anymore, only u1 can.
		_, err = postLocalForTest(t, ctc, users[1], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		require.Error(t, err)

		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_TEXT)

		// Both users can fully ready without issue
		for _, user := range users {
			tvres, err := ctc.as(t, user).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{ConversationID: created.Id,
				Query: &chat1.GetThreadQuery{
					MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
				},
			})
			require.NoError(t, err)
			require.Len(t, tvres.Thread.Messages, 2, "messages are accessible")
		}

		role = keybase1.TeamRole_NONE
		err = tc1.chatLocalHandler().SetConvMinWriterRoleLocal(tc1.startCtx, chat1.SetConvMinWriterRoleLocalArg{
			ConvID: convID,
			Role:   role,
		})
		require.NoError(t, err)
		require.True(t, consumeSetConvSettings(t, listener1).Eq(created.Id))
		require.True(t, consumeSetConvSettings(t, listener2).Eq(created.Id))
		verifyMinWriterRoleInfoOnConv(users[0], nil, false)
		verifyMinWriterRoleInfoOnConv(users[1], nil, false)

		// Both users can write again
		mustPostLocalForTest(t, ctc, users[0], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_TEXT)
		mustPostLocalForTest(t, ctc, users[1], created, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hello!"}))
		consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_TEXT)

		for _, user := range users {
			tvres, err := ctc.as(t, user).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
				ConversationID: created.Id,
				Query: &chat1.GetThreadQuery{
					MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
				},
			})
			require.NoError(t, err)
			require.Len(t, tvres.Thread.Messages, 4, "messages are accessible")
		}

		// create a new channel with a MinWriterRole set to ADMIN and ensure
		// new users can join/leave
		topicName := "zjoinonsend"
		channel, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       created.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		channelInfo := channel.Conv.Info
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
		consumeNewConversation(t, listener1, channelInfo.Id)
		assertNoNewConversation(t, listener2)
		consumeTeamType(t, listener1)
		consumeTeamType(t, listener2)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_SYSTEM)

		channelID := channelInfo.Id
		role = keybase1.TeamRole_ADMIN
		err = tc1.chatLocalHandler().SetConvMinWriterRoleLocal(tc1.startCtx, chat1.SetConvMinWriterRoleLocalArg{
			ConvID: channelID,
			Role:   role,
		})
		require.NoError(t, err)

		_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationLocal(tc2.startCtx, chat1.JoinConversationLocalArg{
			TlfName:    channel.Conv.Info.TlfName,
			TopicType:  chat1.TopicType_CHAT,
			Visibility: keybase1.TLFVisibility_PRIVATE,
			TopicName:  topicName,
		})
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_JOIN)

		_, err = ctc.as(t, users[1]).chatLocalHandler().LeaveConversationLocal(tc2.startCtx, channelID)
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_LEAVE)
	})
}

func TestChatSrvTopicNameState(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctc := makeChatTestContext(t, "TestChatSrvTopicNameState", 1)
		defer ctc.cleanup()
		users := ctc.users()

		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true
		tc := ctc.world.Tcs[users[0].Username]
		ri := ctc.as(t, users[0]).ri

		firstConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		consumeNewConversation(t, listener0, firstConv.Id)

		topicName := "MIKE"
		ctx := ctc.as(t, users[0]).startCtx
		ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       firstConv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		convInfo := ncres.Conv.Info
		consumeNewConversation(t, listener0, convInfo.Id)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeTeamType(t, listener0)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)

		// Delete the conv, make sure we can still create a new channel after
		_, err = ctc.as(t, users[0]).chatLocalHandler().DeleteConversationLocal(ctx,
			chat1.DeleteConversationLocalArg{
				ConvID: convInfo.Id,
			})
		require.NoError(t, err)
		consumeLeaveConv(t, listener0)
		consumeTeamType(t, listener0)
		t.Logf("Deleted conv")

		topicName = "josh"
		ncres, err = ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       firstConv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		conv := ncres.Conv
		convInfo = conv.Info
		consumeNewConversation(t, listener0, convInfo.Id)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)

		// Creating a conversation with same topic name just returns the matching one
		topicName = "random"
		ncarg := chat1.NewConversationLocalArg{
			TlfName:       convInfo.TlfName,
			TopicName:     &topicName,
			TopicType:     chat1.TopicType_CHAT,
			TlfVisibility: keybase1.TLFVisibility_PRIVATE,
			MembersType:   chat1.ConversationMembersType_TEAM,
		}
		ncres, err = ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx, ncarg)
		require.NoError(t, err)
		randomConvID := ncres.Conv.GetConvID()
		consumeNewConversation(t, listener0, randomConvID)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)

		ncres, err = ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx, ncarg)
		require.NoError(t, err)
		require.Equal(t, randomConvID, ncres.Conv.GetConvID())
		assertNoNewConversation(t, listener0)

		// Try to change topic name to one that exists
		plarg := chat1.PostLocalArg{
			ConversationID: convInfo.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        convInfo.Triple,
					MessageType: chat1.MessageType_METADATA,
					TlfName:     convInfo.TlfName,
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
		consumeNewMsgRemote(t, listener0, chat1.MessageType_METADATA)

		// Create race with topic name state, and make sure we do the right thing
		plarg.Msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
			ConversationTitle: "ANOTHERONE",
		})
		sender := NewBlockingSender(tc.Context(), NewBoxer(tc.Context()),
			func() chat1.RemoteInterface { return ri })
		prepareRes, err := sender.Prepare(ctx, plarg.Msg, mt, &conv, nil)
		require.NoError(t, err)
		msg1 := prepareRes.Boxed
		ts1 := prepareRes.TopicNameState
		prepareRes, err = sender.Prepare(ctx, plarg.Msg, mt, &conv, nil)
		require.NoError(t, err)
		msg2 := prepareRes.Boxed
		ts2 := prepareRes.TopicNameState
		require.True(t, ts1.Eq(*ts2))

		_, err = ri.PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: convInfo.Id,
			MessageBoxed:   msg1,
			TopicNameState: ts1,
		})
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_METADATA)

		_, err = ri.PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: convInfo.Id,
			MessageBoxed:   msg2,
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
		convInfo := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		conv, err := utils.GetVerifiedConv(ctx, tc.Context(), uid, convInfo.Id,
			types.InboxSourceDataSourceAll)
		require.NoError(t, err)
		plarg := chat1.PostLocalArg{
			ConversationID: convInfo.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        convInfo.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     convInfo.TlfName,
					Sender:      uid,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "PUSH",
				}),
			},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		ri := ctc.as(t, users[0]).ri
		sender := NewBlockingSender(tc.Context(), NewBoxer(tc.Context()),
			func() chat1.RemoteInterface { return ri })
		prepareRes, err := sender.Prepare(ctx, plarg.Msg, mt, &conv, nil)
		require.NoError(t, err)
		msg := prepareRes.Boxed
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
				ConvID:      convInfo.Id.String(),
				MembersType: mt,
				Payload:     encMsg,
			})
		require.NoError(t, err)
		require.Equal(t, fmt.Sprintf("%s (%s#%s): PUSH", users[0].Username, convInfo.TlfName, "general"),
			unboxRes)
	})
}

func TestChatSrvImplicitConversation(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		if mt != chat1.ConversationMembersType_IMPTEAMNATIVE {
			return
		}
		ctc := makeChatTestContext(t, "ImplicitConversation", 2)
		defer ctc.cleanup()

		users := ctc.users()
		displayName := users[0].Username + "," + users[1].Username
		tc := ctc.world.Tcs[users[0].Username]
		tc1 := ctc.world.Tcs[users[1].Username]

		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)

		consumeIdentify := func(ctx context.Context, listener *serverChatListener) {
			// check identify updates
			var update keybase1.CanonicalTLFNameAndIDWithBreaks
			select {
			case update = <-listener.identifyUpdate:
				t.Logf("identify update: %+v", update)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no identify")
			}
			require.Empty(t, update.Breaks.Breaks)
			globals.CtxIdentifyNotifier(ctx).Reset()
			globals.CtxKeyFinder(ctx, tc.Context()).Reset()
		}

		ctx := ctc.as(t, users[0]).startCtx
		ctx = globals.CtxModifyIdentifyNotifier(ctx, NewSimpleIdentifyNotifier(tc.Context()))
		tc.Context().PushHandler.(*PushHandler).identNotifier = DummyIdentifyNotifier{}
		tc1.Context().PushHandler.(*PushHandler).identNotifier = DummyIdentifyNotifier{}

		res, err := ctc.as(t, users[0]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          displayName,
				MembersType:      chat1.ConversationMembersType_IMPTEAMNATIVE,
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
				MembersType:      chat1.ConversationMembersType_IMPTEAMNATIVE,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		consumeNewConversation(t, listener0, ncres.Conv.GetConvID())
		assertNoNewConversation(t, listener1)
		consumeIdentify(ctx, listener0) //encrypt for first message

		uid := users[0].User.GetUID().ToBytes()
		conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, ncres.Conv.Info.Id,
			types.InboxSourceDataSourceRemoteOnly)
		require.NoError(t, err)
		require.NotEmpty(t, conv.Conv.MaxMsgSummaries, "created conversation does not have a message")
		require.Equal(t, ncres.Conv.Info.MembersType, chat1.ConversationMembersType_IMPTEAMNATIVE,
			"implicit team")

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
		consumeIdentify(ctx, listener0) // EncryptionKeys

		// user 1 sends a message to conv
		ctx = ctc.as(t, users[1]).startCtx
		ctx = globals.CtxModifyIdentifyNotifier(ctx, NewSimpleIdentifyNotifier(tc1.Context()))
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
		consumeIdentify(ctx, listener1) // EncryptionKeys

		// user 1 finds the conversation
		res, err = ctc.as(t, users[1]).chatLocalHandler().FindConversationsLocal(ctx,
			chat1.FindConversationsLocalArg{
				TlfName:          displayName,
				MembersType:      chat1.ConversationMembersType_IMPTEAMNATIVE,
				Visibility:       keybase1.TLFVisibility_PRIVATE,
				TopicType:        chat1.TopicType_CHAT,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Conversations), "no convs found")
	})
}

func TestChatSrvImpTeamExistingKBFS(t *testing.T) {
	os.Setenv("KEYBASE_FEATURES", "admin")
	defer os.Setenv("KEYBASE_FEATURES", "")
	ctc := makeChatTestContext(t, "NewConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	c1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, chat1.ConversationMembersType_KBFS, ctc.as(t, users[1]).user())
	c2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, chat1.ConversationMembersType_IMPTEAMNATIVE, ctc.as(t, users[1]).user())

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
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		inboxRes, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{
				Query: &chat1.GetInboxLocalQuery{
					ConvIDs: []chat1.ConversationID{conv.Id},
				},
			})
		require.NoError(t, err)
		require.NotNil(t, inboxRes.Conversations[0].Notifications)
		require.True(t, inboxRes.Conversations[0].Notifications.Settings[keybase1.DeviceType_DESKTOP][chat1.NotificationKind_GENERIC])

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
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
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

		// Check remote notifications
		uconv, err := utils.GetUnverifiedConv(ctx, ctc.as(t, users[0]).h.G(), users[0].GetUID().ToBytes(),
			conv.Id, types.InboxSourceDataSourceRemoteOnly)
		require.NoError(t, err)
		require.NotNil(t, uconv.Conv.Notifications)
		require.True(t,
			uconv.Conv.Notifications.Settings[keybase1.DeviceType_DESKTOP][chat1.NotificationKind_GENERIC])

		inboxRes, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{
				Query: &chat1.GetInboxLocalQuery{
					ConvIDs: []chat1.ConversationID{conv.Id},
				},
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(inboxRes.Conversations))
		require.Equal(t, chat1.TeamType_COMPLEX, inboxRes.Conversations[0].Info.TeamType)
		require.NotNil(t, inboxRes.Conversations[0].Notifications)
		require.True(t, inboxRes.Conversations[0].Notifications.Settings[keybase1.DeviceType_DESKTOP][chat1.NotificationKind_GENERIC])
	})
}

func TestChatSrvDeleteConversation(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctc := makeChatTestContext(t, "TestChatSrvDeleteConversation", 2)
		defer ctc.cleanup()
		users := ctc.users()

		ctx := ctc.as(t, users[0]).startCtx
		ctx1 := ctc.as(t, users[1]).startCtx
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		ctc.as(t, users[1]).h.mockChatUI = ui
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true
		ctc.world.Tcs[users[1].Username].ChatG.Syncer.(*Syncer).isConnected = true

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		consumeNewConversation(t, listener0, conv.Id)
		consumeNewConversation(t, listener1, conv.Id)

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
		require.NoError(t, err)
		channelConvID := channel.Conv.GetConvID()
		t.Logf("conv: %s chan: %s", conv.Id, channelConvID)
		consumeNewConversation(t, listener0, channelConvID)
		assertNoNewConversation(t, listener1)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeTeamType(t, listener0)
		consumeTeamType(t, listener1)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)

		uid := users[0].User.GetUID().ToBytes()
		g := ctc.world.Tcs[users[0].Username].Context()
		_, lconvs, _, err := storage.NewInbox(g).Read(context.TODO(), uid, &chat1.GetInboxQuery{
			ConvID: &channelConvID,
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(lconvs))
		require.Equal(t, lconvs[0].GetConvID(), channelConvID)
		require.Equal(t, chat1.ConversationExistence_ACTIVE, lconvs[0].Conv.Metadata.Existence)

		_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationByIDLocal(ctx1,
			channelConvID)
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
		consumeMembersUpdate(t, listener0)
		consumeJoinConv(t, listener1)
		// second join attempt doesn't error
		_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationByIDLocal(ctx1,
			channelConvID)
		require.NoError(t, err)

		_, err = ctc.as(t, users[1]).chatLocalHandler().DeleteConversationLocal(ctx1,
			chat1.DeleteConversationLocalArg{
				ConvID: channelConvID,
			})
		require.Error(t, err)
		require.IsType(t, libkb.ChatClientError{}, err)

		_, err = ctc.as(t, users[0]).chatLocalHandler().DeleteConversationLocal(ctx,
			chat1.DeleteConversationLocalArg{
				ConvID: channelConvID,
			})
		require.NoError(t, err)
		consumeLeaveConv(t, listener0)
		consumeLeaveConv(t, listener1)
		consumeMembersUpdate(t, listener0)
		consumeMembersUpdate(t, listener1)
		consumeTeamType(t, listener0)
		consumeTeamType(t, listener1)

		updates := consumeNewThreadsStale(t, listener0)
		require.Equal(t, 1, len(updates))
		require.Equal(t, channelConvID, updates[0].ConvID, "wrong cid")
		require.Equal(t, chat1.StaleUpdateType_CLEAR, updates[0].UpdateType)

		updates = consumeNewThreadsStale(t, listener1)
		require.Equal(t, 1, len(updates))
		require.Equal(t, channelConvID, updates[0].ConvID, "wrong cid")
		require.Equal(t, chat1.StaleUpdateType_CLEAR, updates[0].UpdateType)

		_, lconvs, _, err = storage.NewInbox(g).Read(context.TODO(), uid, &chat1.GetInboxQuery{
			ConvID:       &channelConvID,
			MemberStatus: []chat1.ConversationMemberStatus{chat1.ConversationMemberStatus_LEFT},
			Existences:   []chat1.ConversationExistence{chat1.ConversationExistence_ARCHIVED},
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(lconvs))
		require.Equal(t, lconvs[0].GetConvID(), channelConvID)

		iboxRes, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
	})
}

type fakeInboxSource struct {
	types.InboxSource
}

func (is fakeInboxSource) IsOffline(context.Context) bool {
	return false
}

type fakeChatUI struct {
	confirmChannelDelete bool
	libkb.ChatUI
}

func (fc fakeChatUI) ChatConfirmChannelDelete(ctx context.Context, arg chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	return fc.confirmChannelDelete, nil
}

type fakeUISource struct {
	UISource
	chatUI libkb.ChatUI
}

func (ui *fakeUISource) GetChatUI(sessionID int) libkb.ChatUI {
	return ui.chatUI
}

type fakeRemoteInterface struct {
	chat1.RemoteInterface
	deleteConversationCalled bool
}

func (ri *fakeRemoteInterface) DeleteConversation(context.Context, chat1.ConversationID) (chat1.DeleteConversationRemoteRes, error) {
	ri.deleteConversationCalled = true
	return chat1.DeleteConversationRemoteRes{}, nil
}

func TestChatSrvDeleteConversationConfirmed(t *testing.T) {
	gc := libkb.NewGlobalContext()
	gc.Init()
	var is fakeInboxSource
	cc := globals.ChatContext{
		InboxSource: is,
	}
	g := globals.NewContext(gc, &cc)

	ui := fakeUISource{}
	h := NewServer(g, nil, &ui)

	var ri fakeRemoteInterface
	h.setTestRemoteClient(&ri)

	_, err := h.deleteConversationLocal(context.Background(), chat1.DeleteConversationLocalArg{
		Confirmed: true,
	})
	require.NoError(t, err)
	require.True(t, ri.deleteConversationCalled)
}

func TestChatSrvDeleteConversationUnconfirmed(t *testing.T) {
	gc := libkb.NewGlobalContext()
	gc.Init()
	var is fakeInboxSource
	cc := globals.ChatContext{
		InboxSource: is,
	}
	g := globals.NewContext(gc, &cc)

	chatUI := fakeChatUI{confirmChannelDelete: false}
	ui := fakeUISource{
		chatUI: chatUI,
	}
	h := NewServer(g, nil, &ui)

	var ri fakeRemoteInterface
	h.setTestRemoteClient(&ri)

	ctx := context.Background()
	var arg chat1.DeleteConversationLocalArg

	_, err := h.deleteConversationLocal(ctx, arg)
	require.Equal(t, errors.New("channel delete unconfirmed"), err)
	require.False(t, ri.deleteConversationCalled)

	ui.chatUI = fakeChatUI{confirmChannelDelete: true}
	_, err = h.deleteConversationLocal(ctx, arg)
	require.NoError(t, err)
	require.True(t, ri.deleteConversationCalled)
}

func kickTeamRekeyd(g *libkb.GlobalContext, t libkb.TestingTB) {
	mctx := libkb.NewMetaContextBackground(g)
	apiArg := libkb.APIArg{
		Endpoint:    "test/accelerate_team_rekeyd",
		Args:        libkb.HTTPArgs{},
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := g.API.Post(mctx, apiArg)
	if err != nil {
		t.Fatalf("Failed to accelerate team rekeyd: %s", err)
	}
}

func TestChatSrvUserResetAndDeleted(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAMNATIVE,
			chat1.ConversationMembersType_IMPTEAMUPGRADE:
		default:
			return
		}

		ctc := makeChatTestContext(t, "TestChatSrvUserResetAndDeleted", 4)
		defer ctc.cleanup()
		users := ctc.users()

		ctx := ctc.as(t, users[0]).startCtx
		ctx1 := ctc.as(t, users[1]).startCtx
		ctx2 := ctc.as(t, users[2]).startCtx
		ctx3 := ctc.as(t, users[3]).startCtx
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
		listener2 := newServerChatListener()
		ctc.as(t, users[2]).h.G().NotifyRouter.AddListener(listener2)
		listener3 := newServerChatListener()
		ctc.as(t, users[3]).h.G().NotifyRouter.AddListener(listener3)
		t.Logf("u0: %s, u1: %s, u2: %s, u3: %s", users[0].GetUID(), users[1].GetUID(), users[2].GetUID(), users[3].GetUID())

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user(), ctc.as(t, users[3]).user())

		t.Logf("reset user 1")
		ctcForUser := ctc.as(t, users[1])
		require.NoError(t, libkb.ResetAccount(ctcForUser.m, users[1].NormalizedUsername(), users[1].Passphrase))
		select {
		case act := <-listener0.membersUpdate:
			require.Equal(t, act.ConvID, conv.Id)
			require.Equal(t, 1, len(act.Members))
			require.Equal(t, chat1.ConversationMemberStatus_RESET, act.Members[0].Status)
			require.Equal(t, users[1].Username, act.Members[0].Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}
		select {
		case act := <-listener2.membersUpdate:
			require.Equal(t, act.ConvID, conv.Id)
			require.Equal(t, 1, len(act.Members))
			require.Equal(t, chat1.ConversationMemberStatus_RESET, act.Members[0].Status)
			require.Equal(t, users[1].Username, act.Members[0].Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}
		select {
		case act := <-listener3.membersUpdate:
			require.Equal(t, act.ConvID, conv.Id)
			require.Equal(t, 1, len(act.Members))
			require.Equal(t, chat1.ConversationMemberStatus_RESET, act.Members[0].Status)
			require.Equal(t, users[1].Username, act.Members[0].Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}
		select {
		case convID := <-listener1.resetConv:
			require.Equal(t, convID, conv.Id)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		t.Logf("check for correct state after user 1 reset")
		iboxRes, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
		require.Equal(t, 4, len(iboxRes.Conversations[0].Names()))
		require.Equal(t, 1, len(iboxRes.Conversations[0].Info.ResetNames))
		require.Equal(t, users[1].Username, iboxRes.Conversations[0].Info.ResetNames[0])
		iboxRes, err = ctc.as(t, users[1]).chatLocalHandler().GetInboxAndUnboxLocal(ctx1,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			require.Zero(t, len(iboxRes.Conversations))
		default:
			require.Equal(t, 1, len(iboxRes.Conversations))
			require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
			require.Equal(t, chat1.ConversationMemberStatus_RESET, iboxRes.Conversations[0].Info.MemberStatus)
		}
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

		t.Logf("delete user 3")
		ctcForUser3 := ctc.as(t, users[3])
		require.NoError(t, libkb.DeleteAccount(ctcForUser3.m, users[3].NormalizedUsername(), &users[3].Passphrase))
		select {
		case <-listener0.membersUpdate:
			require.Fail(t, "got members update after delete")
		case <-listener2.membersUpdate:
			require.Fail(t, "got members update after delete")
		default:
		}

		select {
		case <-listener2.resetConv:
			require.Fail(t, "got reset conv after delete")
		default:
		}

		// Once deleted we can't log back in or send
		g3 := ctc.as(t, users[3]).h.G().ExternalG()
		require.NoError(t, g3.Logout(context.TODO()))
		require.Error(t, users[3].Login(g3))
		_, err = ctc.as(t, users[3]).chatLocalHandler().PostLocal(ctx3, chat1.PostLocalArg{
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

		t.Logf("reset user 2")
		ctcForUser2 := ctc.as(t, users[2])
		require.NoError(t, libkb.ResetAccount(ctcForUser2.m, users[2].NormalizedUsername(), users[2].Passphrase))
		select {
		case act := <-listener0.membersUpdate:
			require.Equal(t, act.ConvID, conv.Id)
			require.Equal(t, 1, len(act.Members))
			require.Equal(t, chat1.ConversationMemberStatus_RESET, act.Members[0].Status)
			require.Equal(t, users[2].Username, act.Members[0].Member)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}
		select {
		case convID := <-listener2.resetConv:
			require.Equal(t, convID, conv.Id)
		case <-time.After(20 * time.Second):
			require.Fail(t, "failed to get members update")
		}

		t.Logf("get a PUK for user 1 and not for user 2")
		g1 := ctc.as(t, users[1]).h.G().ExternalG()
		require.NoError(t, g1.Logout(context.TODO()))
		require.NoError(t, users[1].Login(g1))
		g2 := ctc.as(t, users[2]).h.G().ExternalG()
		require.NoError(t, g2.Logout(context.TODO()))

		require.NoError(t, ctc.as(t, users[0]).chatLocalHandler().AddTeamMemberAfterReset(ctx,
			chat1.AddTeamMemberAfterResetArg{
				Username: users[1].Username,
				ConvID:   conv.Id,
			}))
		consumeMembersUpdate(t, listener0)
		consumeJoinConv(t, listener1)
		require.NoError(t, ctc.as(t, users[0]).chatLocalHandler().AddTeamMemberAfterReset(ctx,
			chat1.AddTeamMemberAfterResetArg{
				Username: users[2].Username,
				ConvID:   conv.Id,
			}))
		consumeMembersUpdate(t, listener0)
		consumeMembersUpdate(t, listener1)

		iboxRes, err = ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
		require.Equal(t, 4, len(iboxRes.Conversations[0].Names()))
		require.Zero(t, len(iboxRes.Conversations[0].Info.ResetNames))

		iboxRes, err = ctc.as(t, users[1]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
			chat1.GetInboxAndUnboxLocalArg{})
		require.NoError(t, err)
		require.Equal(t, 1, len(iboxRes.Conversations))
		require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
		require.Nil(t, iboxRes.Conversations[0].Error)
		require.Equal(t, 4, len(iboxRes.Conversations[0].Names()))
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

		t.Logf("user 2 gets PUK and tries to do stuff")
		require.NoError(t, users[2].Login(g2))
		kickTeamRekeyd(g2, t)
		for i := 0; i < 200; i++ {
			_, err = ctc.as(t, users[2]).chatLocalHandler().PostLocal(ctx2, chat1.PostLocalArg{
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
			if err == nil {
				break
			}
			time.Sleep(50 * time.Millisecond)
		}
		require.NoError(t, err)

		// Ensure everyone but user3 can access the conversation
		for i := range users {
			g := ctc.as(t, users[i]).h.G()
			ctx = ctc.as(t, users[i]).startCtx
			uid := gregor1.UID(users[i].GetUID().ToBytes())
			tv, err := g.ConvSource.Pull(ctx, conv.Id, uid,
				chat1.GetThreadReason_GENERAL, nil, nil)
			if i == 3 {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.NotZero(t, len(tv.Messages))
			}
		}
	})
}

func TestChatSrvTeamChannelNameMentions(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctc := makeChatTestContext(t, "TestChatSrvTeamChannelNameMentions", 2)
		defer ctc.cleanup()
		users := ctc.users()

		ctx := ctc.as(t, users[0]).startCtx
		ctx1 := ctc.as(t, users[1]).startCtx
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		consumeNewConversation(t, listener0, conv.Id)
		consumeNewConversation(t, listener1, conv.Id)

		topicNames := []string{"miketime", "random", "hi"}
		for index, topicName := range topicNames {
			channel, err := ctc.as(t, users[1]).chatLocalHandler().NewConversationLocal(ctx,
				chat1.NewConversationLocalArg{
					TlfName:       conv.TlfName,
					TopicName:     &topicName,
					TopicType:     chat1.TopicType_CHAT,
					TlfVisibility: keybase1.TLFVisibility_PRIVATE,
					MembersType:   chat1.ConversationMembersType_TEAM,
				})
			t.Logf("conv: %s chan: %s, err: %v", conv.Id, channel.Conv.GetConvID(), err)
			require.NoError(t, err)
			assertNoNewConversation(t, listener0)
			consumeNewConversation(t, listener1, channel.Conv.GetConvID())
			consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
			if index == 0 {
				consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
				consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)
			}

			_, err = ctc.as(t, users[0]).chatLocalHandler().JoinConversationByIDLocal(ctx1,
				channel.Conv.GetConvID())
			require.NoError(t, err)
			consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
			consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)

			_, err = ctc.as(t, users[1]).chatLocalHandler().PostLocal(ctx1, chat1.PostLocalArg{
				ConversationID: channel.Conv.GetConvID(),
				Msg: chat1.MessagePlaintext{
					ClientHeader: chat1.MessageClientHeader{
						Conv:        channel.Conv.Info.Triple,
						MessageType: chat1.MessageType_TEXT,
						TlfName:     channel.Conv.Info.TlfName,
					},
					MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
						Body: fmt.Sprintf("The worst channel is #%s. #error", topicName),
					}),
				},
			})
			require.NoError(t, err)
			consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
			consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)

			tv, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
				ConversationID: channel.Conv.GetConvID(),
				Query: &chat1.GetThreadQuery{
					MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
				},
			})
			require.NoError(t, err)
			uid := users[0].User.GetUID().ToBytes()
			ptv := utils.PresentThreadView(ctx, ctc.as(t, users[0]).h.G(), uid, tv.Thread,
				channel.Conv.GetConvID())
			require.Equal(t, 1, len(ptv.Messages))
			require.Equal(t, 1, len(ptv.Messages[0].Valid().ChannelNameMentions))
			require.Equal(t, topicName, ptv.Messages[0].Valid().ChannelNameMentions[0].Name)
		}
	})
}

func TestChatSrvGetStaticConfig(t *testing.T) {
	ctc := makeChatTestContext(t, "GetStaticConfig", 2)
	defer ctc.cleanup()
	users := ctc.users()
	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	res, err := ctc.as(t, ctc.users()[0]).chatLocalHandler().GetStaticConfig(ctx)
	require.NoError(t, err)
	require.Equal(t, chat1.StaticConfig{
		DeletableByDeleteHistory: chat1.DeletableMessageTypesByDeleteHistory(),
		BuiltinCommands:          tc.Context().CommandsSource.GetBuiltins(ctx),
	}, res)
}

type mockStellar struct {
	libkb.Stellar
	specFn func([]libkb.MiniChatPayment) (*libkb.MiniChatPaymentSummary, error)
}

func (m *mockStellar) SendMiniChatPayments(mctx libkb.MetaContext, convID chat1.ConversationID, payments []libkb.MiniChatPayment) (res []libkb.MiniChatPaymentResult, err error) {
	for _, p := range payments {
		res = append(res, libkb.MiniChatPaymentResult{
			Username:  p.Username,
			PaymentID: stellar1.PaymentID("AHHH"),
			Error:     nil,
		})
	}
	return res, nil
}

func (m *mockStellar) SpecMiniChatPayments(mctx libkb.MetaContext, payments []libkb.MiniChatPayment) (res *libkb.MiniChatPaymentSummary, err error) {
	return m.specFn(payments)
}

func (m *mockStellar) KnownCurrencyCodeInstant(context.Context, string) (bool, bool) {
	return false, false
}

type xlmDeclineChatUI struct {
	*kbtest.ChatUI
}

func (c *xlmDeclineChatUI) ChatStellarDataConfirm(ctx context.Context, summary chat1.UIChatPaymentSummary) (bool, error) {
	c.StellarDataConfirm <- summary
	return false, nil
}

func TestChatSrvStellarUI(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestChatSrvStellarUI", 3)
	defer ctc.cleanup()
	users := ctc.users()

	delay := 2 * time.Second
	//uid := users[0].User.GetUID().ToBytes()
	listener := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
	tc := ctc.world.Tcs[users[0].Username]
	ui := kbtest.NewChatUI()
	declineUI := &xlmDeclineChatUI{ChatUI: ui}
	ctx := ctc.as(t, users[0]).startCtx
	ctc.as(t, users[0]).h.mockChatUI = ui
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, ctc.as(t, users[1]).user(), ctc.as(t, users[2]).user())
	mst := &mockStellar{}
	tc.G.SetStellar(mst)
	tc.ChatG.StellarSender = wallet.NewSender(tc.Context())
	specSuccess := func(payments []libkb.MiniChatPayment) (res *libkb.MiniChatPaymentSummary, err error) {
		res = new(libkb.MiniChatPaymentSummary)
		res.XLMTotal = "10 XLM"
		res.DisplayTotal = "10 USD"
		for _, p := range payments {
			res.Specs = append(res.Specs, libkb.MiniChatPaymentSpec{
				Username:  p.Username,
				XLMAmount: p.Amount + " XLM",
			})
		}
		return res, nil
	}
	specFail := func(payments []libkb.MiniChatPayment) (res *libkb.MiniChatPaymentSummary, err error) {
		return res, errors.New("failed")
	}
	successCase := func(expectError bool) {
		mst.specFn = specSuccess
		_, err := ctc.as(t, users[0]).chatLocalHandler().PostTextNonblock(ctx,
			chat1.PostTextNonblockArg{
				ConversationID: conv.Id,
				TlfName:        conv.TlfName,
				Body:           fmt.Sprintf("+1xlm@%s +5xlm@%s", users[1].Username, users[2].Username),
			})
		if expectError {
			require.Error(t, err)
		} else {
			require.NoError(t, err)
		}
		select {
		case <-ui.StellarShowConfirm:
		case <-time.After(delay):
			require.Fail(t, "no confirm")
		}
		select {
		case data := <-ui.StellarDataConfirm:
			require.Equal(t, 2, len(data.Payments))
			require.Equal(t, "10 XLM", data.XlmTotal)
			require.Equal(t, "1 XLM", data.Payments[0].XlmAmount)
			require.Equal(t, "5 XLM", data.Payments[1].XlmAmount)
			require.Equal(t, users[1].Username, data.Payments[0].Username)
			require.Equal(t, users[2].Username, data.Payments[1].Username)
		case <-time.After(delay):
			require.Fail(t, "no confirm")
		}
		select {
		case <-ui.StellarDone:
		case <-time.After(delay):
			require.Fail(t, "no done")
		}
		if !expectError {
			consumeNewPendingMsg(t, listener)
			select {
			case msg := <-listener.newMessageLocal:
				require.True(t, msg.Message.IsValid())
				require.Equal(t, 2, len(msg.Message.Valid().AtMentions))
			case <-time.After(delay):
				require.Fail(t, "no local msg")
			}
			select {
			case msg := <-listener.newMessageRemote:
				require.True(t, msg.Message.IsValid())
				require.Equal(t, 2, len(msg.Message.Valid().AtMentions))
			case <-time.After(delay):
				require.Fail(t, "no remote msg")
			}
		}
	}
	t.Logf("success accept")
	successCase(false)
	t.Logf("success decline")
	ctc.as(t, users[0]).h.mockChatUI = declineUI
	successCase(true)
	ctc.as(t, users[0]).h.mockChatUI = ui

	t.Logf("fail")
	mst.specFn = specFail
	_, err := ctc.as(t, users[0]).chatLocalHandler().PostTextNonblock(ctx, chat1.PostTextNonblockArg{
		ConversationID: conv.Id,
		TlfName:        conv.TlfName,
		Body:           fmt.Sprintf("+1xlm@%s +5xlm@%s", users[1].Username, users[2].Username),
	})
	require.Error(t, err)
	select {
	case <-ui.StellarShowConfirm:
	case <-time.After(delay):
		require.Fail(t, "no confirm")
	}
	select {
	case <-ui.StellarDataConfirm:
		require.Fail(t, "no confirm")
	default:
	}
	select {
	case <-ui.StellarDataError:
	case <-time.After(delay):
		require.Fail(t, "no error")
	}
	select {
	case <-ui.StellarDone:
	case <-time.After(delay):
		require.Fail(t, "no done")
	}

	t.Logf("no payments")
	_, err = ctc.as(t, users[0]).chatLocalHandler().PostTextNonblock(ctx, chat1.PostTextNonblockArg{
		ConversationID: conv.Id,
		TlfName:        conv.TlfName,
		Body:           "pay me back",
	})
	require.NoError(t, err)
	select {
	case <-ui.StellarShowConfirm:
		require.Fail(t, "confirm")
	default:
	}
	consumeNewPendingMsg(t, listener)
}

func TestChatSrvEphemeralPolicy(t *testing.T) {
	ctc := makeChatTestContext(t, "TestChatSrvEphemeralPolicy", 1)
	defer ctc.cleanup()
	users := ctc.users()
	useRemoteMock = false
	defer func() { useRemoteMock = true }()

	timeout := 20 * time.Second
	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
	getMsg := func(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID) chat1.MessageUnboxed {
		res, err := ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(ctx, chat1.GetMessagesLocalArg{
			ConversationID: convID,
			MessageIDs:     []chat1.MessageID{msgID},
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(res.Messages))
		return res.Messages[0]
	}
	checkEph := func(convID chat1.ConversationID, exp int) {
		select {
		case rmsg := <-listener0.newMessageRemote:
			msg := getMsg(ctx, convID, rmsg.Message.GetMessageID())
			require.True(t, msg.IsValid())
			require.NotNil(t, msg.Valid().ClientHeader.EphemeralMetadata)
			require.Equal(t, gregor1.DurationSec(exp), msg.Valid().ClientHeader.EphemeralMetadata.Lifetime)
		case <-time.After(timeout):
			require.Fail(t, "no message")
		}
	}

	impconv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	policy := chat1.NewRetentionPolicyWithEphemeral(chat1.RpEphemeral{
		Age: gregor1.DurationSec(86400),
	})
	mustSetConvRetentionLocal(t, ctc, users[0], impconv.Id, policy)
	consumeSetConvRetention(t, listener0)
	msg := consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
	verifyChangeRetentionSystemMessage(t, msg, chat1.MessageSystemChangeRetention{
		IsTeam:      false,
		IsInherit:   false,
		Policy:      policy,
		MembersType: chat1.ConversationMembersType_IMPTEAMNATIVE,
		User:        users[0].Username,
	})

	mustPostLocalForTest(t, ctc, users[0], impconv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HI",
		}))
	checkEph(impconv.Id, 86400)
	_, err := tc.Context().GregorState.InjectItem(ctx, fmt.Sprintf("exploding:%s", impconv.Id),
		[]byte("3600"), gregor1.TimeOrOffset{})
	require.NoError(t, err)
	msgID := mustPostLocalForTest(t, ctc, users[0], impconv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HI",
		}))
	checkEph(impconv.Id, 3600)
	mustDeleteMsg(ctx, t, ctc, users[0], impconv, msgID)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_DELETE)

	teamconv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)
	policy = chat1.NewRetentionPolicyWithEphemeral(chat1.RpEphemeral{
		Age: gregor1.DurationSec(86400),
	})
	mustSetTeamRetentionLocal(t, ctc, users[0], keybase1.TeamID(teamconv.Triple.Tlfid.String()), policy)
	consumeSetTeamRetention(t, listener0)
	msg = consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
	verifyChangeRetentionSystemMessage(t, msg, chat1.MessageSystemChangeRetention{
		IsTeam:      true,
		IsInherit:   false,
		Policy:      policy,
		MembersType: chat1.ConversationMembersType_TEAM,
		User:        users[0].Username,
	})
	msgID = mustPostLocalForTest(t, ctc, users[0], teamconv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HI",
		}))
	checkEph(teamconv.Id, 86400)
	mustDeleteMsg(ctx, t, ctc, users[0], teamconv, msgID)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_DELETE)
}

func TestChatSrvStellarMessages(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		runWithEphemeral(t, mt, func(ephemeralLifetime *gregor1.DurationSec) {
			switch mt {
			case chat1.ConversationMembersType_KBFS:
				return
			}

			ctc := makeChatTestContext(t, "SrvStellarMessages", 2)
			defer ctc.cleanup()
			users := ctc.users()

			uid := users[0].User.GetUID().ToBytes()
			tc := ctc.world.Tcs[users[0].Username]
			ctx := ctc.as(t, users[0]).startCtx
			listener := newServerChatListener()
			ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
			tc.ChatG.Syncer.(*Syncer).isConnected = true

			created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
				mt, ctc.as(t, users[1]).user())

			t.Logf("send a request message")
			body := chat1.NewMessageBodyWithRequestpayment(chat1.MessageRequestPayment{
				RequestID: stellar1.KeybaseRequestID("dummy id"),
				Note:      "Test note",
			})

			_, err := postLocalEphemeralForTest(t, ctc, users[0], created, body, ephemeralLifetime)
			require.NoError(t, err)

			var unboxed chat1.UIMessage
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.Equal(t, chat1.MessageType_REQUESTPAYMENT, unboxed.GetMessageType(), "invalid type")
				require.Equal(t, body.Requestpayment(), unboxed.Valid().MessageBody.Requestpayment())
				require.False(t, unboxed.IsEphemeral())
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_REQUESTPAYMENT)

			tv, err := tc.Context().ConvSource.Pull(ctx, created.Id, uid,
				chat1.GetThreadReason_GENERAL, nil, nil)
			require.NoError(t, err)
			require.NotZero(t, len(tv.Messages))
			require.Equal(t, chat1.MessageType_REQUESTPAYMENT, tv.Messages[0].GetMessageType())

			t.Logf("delete the message")
			darg := chat1.PostDeleteNonblockArg{
				ConversationID:   created.Id,
				TlfName:          created.TlfName,
				TlfPublic:        created.Visibility == keybase1.TLFVisibility_PUBLIC,
				Supersedes:       unboxed.GetMessageID(),
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			}
			res, err := ctc.as(t, users[0]).chatLocalHandler().PostDeleteNonblock(ctx, darg)
			require.NoError(t, err)
			select {
			case info := <-listener.newMessageRemote:
				unboxed = info.Message
				require.True(t, unboxed.IsValid(), "invalid message")
				require.NotNil(t, unboxed.Valid().OutboxID, "no outbox ID")
				require.Equal(t, res.OutboxID.String(), *unboxed.Valid().OutboxID, "mismatch outbox ID")
				require.Equal(t, chat1.MessageType_DELETE, unboxed.GetMessageType(), "invalid type")
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event (DELETE) received")
			}
			consumeNewMsgLocal(t, listener, chat1.MessageType_DELETE)

			tv, err = tc.Context().ConvSource.Pull(ctx, created.Id, uid,
				chat1.GetThreadReason_GENERAL, nil, nil)
			require.NoError(t, err)
			require.NotZero(t, len(tv.Messages))
			require.Equal(t, chat1.MessageType_DELETE, tv.Messages[0].GetMessageType())
			for _, msg := range tv.Messages {
				require.NotEqual(t, chat1.MessageType_REQUESTPAYMENT, msg.GetMessageType())
			}
		})
	})
}

func TestChatBulkAddToConv(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctc := makeChatTestContext(t, "BulkAddToConv", 2)
		defer ctc.cleanup()
		users := ctc.users()
		t.Logf("uid1: %v, uid2: %v", users[0].User.GetUID(), users[1].User.GetUID())

		tc1 := ctc.world.Tcs[users[0].Username]
		tc2 := ctc.world.Tcs[users[0].Username]
		ctx := ctc.as(t, users[0]).startCtx

		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		tc1.ChatG.Syncer.(*Syncer).isConnected = true

		listener1 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
		tc2.ChatG.Syncer.(*Syncer).isConnected = true

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
			mt, ctc.as(t, users[1]).user())

		// create a channel and bulk add user1 to it
		topicName := "bulk"
		channel, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       conv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   mt,
			})
		t.Logf("conv: %s chan: %s, err: %v", conv.Id, channel.Conv.GetConvID(), err)
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)

		usernames := []string{users[1].Username}
		err = ctc.as(t, users[0]).chatLocalHandler().BulkAddToConv(ctx,
			chat1.BulkAddToConvArg{
				Usernames: usernames,
				ConvID:    channel.Conv.GetConvID(),
			})
		require.NoError(t, err)

		assertSysMsg := func(expectedMentions, expectedBody []string, listener *serverChatListener) {
			msg := consumeNewMsgRemote(t, listener, chat1.MessageType_SYSTEM)
			body := msg.Valid().MessageBody
			typ, err := body.MessageType()
			require.NoError(t, err)
			require.Equal(t, chat1.MessageType_SYSTEM, typ)
			sysMsg := body.System()
			sysTyp, err := sysMsg.SystemType()
			require.NoError(t, err)
			require.Equal(t, chat1.MessageSystemType_BULKADDTOCONV, sysTyp)
			retMsg := sysMsg.Bulkaddtoconv()
			require.Equal(t, expectedBody, retMsg.Usernames)
			require.True(t, msg.IsValid())
			require.Equal(t, expectedMentions, msg.Valid().AtMentions)
		}
		assertSysMsg(usernames, usernames, listener0)
		assertSysMsg(usernames, usernames, listener1)
		consumeMembersUpdate(t, listener0)
		consumeJoinConv(t, listener1)
		// u1 can now send
		mustPostLocalForTest(t, ctc, users[1], channel.Conv.Info,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "hi",
			}))
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)

		// some users required
		err = ctc.as(t, users[0]).chatLocalHandler().BulkAddToConv(ctx,
			chat1.BulkAddToConvArg{
				Usernames: nil,
				ConvID:    channel.Conv.GetConvID(),
			})
		require.Error(t, err)

		usernames = []string{"foo"}
		err = ctc.as(t, users[0]).chatLocalHandler().BulkAddToConv(ctx,
			chat1.BulkAddToConvArg{
				Usernames: usernames,
				ConvID:    channel.Conv.GetConvID(),
			})
		require.NoError(t, err)
		assertSysMsg(nil, usernames, listener0)
		assertSysMsg(nil, usernames, listener1)
	})
}

func TestReacjiStore(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_IMPTEAMNATIVE:
		default:
			return
		}
		ctc := makeChatTestContext(t, "ReacjiStore", 1)
		defer ctc.cleanup()

		user := ctc.users()[0]
		uid := user.User.GetUID().ToBytes()
		tc := ctc.world.Tcs[user.Username]
		ctx := ctc.as(t, user).startCtx

		listener := newServerChatListener()
		ctc.as(t, user).h.G().NotifyRouter.AddListener(listener)
		tc.ChatG.Syncer.(*Syncer).isConnected = true
		reacjiStore := storage.NewReacjiStore(ctc.as(t, user).h.G())
		assertReacjiStore := func(actual, expected keybase1.UserReacjis, expectedData *storage.ReacjiInternalStorage) {
			require.Equal(t, expected, actual)
			data := reacjiStore.GetInternalStore(ctx, uid)
			require.Equal(t, expectedData, data)
		}

		expectedData := storage.NewReacjiInternalStorage()
		for _, el := range storage.DefaultTopReacjis {
			expectedData.FrequencyMap[el] = 0
		}
		conv := mustCreateConversationForTest(t, ctc, user, chat1.TopicType_CHAT, mt)
		// if the user has no history we return the default list
		userReacjis := tc.G.ChatHelper.UserReacjis(ctx, uid)
		assertReacjiStore(userReacjis, keybase1.UserReacjis{TopReacjis: storage.DefaultTopReacjis}, expectedData)

		// post a bunch of reactions, we should end up with these reactions
		// replacing the defaults sorted alphabetically (since they tie on
		// being used once each)
		reactionKeys := []string{
			":a:",
			":8ball:",
			":3rd_place_medal:",
			":2nd_place_medal:",
			":1st_place_medal:",
			":1234:",
			":100:",
		}
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		textID := mustPostLocalForTest(t, ctc, user, conv, msg)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		expected := keybase1.UserReacjis{}
		for i, reaction := range reactionKeys {
			expectedData.FrequencyMap[reaction]++
			mustReactToMsg(ctx, t, ctc, user, conv, textID, reaction)
			consumeNewMsgRemote(t, listener, chat1.MessageType_REACTION)
			info := consumeReactionUpdate(t, listener)
			expected.TopReacjis = append([]string{reaction}, expected.TopReacjis...)
			if i < 5 {
				// remove defaults as user values are added
				delete(expectedData.FrequencyMap, storage.DefaultTopReacjis[len(storage.DefaultTopReacjis)-i-1])
				expected.TopReacjis = append(expected.TopReacjis, storage.DefaultTopReacjis...)[:len(storage.DefaultTopReacjis)]
			}
			assertReacjiStore(info.UserReacjis, expected, expectedData)
		}
		// bump "a" to the most frequent
		msg = chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		textID2 := mustPostLocalForTest(t, ctc, user, conv, msg)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
		mustReactToMsg(ctx, t, ctc, user, conv, textID2, ":100:")
		consumeNewMsgRemote(t, listener, chat1.MessageType_REACTION)
		expectedData.FrequencyMap[":100:"]++
		info := consumeReactionUpdate(t, listener)
		assertReacjiStore(info.UserReacjis, expected, expectedData)

		// putSkinTone
		expectedSkinTone := keybase1.ReacjiSkinTone(4)
		userReacjis, err := ctc.as(t, user).chatLocalHandler().PutReacjiSkinTone(ctx, expectedSkinTone)
		require.NoError(t, err)
		expected.SkinTone = expectedSkinTone
		expectedData.SkinTone = expectedSkinTone
		assertReacjiStore(userReacjis, expected, expectedData)
	})
}

func TestGlobalAppNotificationSettings(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_IMPTEAMNATIVE:
		default:
			return
		}
		ctc := makeChatTestContext(t, "GlobalAppNotificationSettings", 1)
		defer ctc.cleanup()

		user := ctc.users()[0]
		//tc := ctc.world.Tcs[user.Username]
		ctx := ctc.as(t, user).startCtx
		expectedSettings := map[chat1.GlobalAppNotificationSetting]bool{
			chat1.GlobalAppNotificationSetting_NEWMESSAGES:      true,
			chat1.GlobalAppNotificationSetting_PLAINTEXTDESKTOP: true,
			chat1.GlobalAppNotificationSetting_PLAINTEXTMOBILE:  false,
			chat1.GlobalAppNotificationSetting_DISABLETYPING:    false,
		}

		// convert the expectedSettings to the RPC format
		strSettings := func() map[string]bool {
			s := make(map[string]bool)
			for k, v := range expectedSettings {
				s[strconv.Itoa(int(k))] = v
			}
			return s
		}

		// Test default settings
		s, err := ctc.as(t, user).chatLocalHandler().GetGlobalAppNotificationSettingsLocal(ctx)
		require.NoError(t, err)
		for k, v := range expectedSettings {
			require.Equal(t, v, s.Settings[k], fmt.Sprintf("Not equal %v", k))
			// flip all the defaults for the next test
			expectedSettings[k] = !v
		}

		err = ctc.as(t, user).chatLocalHandler().SetGlobalAppNotificationSettingsLocal(ctx, strSettings())
		require.NoError(t, err)
		s, err = ctc.as(t, user).chatLocalHandler().GetGlobalAppNotificationSettingsLocal(ctx)
		require.NoError(t, err)
		for k, v := range expectedSettings {
			require.Equal(t, v, s.Settings[k], fmt.Sprintf("Not equal %v", k))
		}
	})
}

func TestMessageDrafts(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestMessageDrafts", 1)
	defer ctc.cleanup()

	user := ctc.users()[0]
	conv := mustCreateConversationForTest(t, ctc, user, chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)

	draft := "NEW MESSAAGE"
	require.NoError(t, ctc.as(t, user).chatLocalHandler().UpdateUnsentText(context.TODO(),
		chat1.UpdateUnsentTextArg{
			ConversationID: conv.Id,
			TlfName:        conv.TlfName,
			Text:           draft,
		}))
	ibres, err := ctc.as(t, user).chatLocalHandler().GetInboxAndUnboxLocal(context.TODO(),
		chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{conv.Id},
			},
		})
	require.NoError(t, err)
	require.Equal(t, 1, len(ibres.Conversations))
	require.NotNil(t, ibres.Conversations[0].Info.Draft)
	require.Equal(t, draft, *ibres.Conversations[0].Info.Draft)

	_, err = ctc.as(t, user).chatLocalHandler().PostLocalNonblock(context.TODO(), chat1.PostLocalNonblockArg{
		ConversationID: conv.Id,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				TlfName:     conv.TlfName,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "HIHIHI",
			}),
		},
	})
	require.NoError(t, err)

	worked := false
	for i := 0; i < 5; i++ {
		ibres, err = ctc.as(t, user).chatLocalHandler().GetInboxAndUnboxLocal(context.TODO(),
			chat1.GetInboxAndUnboxLocalArg{
				Query: &chat1.GetInboxLocalQuery{
					ConvIDs: []chat1.ConversationID{conv.Id},
				},
			})
		require.NoError(t, err)
		require.Equal(t, 1, len(ibres.Conversations))
		if ibres.Conversations[0].Info.Draft == nil {
			worked = true
			break
		}
		time.Sleep(time.Second)
	}
	require.True(t, worked)
}
