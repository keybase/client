package kbtest

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jonboulle/clockwork"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type ChatMockWorld struct {
	Fc clockwork.FakeClock

	Tcs     map[string]*libkb.TestContext
	TcsByID map[string]*libkb.TestContext
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
		Fc:      clockwork.NewFakeClockAt(time.Now()),
		Tcs:     make(map[string]*libkb.TestContext),
		TcsByID: make(map[string]*libkb.TestContext),
		Users:   make(map[string]*FakeUser),
		tlfs:    make(map[keybase1.CanonicalTlfName]chat1.TLFID),
		tlfKeys: make(map[keybase1.CanonicalTlfName][]keybase1.CryptKey),
		Msgs:    make(map[string][]*chat1.MessageBoxed),
	}
	for i := 0; i < numUsers; i++ {
		tc := externals.SetupTest(t, "chat_"+name, 0)
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

func mustDecodeHex(h string) (b []byte) {
	var err error
	if b, err = hex.DecodeString(h); err != nil {
		panic(err)
	}
	return b
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
	world *ChatMockWorld
}

var _ keybase1.TlfInterface = TlfMock{}

func NewTlfMock(world *ChatMockWorld) TlfMock {
	return TlfMock{world}
}

func CanonicalTlfNameForTest(tlfName string) keybase1.CanonicalTlfName {
	// very much simplified canonicalization.
	// TODO: implement rest when we need it
	names := strings.Split(tlfName, ",")
	sort.Strings(names)
	return keybase1.CanonicalTlfName(strings.Join(names, ","))
}

func (m TlfMock) getTlfID(cname keybase1.CanonicalTlfName) (keybase1.TLFID, error) {
	tlfID, ok := m.world.tlfs[cname]
	if !ok {
		for _, n := range strings.Split(string(cname), ",") {
			if m.world.Users[n] == nil {
				return "", fmt.Errorf("user %s not found", n)
			}
		}
		tlfID = mustGetRandBytesWithControlledFirstByte(16, byte(len(m.world.tlfs)+1))
		m.world.tlfs[cname] = tlfID
		m.world.tlfKeys[cname] = mustGetRandCryptKeys(byte(len(m.world.tlfKeys) + 1))
	}
	return keybase1.TLFID(hex.EncodeToString([]byte(tlfID))), nil
}

func (m TlfMock) CryptKeys(ctx context.Context, arg keybase1.TLFQuery) (res keybase1.GetTLFCryptKeysRes, err error) {
	res.NameIDBreaks.CanonicalName = CanonicalTlfNameForTest(arg.TlfName)
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

// Not used by service tests
func (m TlfMock) CompleteAndCanonicalizePrivateTlfName(ctx context.Context, arg keybase1.TLFQuery) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
	return keybase1.CanonicalTLFNameAndIDWithBreaks{}, errors.New("unimplemented")
}

func (m TlfMock) PublicCanonicalTLFNameAndID(ctx context.Context, arg keybase1.TLFQuery) (keybase1.CanonicalTLFNameAndIDWithBreaks, error) {
	res := keybase1.CanonicalTLFNameAndIDWithBreaks{
		CanonicalName: keybase1.CanonicalTlfName(arg.TlfName),
		TlfID:         "abcdefg",
	}
	return res, nil
}

type ChatRemoteMock struct {
	world     *ChatMockWorld
	readMsgid map[string]chat1.MessageID
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

func (m *ChatRemoteMock) GetInboxRemote(ctx context.Context, arg chat1.GetInboxRemoteArg) (res chat1.GetInboxRemoteRes, err error) {
	// TODO: add pagination support
	var ibfull chat1.InboxViewFull
	for _, conv := range m.world.conversations {
		if arg.Query != nil {
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
			// TODO: check arg.Query.TlfVisibility
			if arg.Query.After != nil && m.makeReaderInfo(conv.Metadata.ConversationID).Mtime < *arg.Query.After {
				continue
			}
			if arg.Query.Before != nil && m.makeReaderInfo(conv.Metadata.ConversationID).Mtime > *arg.Query.Before {
				continue
			}
		}
		convToAppend := *conv
		convToAppend.ReaderInfo = m.makeReaderInfo(convToAppend.Metadata.ConversationID)

		ibfull.Conversations = append(ibfull.Conversations, convToAppend)
		if arg.Pagination != nil && arg.Pagination.Num != 0 && arg.Pagination.Num == len(ibfull.Conversations) {
			break
		}
	}
	return chat1.GetInboxRemoteRes{
		Inbox: chat1.NewInboxViewWithFull(ibfull),
	}, nil
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

func (m *ChatRemoteMock) PostRemote(ctx context.Context, arg chat1.PostRemoteArg) (res chat1.PostRemoteRes, err error) {
	uid := arg.MessageBoxed.ClientHeader.Sender
	conv := m.world.GetConversationByID(arg.ConversationID)
	ri := m.makeReaderInfo(conv.Metadata.ConversationID)
	inserted := m.insertMsgAndSort(arg.ConversationID, arg.MessageBoxed)
	if ri.ReadMsgid == ri.MaxMsgid {
		m.readMsgid[arg.ConversationID.String()] = inserted.ServerHeader.MessageID
	}
	conv.MaxMsgs = m.getMaxMsgs(arg.ConversationID)
	sort.Sort(convByNewlyUpdated{mock: m})
	res.MsgHeader = *inserted.ServerHeader
	res.RateLimit = &chat1.RateLimit{}

	// hit notify router with new message
	if m.world.TcsByID[uid.String()].G.NotifyRouter != nil {
		activity := chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
			Message: chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
				ClientHeader: inserted.ClientHeader,
				ServerHeader: *inserted.ServerHeader,
			}),
		})
		m.world.TcsByID[uid.String()].G.NotifyRouter.HandleNewChatActivity(context.Background(),
			keybase1.UID(uid.String()), &activity)
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
			conv.Metadata.IdTriple.Tlfid.Eq(arg.IdTriple.Tlfid) &&
			conv.Metadata.IdTriple.TopicType == arg.IdTriple.TopicType {
			// Existing CHAT conv
			return res, libkb.ChatConvExistsError{ConvID: conv.Metadata.ConversationID}
		}
	}

	res.ConvID = arg.IdTriple.ToConversationID([2]byte{0, 0})

	first := m.insertMsgAndSort(res.ConvID, arg.TLFMessage)
	m.world.conversations = append(m.world.conversations, &chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			IdTriple:       arg.IdTriple,
			ConversationID: res.ConvID,
		},
		MaxMsgs: []chat1.MessageBoxed{first},
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

func (m *ChatRemoteMock) TlfFinalize(ctx context.Context, tlfID chat1.TLFID) error {
	return nil
}

func (m *ChatRemoteMock) GetUnreadUpdateFull(ctx context.Context, inboxVers chat1.InboxVers) (chat1.UnreadUpdateFull, error) {
	return chat1.UnreadUpdateFull{}, errors.New("not implemented")
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
		MessageID: chat1.MessageID(len(m.world.Msgs[convID.String()]) + 1),
	}
	m.world.Msgs[convID.String()] = append(m.world.Msgs[convID.String()], &msg)
	sort.Sort(msgByMessageIDDesc{world: m.world, convID: convID})
	return msg
}

func (m *ChatRemoteMock) GetS3Params(context.Context, chat1.ConversationID) (chat1.S3Params, error) {
	return chat1.S3Params{}, errors.New("GetS3Params not mocked")
}

func (m *ChatRemoteMock) S3Sign(context.Context, chat1.S3SignArg) ([]byte, error) {
	return nil, errors.New("GetS3Params not mocked")
}
