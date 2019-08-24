package kbtest

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/pager"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	context "golang.org/x/net/context"
)

type ChatTestContext struct {
	libkb.TestContext
	ChatG *globals.ChatContext
}

func NewMetaContextForTest(c ChatTestContext) libkb.MetaContext {
	return libkb.NewMetaContextForTest(c.TestContext)
}

func (c ChatTestContext) Context() *globals.Context {
	return globals.NewContext(c.G, c.ChatG)
}

func (c ChatTestContext) Cleanup() {
	if c.ChatG.MessageDeliverer != nil {
		<-c.ChatG.MessageDeliverer.Stop(context.TODO())
	}
	if c.ChatG.ConvLoader != nil {
		<-c.ChatG.ConvLoader.Stop(context.TODO())
	}
	if c.ChatG.FetchRetrier != nil {
		<-c.ChatG.FetchRetrier.Stop(context.TODO())
	}
	if c.ChatG.EphemeralPurger != nil {
		<-c.ChatG.EphemeralPurger.Stop(context.TODO())
	}
	if c.ChatG.InboxSource != nil {
		<-c.ChatG.InboxSource.Stop(context.TODO())
	}
	if c.ChatG.Indexer != nil {
		<-c.ChatG.Indexer.Stop(context.TODO())
	}
	if c.ChatG.CoinFlipManager != nil {
		<-c.ChatG.CoinFlipManager.Stop(context.TODO())
	}
	if c.ChatG.BotCommandManager != nil {
		<-c.ChatG.BotCommandManager.Stop(context.TODO())
	}
	c.TestContext.Cleanup()
}

type ChatMockWorld struct {
	Fc clockwork.FakeClock

	T       testing.TB
	Tcs     map[string]*ChatTestContext
	TcsByID map[string]*ChatTestContext
	Users   map[string]*FakeUser
	tlfs    map[keybase1.CanonicalTlfName]chat1.TLFID
	tlfKeys map[keybase1.CanonicalTlfName][]keybase1.CryptKey

	// should always be sorted by newly updated conversation first
	conversations []*chat1.Conversation

	// each slice should always be sorted by message ID in desc, i.e. newest messages first
	Msgs map[string][]*chat1.MessageBoxed
}

func NewChatMockWorld(t *testing.T, name string, numUsers int) (world *ChatMockWorld) {
	world = &ChatMockWorld{
		T:       t,
		Fc:      clockwork.NewFakeClockAt(time.Now()),
		Tcs:     make(map[string]*ChatTestContext),
		TcsByID: make(map[string]*ChatTestContext),
		Users:   make(map[string]*FakeUser),
		tlfs:    make(map[keybase1.CanonicalTlfName]chat1.TLFID),
		tlfKeys: make(map[keybase1.CanonicalTlfName][]keybase1.CryptKey),
		Msgs:    make(map[string][]*chat1.MessageBoxed),
	}
	for i := 0; i < numUsers; i++ {
		kbTc := externalstest.SetupTest(t, "chat_"+name, 0)
		tc := ChatTestContext{
			TestContext: kbTc,
			ChatG:       &globals.ChatContext{},
		}
		tc.G.SetClock(world.Fc)
		u, err := CreateAndSignupFakeUser("chat", tc.G)
		if err != nil {
			t.Fatal(err)
		}
		world.Users[u.Username] = u
		world.Tcs[u.Username] = &tc
		world.TcsByID[u.User.GetUID().String()] = &tc
	}

	world.Fc.Advance(time.Hour)
	return world
}

func (w *ChatMockWorld) Cleanup() {
	for _, tc := range w.Tcs {
		tc.Cleanup()
	}
}

func (w *ChatMockWorld) GetConversationByID(convID chat1.ConversationID) *chat1.Conversation {
	for _, conv := range w.conversations {
		if conv.Metadata.ConversationID.String() == convID.String() {
			return conv
		}
	}
	return nil
}

type ByUsername []*FakeUser

func (m ByUsername) Len() int      { return len(m) }
func (m ByUsername) Swap(i, j int) { m[i], m[j] = m[j], m[i] }
func (m ByUsername) Less(i, j int) bool {
	res := strings.Compare(m[i].Username, m[j].Username)
	return res < 0
}

func (w *ChatMockWorld) GetUsers() (res []*FakeUser) {
	for _, v := range w.Users {
		res = append(res, v)
	}
	sort.Sort(ByUsername(res))
	return res
}

func mustGetRandBytesWithControlledFirstByte(n int, controlled byte) (b []byte) {
	b = make([]byte, n)
	if nn, err := rand.Read(b); err != nil || n != nn {
		panic("oops")
	}
	b[0] = controlled // in case we have a collision?
	return b
}

func mustGetRandCryptKeys(controlled byte) []keybase1.CryptKey {
	key := keybase1.CryptKey{
		KeyGeneration: 1,
	}
	copy(key.Key[:], mustGetRandBytesWithControlledFirstByte(32, controlled))
	return []keybase1.CryptKey{key}
}

type TlfMock struct {
	sync.Mutex
	world *ChatMockWorld
}

func NewTlfMock(world *ChatMockWorld) *TlfMock {
	return &TlfMock{world: world}
}

func CanonicalTlfNameForTest(tlfName string) keybase1.CanonicalTlfName {
	// very much simplified canonicalization.
	// TODO: implement rest when we need it
	var names []string
	nameMap := make(map[string]bool)
	rawNames := strings.Split(tlfName, ",")
	for _, rn := range rawNames {
		if nameMap[rn] {
			continue
		}
		names = append(names, rn)
		nameMap[rn] = true
	}
	sort.Strings(names)
	return keybase1.CanonicalTlfName(strings.Join(names, ","))
}

func (m *TlfMock) newTLFID() chat1.TLFID {
	suffix := byte(0x29)
	idBytes, err := libkb.RandBytesWithSuffix(16, suffix)
	if err != nil {
		panic("RandBytes failed: " + err.Error())
	}
	return chat1.TLFID(idBytes)
}

func (m *TlfMock) getTlfID(cname keybase1.CanonicalTlfName) (keybase1.TLFID, error) {
	m.Lock()
	defer m.Unlock()
	tlfID, ok := m.world.tlfs[cname]
	if !ok {
		for _, n := range strings.Split(string(cname), ",") {
			if m.world.Users[n] == nil {
				return "", fmt.Errorf("user %s not found", n)
			}
		}
		tlfID = m.newTLFID()
		m.world.tlfs[cname] = tlfID
		m.world.tlfKeys[cname] = mustGetRandCryptKeys(byte(len(m.world.tlfKeys) + 1))
	}
	return keybase1.TLFID(hex.EncodeToString([]byte(tlfID))), nil
}

func (m *TlfMock) AllCryptKeys(ctx context.Context, tlfName string, public bool) (res types.AllCryptKeys, err error) {
	cres, err := m.CryptKeys(ctx, tlfName)
	if err != nil {
		return res, err
	}
	res = types.NewAllCryptKeys()
	for _, key := range cres.CryptKeys {
		res[chat1.ConversationMembersType_KBFS] =
			append(res[chat1.ConversationMembersType_KBFS], key)
		res[chat1.ConversationMembersType_TEAM] =
			append(res[chat1.ConversationMembersType_TEAM], key)
	}
	return res, nil
}
func (m *TlfMock) LookupName(ctx context.Context, tlfID chat1.TLFID, public bool) (res types.NameInfo, err error) {
	fakeNameInfo := types.NameInfo{}
	return fakeNameInfo, nil
}

func (m *TlfMock) LookupID(ctx context.Context, tlfName string, public bool) (res types.NameInfo, err error) {
	var tlfID keybase1.TLFID
	name := CanonicalTlfNameForTest(tlfName)
	res.CanonicalName = name.String()
	if tlfID, err = m.getTlfID(name); err != nil {
		return res, err
	}
	res.ID = tlfID.ToBytes()
	return res, nil
}

func (m *TlfMock) EncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	botUID *gregor1.UID) (key types.CryptKey, ni types.NameInfo, err error) {
	if botUID != nil {
		return key, ni, fmt.Errorf("TeambotKeys not supported by KBFS")
	}
	if ni, err = m.LookupID(ctx, tlfName, public); err != nil {
		return key, ni, err
	}
	if public {
		var zero [libkb.NaclDHKeySecretSize]byte
		return keybase1.CryptKey{
			KeyGeneration: 1,
			Key:           keybase1.Bytes32(zero),
		}, ni, nil
	}
	allKeys, err := m.AllCryptKeys(ctx, tlfName, public)
	if err != nil {
		return key, ni, err
	}
	keys := allKeys[chat1.ConversationMembersType_KBFS]
	return keys[len(keys)-1], ni, nil
}

func (m *TlfMock) DecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool, botUID *gregor1.UID) (types.CryptKey, error) {
	if botUID != nil {
		return nil, fmt.Errorf("TeambotKeys not supported by KBFS")
	}
	if public {
		var zero [libkb.NaclDHKeySecretSize]byte
		return keybase1.CryptKey{
			KeyGeneration: 1,
			Key:           keybase1.Bytes32(zero),
		}, nil
	}
	allkeys, err := m.AllCryptKeys(ctx, tlfName, public)
	if err != nil {
		return nil, err
	}
	keys := allkeys[chat1.ConversationMembersType_KBFS]
	for _, key := range keys {
		if key.Generation() == keyGeneration {
			return key, nil
		}
	}
	return nil, errors.New("no mock key found")
}

func (m *TlfMock) EphemeralEncryptionKey(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID) (types.EphemeralCryptKey, error) {
	// Returns a totally zero teamEK. That's enough to get some very simple
	// round trip tests to pass.
	return keybase1.TeamEphemeralKey{}, nil
}

func (m *TlfMock) EphemeralDecryptionKey(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID,
	generation keybase1.EkGeneration, contentCtime *gregor1.Time) (types.EphemeralCryptKey, error) {
	// Returns a totally zero teamEK. That's enough to get some very simple
	// round trip tests to pass.
	return keybase1.TeamEphemeralKey{}, nil
}

func (m *TlfMock) ShouldPairwiseMAC(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error) {
	return false, nil, nil
}

func (m *TlfMock) CryptKeys(ctx context.Context, tlfName string) (res keybase1.GetTLFCryptKeysRes, err error) {
	res.NameIDBreaks.CanonicalName = CanonicalTlfNameForTest(tlfName)
	if res.NameIDBreaks.TlfID, err = m.getTlfID(res.NameIDBreaks.CanonicalName); err != nil {
		return keybase1.GetTLFCryptKeysRes{}, err
	}
	var ok bool
	if res.CryptKeys, ok = m.world.tlfKeys[res.NameIDBreaks.CanonicalName]; !ok {
		err = fmt.Errorf("CryptKeys for TLF %s not found", res.NameIDBreaks.CanonicalName)
		return res, err
	}
	return res, nil
}

func (m *TlfMock) CompleteAndCanonicalizePrivateTlfName(ctx context.Context, tlfName string) (keybase1.CanonicalTLFNameAndIDWithBreaks, error) {
	var res keybase1.CanonicalTLFNameAndIDWithBreaks
	res.CanonicalName = CanonicalTlfNameForTest(tlfName)
	var err error
	res.TlfID, err = m.getTlfID(res.CanonicalName)
	if err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}
	return res, nil
}

func (m *TlfMock) PublicCanonicalTLFNameAndID(ctx context.Context, tlfName string) (keybase1.CanonicalTLFNameAndIDWithBreaks, error) {
	res := keybase1.CanonicalTLFNameAndIDWithBreaks{
		CanonicalName: keybase1.CanonicalTlfName(tlfName),
		TlfID:         "abcdefg",
	}
	return res, nil
}

type ChatRemoteMock struct {
	world     *ChatMockWorld
	readMsgid map[string]chat1.MessageID
	uid       *gregor1.UID

	CacheBodiesVersion int
	CacheInboxVersion  int

	GetThreadRemoteFunc func(m *ChatRemoteMock, ctx context.Context, arg chat1.GetThreadRemoteArg) (chat1.GetThreadRemoteRes, error)
	SyncInboxFunc       func(m *ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error)
}

var _ chat1.RemoteInterface = (*ChatRemoteMock)(nil)

func NewChatRemoteMock(world *ChatMockWorld) (m *ChatRemoteMock) {
	m = &ChatRemoteMock{
		world:     world,
		readMsgid: make(map[string]chat1.MessageID),
	}
	return m
}

func (m *ChatRemoteMock) makeReaderInfo(convID chat1.ConversationID) (ri *chat1.ConversationReaderInfo) {
	ri = &chat1.ConversationReaderInfo{}
	ri.ReadMsgid = m.readMsgid[convID.String()]
	for _, m := range m.world.Msgs[convID.String()] {
		if m.ServerHeader.MessageID > ri.MaxMsgid {
			ri.MaxMsgid = m.ServerHeader.MessageID
			ri.Mtime = m.ServerHeader.Ctime
		}
	}
	return ri
}

func (m *ChatRemoteMock) SetCurrentUser(uid gregor1.UID) {
	m.uid = &uid
}

func (m *ChatRemoteMock) inConversation(conv *chat1.Conversation) bool {
	if m.uid != nil && len(conv.Metadata.ActiveList) > 0 {
		return conv.Includes(*m.uid)
	}
	return true
}

func (m *ChatRemoteMock) RemoteNotificationSuccessful(ctx context.Context, arg chat1.RemoteNotificationSuccessfulArg) error {
	return nil
}

func (m *ChatRemoteMock) GetInboxRemote(ctx context.Context, arg chat1.GetInboxRemoteArg) (res chat1.GetInboxRemoteRes, err error) {
	// TODO: add pagination support
	var ibfull chat1.InboxViewFull
	for _, conv := range m.world.conversations {
		if !m.inConversation(conv) {
			continue
		}
		if arg.Query != nil {
			if arg.Query.ConvID != nil {
				arg.Query.ConvIDs = append(arg.Query.ConvIDs, *arg.Query.ConvID)
			}
			if len(arg.Query.ConvIDs) > 0 {
				found := false
				for _, convID := range arg.Query.ConvIDs {
					if convID.Eq(conv.GetConvID()) {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			if arg.Query.ConvID != nil && !conv.Metadata.ConversationID.Eq(*arg.Query.ConvID) {
				continue
			}
			if arg.Query.TlfID != nil && !conv.Metadata.IdTriple.Tlfid.Eq(*arg.Query.TlfID) {
				continue
			}
			if arg.Query.TopicType != nil && conv.Metadata.IdTriple.TopicType != *arg.Query.TopicType {
				continue
			}
			if arg.Query.UnreadOnly && m.readMsgid[conv.Metadata.ConversationID.String()] == m.makeReaderInfo(conv.Metadata.ConversationID).MaxMsgid {
				continue
			}
			if arg.Query.ReadOnly && m.readMsgid[conv.Metadata.ConversationID.String()] != m.makeReaderInfo(conv.Metadata.ConversationID).MaxMsgid {
				continue
			}
			if arg.Query.TlfVisibility != nil && conv.Metadata.Visibility != *arg.Query.TlfVisibility {
				continue
			}
			if arg.Query.After != nil && m.makeReaderInfo(conv.Metadata.ConversationID).Mtime < *arg.Query.After {
				continue
			}
			if arg.Query.Before != nil && m.makeReaderInfo(conv.Metadata.ConversationID).Mtime > *arg.Query.Before {
				continue
			}
		}
		convToAppend := *conv
		convToAppend.ReaderInfo = m.makeReaderInfo(convToAppend.Metadata.ConversationID)
		convToAppend.Notifications = new(chat1.ConversationNotificationInfo)

		ibfull.Conversations = append(ibfull.Conversations, convToAppend)
		if arg.Pagination != nil && arg.Pagination.Num != 0 && arg.Pagination.Num == len(ibfull.Conversations) {
			break
		}
	}
	return chat1.GetInboxRemoteRes{
		Inbox: chat1.NewInboxViewWithFull(ibfull),
	}, nil
}

func (m *ChatRemoteMock) GetPublicConversations(ctx context.Context, arg chat1.GetPublicConversationsArg) (res chat1.GetPublicConversationsRes, err error) {

	for _, conv := range m.world.conversations {
		if conv.Metadata.Visibility == keybase1.TLFVisibility_PUBLIC &&
			conv.Metadata.IdTriple.Tlfid.Eq(arg.TlfID) &&
			conv.Metadata.IdTriple.TopicType == arg.TopicType {

			convToAppend := *conv
			convToAppend.ReaderInfo = m.makeReaderInfo(convToAppend.Metadata.ConversationID)
			res.Conversations = append(res.Conversations, convToAppend)

		}
	}

	return res, nil
}

func (m *ChatRemoteMock) GetInboxByTLFIDRemote(ctx context.Context, tlfID chat1.TLFID) (res chat1.GetInboxByTLFIDRemoteRes, err error) {
	for _, conv := range m.world.conversations {
		if tlfID.Eq(conv.Metadata.IdTriple.Tlfid) {
			convToAppend := *conv
			convToAppend.ReaderInfo = m.makeReaderInfo(convToAppend.Metadata.ConversationID)
			res.Convs = []chat1.Conversation{convToAppend}
			return res, nil
		}
	}
	return res, errors.New("conversation not found")
}

func (m *ChatRemoteMock) GetThreadRemote(ctx context.Context, arg chat1.GetThreadRemoteArg) (res chat1.GetThreadRemoteRes, err error) {
	if m.GetThreadRemoteFunc != nil {
		return m.GetThreadRemoteFunc(m, ctx, arg)
	}
	var mts map[chat1.MessageType]bool
	if arg.Query != nil && len(arg.Query.MessageTypes) > 0 {
		mts = make(map[chat1.MessageType]bool)
		for _, mt := range arg.Query.MessageTypes {
			mts[mt] = true
		}
	}

	// TODO: add *real* pagination support
	if arg.Pagination == nil {
		arg.Pagination = &chat1.Pagination{Num: 10000}
	}
	conv, err := m.GetConversationMetadataRemote(ctx, arg.ConversationID)
	if err != nil {
		return res, err
	}
	res.MembersType = conv.Conv.GetMembersType()
	res.Visibility = conv.Conv.Metadata.Visibility
	msgs := m.world.Msgs[arg.ConversationID.String()]
	count := 0
	for _, msg := range msgs {
		if arg.Query != nil {
			if arg.Query.After != nil && msg.ServerHeader.Ctime < *arg.Query.After {
				continue
			}
			if arg.Query.Before != nil && msg.ServerHeader.Ctime > *arg.Query.Before {
				continue
			}

		}
		res.Thread.Messages = append(res.Thread.Messages, *msg)
		if mts != nil && mts[msg.GetMessageType()] {
			count++
		} else if mts == nil {
			count++
		}
		if count >= arg.Pagination.Num {
			break
		}
	}
	if arg.Query != nil && arg.Query.MarkAsRead {
		m.readMsgid[arg.ConversationID.String()] = msgs[0].ServerHeader.MessageID
	}
	var pmsgs []pager.Message
	for _, m := range res.Thread.Messages {
		pmsgs = append(pmsgs, m)
	}
	res.Thread.Pagination, err = pager.NewThreadPager().MakePage(pmsgs, arg.Pagination.Num, 0)
	if err != nil {
		return res, err
	}
	return res, nil
}

func (m *ChatRemoteMock) GetUnreadlineRemote(ctx context.Context, arg chat1.GetUnreadlineRemoteArg) (res chat1.GetUnreadlineRemoteRes, err error) {
	return res, nil
}

func (m *ChatRemoteMock) GetConversationMetadataRemote(ctx context.Context, convID chat1.ConversationID) (res chat1.GetConversationMetadataRemoteRes, err error) {
	conv := m.world.GetConversationByID(convID)
	if conv == nil {
		err = errors.New("conversation not found")
		return res, err
	}
	res.Conv = *conv
	return res, err
}

func (m *ChatRemoteMock) headerToVerifiedForTesting(h chat1.MessageClientHeader) chat1.MessageClientHeaderVerified {
	return chat1.MessageClientHeaderVerified{
		Conv:         h.Conv,
		TlfName:      h.TlfName,
		TlfPublic:    h.TlfPublic,
		MessageType:  h.MessageType,
		Prev:         h.Prev,
		Sender:       h.Sender,
		SenderDevice: h.SenderDevice,
		OutboxID:     h.OutboxID,
		OutboxInfo:   h.OutboxInfo,
	}
}

func (m *ChatRemoteMock) promoteWriter(ctx context.Context, sender gregor1.UID, writers []gregor1.UID) []gregor1.UID {
	res := make([]gregor1.UID, len(writers))
	copy(res, writers)
	for index, w := range writers {
		if bytes.Equal(w.Bytes(), sender.Bytes()) {
			res = append(res[:index], res[index+1:]...)
			res = append([]gregor1.UID{sender}, res...)
			return res
		}
	}
	res = append([]gregor1.UID{sender}, res...)
	return res
}

func (m *ChatRemoteMock) createBogusBody(typ chat1.MessageType) chat1.MessageBody {
	return chat1.MessageBody{
		MessageType__:        typ,
		Text__:               &chat1.MessageText{},
		Edit__:               &chat1.MessageEdit{},
		Attachment__:         &chat1.MessageAttachment{},
		Delete__:             &chat1.MessageDelete{},
		Attachmentuploaded__: &chat1.MessageAttachmentUploaded{},
		Join__:               &chat1.MessageJoin{},
		Leave__:              &chat1.MessageLeave{},
		Headline__:           &chat1.MessageHeadline{},
		Metadata__:           &chat1.MessageConversationMetadata{},
		Reaction__:           &chat1.MessageReaction{},
	}
}

type dummyChannelSource struct{}

var _ types.TeamChannelSource = (*dummyChannelSource)(nil)

func (d dummyChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID, tlfID chat1.TLFID,
	topicType chat1.TopicType) ([]chat1.ConversationLocal, error) {
	return nil, nil
}

func (d dummyChannelSource) GetChannelsTopicName(ctx context.Context, uid gregor1.UID, tlfID chat1.TLFID,
	topicType chat1.TopicType) ([]chat1.ChannelNameMention, error) {
	return nil, nil
}

func (d dummyChannelSource) GetChannelTopicName(ctx context.Context, uid gregor1.UID, tlfID chat1.TLFID,
	topicType chat1.TopicType, convID chat1.ConversationID) (string, error) {
	return "", nil
}

func (m *ChatRemoteMock) PostRemote(ctx context.Context, arg chat1.PostRemoteArg) (res chat1.PostRemoteRes, err error) {
	uid := arg.MessageBoxed.ClientHeader.Sender
	conv := m.world.GetConversationByID(arg.ConversationID)
	ri := m.makeReaderInfo(conv.Metadata.ConversationID)
	inserted := m.insertMsgAndSort(arg.ConversationID, arg.MessageBoxed)
	m.world.T.Logf("PostRemote(convid:%v, msgid:%v, %v)",
		arg.ConversationID, inserted.ServerHeader.MessageID, arg.MessageBoxed.GetMessageType())
	if ri.ReadMsgid == ri.MaxMsgid {
		m.readMsgid[arg.ConversationID.String()] = inserted.ServerHeader.MessageID
	}
	conv.Metadata.ActiveList = m.promoteWriter(ctx, arg.MessageBoxed.ClientHeader.Sender,
		conv.Metadata.ActiveList)
	conv.MaxMsgs = m.getMaxMsgs(arg.ConversationID)
	conv.MaxMsgSummaries = nil
	for _, m := range conv.MaxMsgs {
		conv.MaxMsgSummaries = append(conv.MaxMsgSummaries, m.Summary())
	}
	conv.Metadata.Version++
	sort.Sort(convByNewlyUpdated{mock: m})
	res.MsgHeader = *inserted.ServerHeader
	res.RateLimit = &chat1.RateLimit{}

	// hit notify router with new message
	if m.world.TcsByID[uid.String()].ChatG.ActivityNotifier != nil {
		activity := chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
			Message: utils.PresentMessageUnboxed(ctx, m.world.TcsByID[uid.String()].Context(),
				chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
					ClientHeader: m.headerToVerifiedForTesting(inserted.ClientHeader),
					ServerHeader: *inserted.ServerHeader,
					MessageBody:  m.createBogusBody(inserted.GetMessageType()),
				}), uid, arg.ConversationID),
		})
		m.world.TcsByID[uid.String()].ChatG.ActivityNotifier.Activity(context.Background(),
			uid, conv.GetTopicType(), &activity, chat1.ChatActivitySource_REMOTE)
	}

	return
}

func (m *ChatRemoteMock) NewConversationRemote(ctx context.Context, arg chat1.ConversationIDTriple) (res chat1.NewConversationRemoteRes, err error) {
	return res, errors.New("not implemented anymore")
}

func (m *ChatRemoteMock) NewConversationRemote2(ctx context.Context, arg chat1.NewConversationRemote2Arg) (res chat1.NewConversationRemoteRes, err error) {
	for _, conv := range m.world.conversations {
		if conv.Metadata.IdTriple.Tlfid.Eq(arg.IdTriple.Tlfid) &&
			conv.Metadata.IdTriple.TopicID.String() == arg.IdTriple.TopicID.String() &&
			conv.Metadata.IdTriple.TopicType == arg.IdTriple.TopicType {
			// Identical triple
			return res, libkb.ChatConvExistsError{ConvID: conv.Metadata.ConversationID}
		}
		if arg.IdTriple.TopicType == chat1.TopicType_CHAT &&
			arg.MembersType != chat1.ConversationMembersType_TEAM &&
			conv.Metadata.IdTriple.Tlfid.Eq(arg.IdTriple.Tlfid) &&
			conv.Metadata.IdTriple.TopicType == arg.IdTriple.TopicType {
			// Existing CHAT conv
			return res, libkb.ChatConvExistsError{ConvID: conv.Metadata.ConversationID}
		}
	}

	res.ConvID = arg.IdTriple.ToConversationID([2]byte{0, 0})

	first := m.insertMsgAndSort(res.ConvID, arg.TLFMessage)
	vis := keybase1.TLFVisibility_PRIVATE
	if arg.TLFMessage.ClientHeader.TlfPublic {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	m.world.conversations = append(m.world.conversations, &chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			IdTriple:       arg.IdTriple,
			ConversationID: res.ConvID,
			Visibility:     vis,
			MembersType:    arg.MembersType,
			Version:        1,
		},
		MaxMsgs:         []chat1.MessageBoxed{first},
		MaxMsgSummaries: []chat1.MessageSummary{first.Summary()},
	})
	m.readMsgid[res.ConvID.String()] = first.ServerHeader.MessageID

	sort.Sort(convByNewlyUpdated{mock: m})
	return res, nil
}

func (m *ChatRemoteMock) GetMessagesRemote(ctx context.Context, arg chat1.GetMessagesRemoteArg) (res chat1.GetMessagesRemoteRes, err error) {
	msgs, ok := m.world.Msgs[arg.ConversationID.String()]
	if !ok {
		return res, errors.New("conversation not found")
	}
	ids := make(map[chat1.MessageID]bool)
	for _, id := range arg.MessageIDs {
		ids[id] = true
	}
	for _, msg := range msgs {
		id := msg.ServerHeader.MessageID
		if ids[id] {
			res.Msgs = append(res.Msgs, *msg)
			delete(ids, id)
		}
	}
	for id := range ids {
		return res, fmt.Errorf("message %d is not found", id)
	}
	return res, nil
}

func (m *ChatRemoteMock) MarkAsRead(ctx context.Context, arg chat1.MarkAsReadArg) (res chat1.MarkAsReadRes, err error) {
	conv := m.world.GetConversationByID(arg.ConversationID)
	if conv == nil {
		err = errors.New("conversation not found")
		return res, err
	}
	m.readMsgid[conv.Metadata.ConversationID.String()] = arg.MsgID
	return res, nil
}

func (m *ChatRemoteMock) SetConversationStatus(ctx context.Context, arg chat1.SetConversationStatusArg) (res chat1.SetConversationStatusRes, err error) {
	return chat1.SetConversationStatusRes{}, errors.New("not implemented")
}

func (m *ChatRemoteMock) SetAppNotificationSettings(ctx context.Context,
	arg chat1.SetAppNotificationSettingsArg) (res chat1.SetAppNotificationSettingsRes, err error) {
	return res, errors.New("not implemented")
}

func (m *ChatRemoteMock) RetentionSweepConv(ctx context.Context, convID chat1.ConversationID) (res chat1.SweepRes, err error) {
	return res, errors.New("not implemented")
}

func (m *ChatRemoteMock) UpgradeKBFSToImpteam(ctx context.Context, tlfID chat1.TLFID) error {
	return errors.New("not implemented")
}

func (m *ChatRemoteMock) SetGlobalAppNotificationSettings(ctx context.Context,
	arg chat1.GlobalAppNotificationSettings) error {
	return errors.New("not implemented")
}

func (m *ChatRemoteMock) GetGlobalAppNotificationSettings(ctx context.Context) (chat1.GlobalAppNotificationSettings, error) {
	return chat1.GlobalAppNotificationSettings{}, errors.New("not implemented")
}

func (m *ChatRemoteMock) TlfFinalize(ctx context.Context, arg chat1.TlfFinalizeArg) error {
	return nil
}

func (m *ChatRemoteMock) TlfResolve(ctx context.Context, arg chat1.TlfResolveArg) error {
	return nil
}

func (m *ChatRemoteMock) GetUnreadUpdateFull(ctx context.Context, inboxVers chat1.InboxVers) (chat1.UnreadUpdateFull, error) {
	return chat1.UnreadUpdateFull{}, errors.New("not implemented")
}

func (m *ChatRemoteMock) GetInboxVersion(ctx context.Context, uid gregor1.UID) (chat1.InboxVers, error) {
	return 1, nil
}

func (m *ChatRemoteMock) SyncInbox(ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
	if m.SyncInboxFunc == nil {
		return chat1.NewSyncInboxResWithClear(), nil
	}
	return m.SyncInboxFunc(m, ctx, vers)
}

func (m *ChatRemoteMock) SyncChat(ctx context.Context, arg chat1.SyncChatArg) (chat1.SyncChatRes, error) {
	if m.SyncInboxFunc == nil {
		return chat1.SyncChatRes{
			InboxRes: chat1.NewSyncInboxResWithClear(),
		}, nil
	}

	iboxRes, err := m.SyncInboxFunc(m, ctx, arg.Vers)
	if err != nil {
		return chat1.SyncChatRes{}, err
	}
	return chat1.SyncChatRes{
		InboxRes: iboxRes,
		CacheVers: chat1.ServerCacheVers{
			InboxVers:  m.CacheInboxVersion,
			BodiesVers: m.CacheBodiesVersion,
		},
	}, nil
}

func (m *ChatRemoteMock) SyncAll(ctx context.Context, arg chat1.SyncAllArg) (res chat1.SyncAllResult, err error) {
	cres, err := m.SyncChat(ctx, chat1.SyncChatArg{
		Vers:             arg.InboxVers,
		SummarizeMaxMsgs: arg.SummarizeMaxMsgs,
	})
	if err != nil {
		return res, err
	}
	return chat1.SyncAllResult{
		Chat: cres,
	}, nil
}

func (m *ChatRemoteMock) UpdateTypingRemote(ctx context.Context, arg chat1.UpdateTypingRemoteArg) error {
	return nil
}

func (m *ChatRemoteMock) GetTLFConversations(ctx context.Context, arg chat1.GetTLFConversationsArg) (chat1.GetTLFConversationsRes, error) {
	return chat1.GetTLFConversationsRes{}, nil
}

func (m *ChatRemoteMock) JoinConversation(ctx context.Context, convID chat1.ConversationID) (chat1.JoinLeaveConversationRemoteRes, error) {
	return chat1.JoinLeaveConversationRemoteRes{}, nil
}

func (m *ChatRemoteMock) LeaveConversation(ctx context.Context, convID chat1.ConversationID) (chat1.JoinLeaveConversationRemoteRes, error) {
	return chat1.JoinLeaveConversationRemoteRes{}, nil
}

func (m *ChatRemoteMock) PreviewConversation(ctx context.Context, convID chat1.ConversationID) (chat1.JoinLeaveConversationRemoteRes, error) {
	return chat1.JoinLeaveConversationRemoteRes{}, nil
}

func (m *ChatRemoteMock) DeleteConversation(ctx context.Context, convID chat1.ConversationID) (chat1.DeleteConversationRemoteRes, error) {
	return chat1.DeleteConversationRemoteRes{}, nil
}

func (m *ChatRemoteMock) GetMessageBefore(ctx context.Context, arg chat1.GetMessageBeforeArg) (chat1.GetMessageBeforeRes, error) {
	// Ignore age and get the latest message
	var latest chat1.MessageID
	for _, msg := range m.world.Msgs[arg.ConvID.String()] {
		if msg.ServerHeader.MessageID >= latest {
			latest = msg.ServerHeader.MessageID
		}
	}
	return chat1.GetMessageBeforeRes{MsgID: latest}, nil
}

type convByNewlyUpdated struct {
	mock *ChatRemoteMock
}

func (s convByNewlyUpdated) Len() int { return len(s.mock.world.conversations) }
func (s convByNewlyUpdated) Swap(i, j int) {
	s.mock.world.conversations[i], s.mock.world.conversations[j] = s.mock.world.conversations[j], s.mock.world.conversations[i]
}
func (s convByNewlyUpdated) Less(i, j int) bool {
	return s.mock.makeReaderInfo(s.mock.world.conversations[i].Metadata.ConversationID).Mtime > s.mock.makeReaderInfo(s.mock.world.conversations[j].Metadata.ConversationID).Mtime
}

type msgByMessageIDDesc struct {
	world  *ChatMockWorld
	convID chat1.ConversationID
}

func (s msgByMessageIDDesc) Len() int { return len(s.world.Msgs[s.convID.String()]) }
func (s msgByMessageIDDesc) Swap(i, j int) {
	s.world.Msgs[s.convID.String()][i], s.world.Msgs[s.convID.String()][j] =
		s.world.Msgs[s.convID.String()][j], s.world.Msgs[s.convID.String()][i]
}
func (s msgByMessageIDDesc) Less(i, j int) bool {
	return s.world.Msgs[s.convID.String()][i].ServerHeader.MessageID > s.world.Msgs[s.convID.String()][j].ServerHeader.MessageID
}

func (m *ChatRemoteMock) getMaxMsgs(convID chat1.ConversationID) (maxMsgs []chat1.MessageBoxed) {
	finder := make(map[chat1.MessageType]*chat1.MessageBoxed)
	for _, msg := range m.world.Msgs[convID.String()] {
		if existing, ok := finder[msg.GetMessageType()]; !ok || existing.GetMessageID() < msg.GetMessageID() {
			finder[msg.GetMessageType()] = msg
		}
	}

	for _, msg := range finder {
		maxMsgs = append(maxMsgs, *msg)
	}

	return maxMsgs
}

func (m *ChatRemoteMock) insertMsgAndSort(convID chat1.ConversationID, msg chat1.MessageBoxed) (inserted chat1.MessageBoxed) {
	msg.ServerHeader = &chat1.MessageServerHeader{
		Ctime:     gregor1.ToTime(m.world.Fc.Now()),
		Now:       gregor1.ToTime(m.world.Fc.Now()),
		MessageID: chat1.MessageID(len(m.world.Msgs[convID.String()]) + 1),
	}
	m.world.Msgs[convID.String()] = append(m.world.Msgs[convID.String()], &msg)
	sort.Sort(msgByMessageIDDesc{world: m.world, convID: convID})

	// If this message supersedes something, track it down and set supersededBy
	if msg.ClientHeader.Supersedes > 0 {
		for _, wmsg := range m.world.Msgs[convID.String()] {
			if wmsg.GetMessageID() == msg.ClientHeader.Supersedes {
				wmsg.ServerHeader.SupersededBy = msg.GetMessageID()
			}
		}
	}

	return msg
}

func (m *ChatRemoteMock) BroadcastGregorMessageToConv(ctx context.Context,
	arg chat1.BroadcastGregorMessageToConvArg) error {
	return nil
}

func (m *ChatRemoteMock) GetS3Params(context.Context, chat1.ConversationID) (chat1.S3Params, error) {
	return chat1.S3Params{}, errors.New("GetS3Params not mocked")
}

func (m *ChatRemoteMock) S3Sign(context.Context, chat1.S3SignArg) ([]byte, error) {
	return nil, errors.New("GetS3Params not mocked")
}

func (m *ChatRemoteMock) SetConvRetention(ctx context.Context, _ chat1.SetConvRetentionArg) (res chat1.SetRetentionRes, err error) {
	return res, errors.New("SetConvRetention not mocked")
}

func (m *ChatRemoteMock) SetTeamRetention(ctx context.Context, _ chat1.SetTeamRetentionArg) (res chat1.SetRetentionRes, err error) {
	return res, errors.New("SetTeamRetention not mocked")
}

func (m *ChatRemoteMock) SetConvMinWriterRole(ctx context.Context, _ chat1.SetConvMinWriterRoleArg) (res chat1.SetConvMinWriterRoleRes, err error) {
	return res, errors.New("SetConvMinWriterRole not mocked")
}

func (m *ChatRemoteMock) RegisterSharePost(ctx context.Context, _ chat1.RegisterSharePostArg) error {
	return errors.New("RegisterSharePost not mocked")
}

func (m *ChatRemoteMock) FailSharePost(ctx context.Context, _ chat1.FailSharePostArg) error {
	return errors.New("FailSharePost not mocked")
}

func (m *ChatRemoteMock) ServerNow(ctx context.Context) (res chat1.ServerNowRes, err error) {
	return res, errors.New("ServerNow not mocked")
}

func (m *ChatRemoteMock) GetExternalAPIKeys(ctx context.Context, typs []chat1.ExternalAPIKeyTyp) (res []chat1.ExternalAPIKey, err error) {
	return res, errors.New("GetExternalAPIKeys not mocked")
}

func (m *ChatRemoteMock) AdvertiseBotCommands(ctx context.Context, ads []chat1.RemoteBotCommandsAdvertisement) (res chat1.AdvertiseBotCommandsRes, err error) {
	return res, errors.New("AdvertiseBotCommands not mocked")
}

func (m *ChatRemoteMock) ClearBotCommands(ctx context.Context) (res chat1.ClearBotCommandsRes, err error) {
	return res, errors.New("ClearBotCommands not mocked")
}

func (m *ChatRemoteMock) GetBotInfo(ctx context.Context, arg chat1.GetBotInfoArg) (res chat1.GetBotInfoRes, err error) {
	return res, errors.New("GetBotInfo not mocked")
}

func (m *ChatRemoteMock) TeamIDOfConv(ctx context.Context, convID chat1.ConversationID) (res *keybase1.TeamID, err error) {
	return res, errors.New("TeamIDOfConv not mocked")
}

type NonblockInboxResult struct {
	ConvID   chat1.ConversationID
	Err      error
	ConvRes  *chat1.InboxUIItem
	InboxRes *chat1.UnverifiedInboxUIItems
}

type NonblockThreadResult struct {
	Thread *chat1.UIMessages
	Full   bool
}

type NonblockSearchResult struct {
	chat1.ChatSearchHitArg
}

type ChatUI struct {
	InboxCb               chan NonblockInboxResult
	ThreadCb              chan NonblockThreadResult
	ThreadStatusCb        chan chat1.UIChatThreadStatus
	SearchHitCb           chan chat1.ChatSearchHitArg
	SearchDoneCb          chan chat1.ChatSearchDoneArg
	InboxSearchHitCb      chan chat1.ChatSearchInboxHitArg
	InboxSearchDoneCb     chan chat1.ChatSearchInboxDoneArg
	InboxSearchConvHitsCb chan []chat1.UIChatSearchConvHit
	StellarShowConfirm    chan struct{}
	StellarDataConfirm    chan chat1.UIChatPaymentSummary
	StellarDataError      chan keybase1.Status
	StellarDone           chan struct{}
	ShowManageChannels    chan string
	GiphyResults          chan chat1.GiphySearchResults
	GiphyWindow           chan bool
	CoinFlipUpdates       chan []chat1.UICoinFlipStatus
	CommandMarkdown       chan *chat1.UICommandMarkdown
}

func NewChatUI() *ChatUI {
	return &ChatUI{
		InboxCb:               make(chan NonblockInboxResult, 50),
		ThreadCb:              make(chan NonblockThreadResult, 50),
		ThreadStatusCb:        make(chan chat1.UIChatThreadStatus, 50),
		SearchHitCb:           make(chan chat1.ChatSearchHitArg, 50),
		SearchDoneCb:          make(chan chat1.ChatSearchDoneArg, 50),
		InboxSearchHitCb:      make(chan chat1.ChatSearchInboxHitArg, 50),
		InboxSearchDoneCb:     make(chan chat1.ChatSearchInboxDoneArg, 50),
		InboxSearchConvHitsCb: make(chan []chat1.UIChatSearchConvHit, 50),
		StellarShowConfirm:    make(chan struct{}, 10),
		StellarDataConfirm:    make(chan chat1.UIChatPaymentSummary, 10),
		StellarDataError:      make(chan keybase1.Status, 10),
		StellarDone:           make(chan struct{}, 10),
		ShowManageChannels:    make(chan string, 10),
		GiphyResults:          make(chan chat1.GiphySearchResults, 10),
		GiphyWindow:           make(chan bool, 10),
		CoinFlipUpdates:       make(chan []chat1.UICoinFlipStatus, 100),
		CommandMarkdown:       make(chan *chat1.UICommandMarkdown, 10),
	}
}

func (c *ChatUI) ChatAttachmentDownloadStart(context.Context) error {
	return nil
}

func (c *ChatUI) ChatAttachmentDownloadProgress(ctx context.Context, arg chat1.ChatAttachmentDownloadProgressArg) error {
	return nil
}

func (c *ChatUI) ChatAttachmentDownloadDone(context.Context) error {
	return nil
}

func (c *ChatUI) ChatInboxConversation(ctx context.Context, arg chat1.ChatInboxConversationArg) error {
	var inboxItem chat1.InboxUIItem
	if err := json.Unmarshal([]byte(arg.Conv), &inboxItem); err != nil {
		return err
	}
	c.InboxCb <- NonblockInboxResult{
		ConvRes: &inboxItem,
		ConvID:  inboxItem.GetConvID(),
	}
	return nil
}

func (c *ChatUI) ChatInboxFailed(ctx context.Context, arg chat1.ChatInboxFailedArg) error {
	c.InboxCb <- NonblockInboxResult{
		Err: fmt.Errorf("%s", arg.Error.Message),
	}
	return nil
}

func (c *ChatUI) ChatInboxUnverified(ctx context.Context, arg chat1.ChatInboxUnverifiedArg) error {
	var inbox chat1.UnverifiedInboxUIItems
	if err := json.Unmarshal([]byte(arg.Inbox), &inbox); err != nil {
		return err
	}
	c.InboxCb <- NonblockInboxResult{
		InboxRes: &inbox,
	}
	return nil
}

func (c *ChatUI) ChatThreadCached(ctx context.Context, arg *string) error {
	var thread chat1.UIMessages
	if arg == nil {
		c.ThreadCb <- NonblockThreadResult{
			Thread: nil,
			Full:   false,
		}
	} else {
		if err := json.Unmarshal([]byte(*arg), &thread); err != nil {
			return err
		}
		c.ThreadCb <- NonblockThreadResult{
			Thread: &thread,
			Full:   false,
		}
	}
	return nil
}

func (c *ChatUI) ChatThreadFull(ctx context.Context, arg string) error {
	var thread chat1.UIMessages
	if err := json.Unmarshal([]byte(arg), &thread); err != nil {
		return err
	}
	c.ThreadCb <- NonblockThreadResult{
		Thread: &thread,
		Full:   true,
	}
	return nil
}

func (c *ChatUI) ChatThreadStatus(ctx context.Context, status chat1.UIChatThreadStatus) error {
	c.ThreadStatusCb <- status
	return nil
}

func (c *ChatUI) ChatConfirmChannelDelete(ctx context.Context, arg chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	return true, nil
}

func (c *ChatUI) ChatSearchHit(ctx context.Context, arg chat1.ChatSearchHitArg) error {
	c.SearchHitCb <- arg
	return nil
}

func (c *ChatUI) ChatSearchDone(ctx context.Context, arg chat1.ChatSearchDoneArg) error {
	c.SearchDoneCb <- arg
	return nil
}

func (c *ChatUI) ChatSearchInboxHit(ctx context.Context, arg chat1.ChatSearchInboxHitArg) error {
	c.InboxSearchHitCb <- arg
	return nil
}

func (c *ChatUI) ChatSearchConvHits(ctx context.Context, hits chat1.UIChatSearchConvHits) error {
	c.InboxSearchConvHitsCb <- hits.Hits
	return nil
}

func (c *ChatUI) ChatSearchInboxStart(ctx context.Context) error {
	return nil
}

func (c *ChatUI) ChatSearchInboxDone(ctx context.Context, arg chat1.ChatSearchInboxDoneArg) error {
	c.InboxSearchDoneCb <- arg
	return nil
}

func (c *ChatUI) ChatSearchIndexStatus(ctx context.Context, arg chat1.ChatSearchIndexStatusArg) error {
	return nil
}

func (c *ChatUI) ChatStellarShowConfirm(ctx context.Context) error {
	c.StellarShowConfirm <- struct{}{}
	return nil
}

func (c *ChatUI) ChatStellarDataConfirm(ctx context.Context, summary chat1.UIChatPaymentSummary) (bool, error) {
	c.StellarDataConfirm <- summary
	return true, nil
}

func (c *ChatUI) ChatStellarDataError(ctx context.Context, err keybase1.Status) (bool, error) {
	c.StellarDataError <- err
	return false, nil
}

func (c *ChatUI) ChatStellarDone(ctx context.Context, canceled bool) error {
	c.StellarDone <- struct{}{}
	return nil
}

func (c *ChatUI) ChatShowManageChannels(ctx context.Context, teamname string) error {
	c.ShowManageChannels <- teamname
	return nil
}

func (c *ChatUI) ChatGiphySearchResults(ctx context.Context, convID chat1.ConversationID,
	results chat1.GiphySearchResults) error {
	c.GiphyResults <- results
	return nil
}

func (c *ChatUI) ChatGiphyToggleResultWindow(ctx context.Context,
	convID chat1.ConversationID, show, clearInput bool) error {
	c.GiphyWindow <- show
	return nil
}

func (c *ChatUI) ChatCoinFlipStatus(ctx context.Context, updates []chat1.UICoinFlipStatus) error {
	c.CoinFlipUpdates <- updates
	return nil
}

func (c *ChatUI) ChatCommandMarkdown(ctx context.Context, convID chat1.ConversationID,
	md *chat1.UICommandMarkdown) error {
	c.CommandMarkdown <- md
	return nil
}

func (c *ChatUI) ChatMaybeMentionUpdate(ctx context.Context, teamName, channel string,
	info chat1.UIMaybeMentionInfo) error {
	return nil
}

func (c *ChatUI) ChatLoadGalleryHit(ctx context.Context, msg chat1.UIMessage) error {
	return nil
}

func (c *ChatUI) ChatWatchPosition(context.Context, chat1.ConversationID) (chat1.LocationWatchID, error) {
	return chat1.LocationWatchID(0), nil
}

func (c *ChatUI) ChatClearWatch(context.Context, chat1.LocationWatchID) error {
	return nil
}

func (c *ChatUI) ChatCommandStatus(context.Context, chat1.ConversationID, string,
	chat1.UICommandStatusDisplayTyp, []chat1.UICommandStatusActionTyp) error {
	return nil
}

func (c *ChatUI) ChatBotCommandsUpdateStatus(context.Context, chat1.ConversationID,
	chat1.UIBotCommandsUpdateStatus) error {
	return nil
}

type DummyAssetDeleter struct{}

func NewDummyAssetDeleter() DummyAssetDeleter {
	return DummyAssetDeleter{}
}

// DeleteAssets implements github.com/keybase/go/chat/storage/storage.AssetDeleter interface.
func (d DummyAssetDeleter) DeleteAssets(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, assets []chat1.Asset) {
}

func MockSentMessages(g *libkb.GlobalContext, t libkb.TestingTB) []MockMessage {
	if g.ChatHelper == nil {
		t.Fatal("ChatHelper is nil")
	}
	mch, ok := g.ChatHelper.(*MockChatHelper)
	if !ok {
		t.Fatalf("ChatHelper isn't a mock: %T", g.ChatHelper)
	}
	return mch.SentMessages
}

// MockMessage only supports what we're currently testing (system message for git push).
type MockMessage struct {
	name        string
	topicName   *string
	membersType chat1.ConversationMembersType
	ident       keybase1.TLFIdentifyBehavior
	Body        chat1.MessageBody
	MsgType     chat1.MessageType
}

type MockChatHelper struct {
	SentMessages []MockMessage
	convs        map[string]chat1.ConversationLocal
}

var _ libkb.ChatHelper = (*MockChatHelper)(nil)

func NewMockChatHelper() *MockChatHelper {
	return &MockChatHelper{
		convs: make(map[string]chat1.ConversationLocal),
	}
}

func (m *MockChatHelper) SendTextByID(ctx context.Context, convID chat1.ConversationID,
	tlfName string, text string, vis keybase1.TLFVisibility) error {
	return nil
}
func (m *MockChatHelper) SendMsgByID(ctx context.Context, convID chat1.ConversationID,
	tlfName string, body chat1.MessageBody, msgType chat1.MessageType, vis keybase1.TLFVisibility) error {
	return nil
}
func (m *MockChatHelper) SendTextByIDNonblock(ctx context.Context, convID chat1.ConversationID,
	tlfName string, text string, outboxID *chat1.OutboxID, replyTo *chat1.MessageID) (chat1.OutboxID, error) {
	return chat1.OutboxID{}, nil
}
func (m *MockChatHelper) SendMsgByIDNonblock(ctx context.Context, convID chat1.ConversationID,
	tlfName string, body chat1.MessageBody, msgType chat1.MessageType, inOutboxID *chat1.OutboxID,
	replyTo *chat1.MessageID) (chat1.OutboxID, error) {
	return chat1.OutboxID{}, nil
}
func (m *MockChatHelper) SendTextByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error {
	rb, err := libkb.RandBytes(10)
	if err != nil {
		return err
	}
	// use this to fake making channels...
	_, ok := m.convs[m.convKey(name, topicName)]
	if !ok {
		m.convs[m.convKey(name, topicName)] = chat1.ConversationLocal{
			Info: chat1.ConversationInfoLocal{
				Id:        rb,
				TopicName: *topicName,
			},
		}
	}

	return nil
}
func (m *MockChatHelper) SendMsgByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType) error {
	m.SentMessages = append(m.SentMessages, MockMessage{
		name:        name,
		topicName:   topicName,
		membersType: membersType,
		ident:       ident,
		Body:        body,
		MsgType:     msgType,
	})
	return nil
}
func (m *MockChatHelper) SendTextByNameNonblock(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string, outboxID *chat1.OutboxID) (chat1.OutboxID, error) {
	return chat1.OutboxID{}, nil
}
func (m *MockChatHelper) SendMsgByNameNonblock(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType, outboxID *chat1.OutboxID) (chat1.OutboxID, error) {
	m.SentMessages = append(m.SentMessages, MockMessage{
		name:        name,
		topicName:   topicName,
		membersType: membersType,
		ident:       ident,
		Body:        body,
		MsgType:     msgType,
	})
	return chat1.OutboxID{}, nil
}

func (m *MockChatHelper) DeleteMsg(ctx context.Context, convID chat1.ConversationID, tlfName string,
	msgID chat1.MessageID) error {
	return nil
}

func (m *MockChatHelper) DeleteMsgNonblock(ctx context.Context, convID chat1.ConversationID, tlfName string,
	msgID chat1.MessageID) error {
	return nil
}

func (m *MockChatHelper) FindConversations(ctx context.Context, name string,
	topicName *string, topicType chat1.TopicType,
	membersType chat1.ConversationMembersType, vis keybase1.TLFVisibility) ([]chat1.ConversationLocal, error) {

	conv, ok := m.convs[m.convKey(name, topicName)]
	if ok {
		return []chat1.ConversationLocal{conv}, nil
	}

	return nil, nil
}

func (m *MockChatHelper) FindConversationsByID(ctx context.Context, convIDs []chat1.ConversationID) (convs []chat1.ConversationLocal, err error) {
	for _, id := range convIDs {
		for _, v := range m.convs {
			if bytes.Equal(v.Info.Id, id) {
				convs = append(convs, v)
			}
		}
	}
	return convs, nil
}

func (m *MockChatHelper) GetChannelTopicName(ctx context.Context, teamID keybase1.TeamID,
	topicType chat1.TopicType, convID chat1.ConversationID) (string, error) {
	for _, v := range m.convs {
		if v.Info.Id.Eq(convID) {
			return v.Info.TopicName, nil
		}
	}
	return "", fmt.Errorf("MockChatHelper.GetChannelTopicName conv not found %v", convID)
}

func (m *MockChatHelper) UpgradeKBFSToImpteam(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	public bool) error {
	return nil
}

func (m *MockChatHelper) GetMessages(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgIDs []chat1.MessageID, resolveSupersedes bool, reason *chat1.GetThreadReason) ([]chat1.MessageUnboxed, error) {
	return nil, nil
}

func (m *MockChatHelper) GetMessage(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, resolveSupersedes bool, reason *chat1.GetThreadReason) (chat1.MessageUnboxed, error) {
	return chat1.MessageUnboxed{}, nil
}

func (m *MockChatHelper) UserReacjis(ctx context.Context, uid gregor1.UID) keybase1.UserReacjis {
	return keybase1.UserReacjis{}
}

func (m *MockChatHelper) NewConversation(ctx context.Context, uid gregor1.UID, tlfName string,
	topicName *string, topicType chat1.TopicType, membersType chat1.ConversationMembersType,
	vis keybase1.TLFVisibility) (chat1.ConversationLocal, error) {
	return chat1.ConversationLocal{}, nil
}

func (m *MockChatHelper) NewConversationSkipFindExisting(ctx context.Context, uid gregor1.UID, tlfName string,
	topicName *string, topicType chat1.TopicType, membersType chat1.ConversationMembersType,
	vis keybase1.TLFVisibility) (chat1.ConversationLocal, error) {
	return chat1.ConversationLocal{}, nil
}

func (m *MockChatHelper) NewConversationWithMemberSourceConv(ctx context.Context, uid gregor1.UID, tlfName string,
	topicName *string, topicType chat1.TopicType, membersType chat1.ConversationMembersType,
	vis keybase1.TLFVisibility, memberSourceConv *chat1.ConversationID) (chat1.ConversationLocal, error) {
	return chat1.ConversationLocal{}, nil
}

func (m *MockChatHelper) JoinConversationByID(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) error {
	return nil
}

func (m *MockChatHelper) JoinConversationByName(ctx context.Context, uid gregor1.UID, tlfName,
	topicName string, topicType chat1.TopicType, vid keybase1.TLFVisibility) error {
	return nil
}

func (m *MockChatHelper) LeaveConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error {
	return nil
}

func (m *MockChatHelper) convKey(name string, topicName *string) string {
	if topicName == nil {
		return name + ":general"
	}
	return name + ":" + *topicName
}

type MockUIRouter struct {
	libkb.UIRouter
	ui libkb.ChatUI
}

func NewMockUIRouter(chatUI libkb.ChatUI) *MockUIRouter {
	return &MockUIRouter{
		ui: chatUI,
	}
}

func (f *MockUIRouter) GetChatUI() (libkb.ChatUI, error) {
	return f.ui, nil
}

func (f *MockUIRouter) Shutdown() {}
