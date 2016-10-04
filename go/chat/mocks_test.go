package chat

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
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type ChatMockWorld struct {
	Fc clockwork.FakeClock

	Tcs     map[string]*libkb.TestContext
	Users   map[string]*kbtest.FakeUser
	tlfs    map[keybase1.CanonicalTlfName]chat1.TLFID
	tlfKeys map[keybase1.CanonicalTlfName][]keybase1.CryptKey

	// should always be sorted by newly updated conversation first
	conversations []*chat1.Conversation

	// each slice should always be sorted by message ID in desc, i.e. newest messages first
	Msgs map[chat1.ConversationID][]*chat1.MessageBoxed
}

func NewChatMockWorld(t *testing.T, name string, numUsers int) (world *ChatMockWorld) {
	world = &ChatMockWorld{
		Fc:      clockwork.NewFakeClockAt(time.Now()),
		Tcs:     make(map[string]*libkb.TestContext),
		Users:   make(map[string]*kbtest.FakeUser),
		tlfs:    make(map[keybase1.CanonicalTlfName]chat1.TLFID),
		tlfKeys: make(map[keybase1.CanonicalTlfName][]keybase1.CryptKey),
		Msgs:    make(map[chat1.ConversationID][]*chat1.MessageBoxed),
	}
	for i := 0; i < numUsers; i++ {
		tc := externals.SetupTest(t, "chat_"+name, 0)
		tc.G.SetClock(world.Fc)
		u, err := kbtest.CreateAndSignupFakeUser("chat", tc.G)
		if err != nil {
			t.Fatal(err)
		}
		world.Users[u.Username] = u
		world.Tcs[u.Username] = &tc
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

func (m TlfMock) CryptKeys(ctx context.Context, tlfName string) (res keybase1.TLFCryptKeys, err error) {
	res.CanonicalName = CanonicalTlfNameForTest(tlfName)
	tlfID, ok := m.world.tlfs[res.CanonicalName]
	if !ok {
		for _, n := range strings.Split(string(res.CanonicalName), ",") {
			if m.world.Users[n] == nil {
				err = fmt.Errorf("user %s not found", n)
				return keybase1.TLFCryptKeys{}, err
			}
		}
		tlfID = mustGetRandBytesWithControlledFirstByte(16, byte(len(m.world.tlfs)+1))
		m.world.tlfs[res.CanonicalName] = tlfID
		m.world.tlfKeys[res.CanonicalName] = mustGetRandCryptKeys(byte(len(m.world.tlfKeys) + 1))
	}
	res.TlfID = keybase1.TLFID(hex.EncodeToString([]byte(tlfID)))
	if res.CryptKeys, ok = m.world.tlfKeys[res.CanonicalName]; !ok {
		err = fmt.Errorf("CryptKeys for TLF %s not found", res.CanonicalName)
		return res, err
	}
	return res, nil
}

// Not used by service tests
func (m TlfMock) CompleteAndCanonicalizeTlfName(ctx context.Context, tlfName string) (res keybase1.CanonicalTlfName, err error) {
	return keybase1.CanonicalTlfName(""), errors.New("unimplemented")
}

func (m TlfMock) PublicCanonicalTLFNameAndID(ctx context.Context, tlfName string) (keybase1.CanonicalTLFNameAndID, error) {
	res := keybase1.CanonicalTLFNameAndID{
		CanonicalName: keybase1.CanonicalTlfName(tlfName),
		TlfID:         "abcdefg",
	}
	return res, nil
}

type ChatRemoteMock struct {
	world     *ChatMockWorld
	readMsgid map[chat1.ConversationID]chat1.MessageID
}

var _ chat1.RemoteInterface = (*ChatRemoteMock)(nil)

func NewChatRemoteMock(world *ChatMockWorld) (m *ChatRemoteMock) {
	m = &ChatRemoteMock{
		world:     world,
		readMsgid: make(map[chat1.ConversationID]chat1.MessageID),
	}
	return m
}

func (m *ChatRemoteMock) makeReaderInfo(convID chat1.ConversationID) (ri *chat1.ConversationReaderInfo) {
	ri = &chat1.ConversationReaderInfo{}
	ri.ReadMsgid = m.readMsgid[convID]
	for _, m := range m.world.Msgs[convID] {
		if m.ServerHeader.MessageID > ri.MaxMsgid {
			ri.MaxMsgid = m.ServerHeader.MessageID
			ri.Mtime = m.ServerHeader.Ctime
		}
	}
	return ri
}

func (m *ChatRemoteMock) GetInboxRemote(ctx context.Context, arg chat1.GetInboxRemoteArg) (res chat1.GetInboxRemoteRes, err error) {
	// TODO: add pagination support
	for _, conv := range m.world.conversations {
		if arg.Query != nil {
			if arg.Query.ConvID != nil && conv.Metadata.ConversationID != *arg.Query.ConvID {
				continue
			}
			if arg.Query.TlfID != nil && !conv.Metadata.IdTriple.Tlfid.Eq(*arg.Query.TlfID) {
				continue
			}
			if arg.Query.TopicType != nil && conv.Metadata.IdTriple.TopicType != *arg.Query.TopicType {
				continue
			}
			if arg.Query.UnreadOnly && m.readMsgid[conv.Metadata.ConversationID] == m.makeReaderInfo(conv.Metadata.ConversationID).MaxMsgid {
				continue
			}
			if arg.Query.ReadOnly && m.readMsgid[conv.Metadata.ConversationID] != m.makeReaderInfo(conv.Metadata.ConversationID).MaxMsgid {
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
		res.Inbox.Conversations = append(res.Inbox.Conversations, convToAppend)
		if arg.Pagination != nil && arg.Pagination.Num != 0 && arg.Pagination.Num == len(res.Inbox.Conversations) {
			break
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
	var mts map[chat1.MessageType]bool
	if arg.Query != nil && len(arg.Query.MessageTypes) > 0 {
		mts = make(map[chat1.MessageType]bool)
		for _, mt := range arg.Query.MessageTypes {
			mts[mt] = true
		}
	}

	// TODO: add pagination support
	msgs := m.world.Msgs[arg.ConversationID]
	for _, msg := range msgs {
		if arg.Query != nil {
			if arg.Query.After != nil && msg.ServerHeader.Ctime < *arg.Query.After {
				continue
			}
			if arg.Query.Before != nil && msg.ServerHeader.Ctime > *arg.Query.Before {
				continue
			}
			if mts != nil && !mts[msg.ServerHeader.MessageType] {
				continue
			}
		}
		res.Thread.Messages = append(res.Thread.Messages, *msg)
	}
	if arg.Query != nil && arg.Query.MarkAsRead {
		m.readMsgid[arg.ConversationID] = msgs[0].ServerHeader.MessageID
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
	conv := m.world.GetConversationByID(arg.ConversationID)
	ri := m.makeReaderInfo(conv.Metadata.ConversationID)
	inserted := m.insertMsgAndSort(arg.ConversationID, arg.MessageBoxed)
	if ri.ReadMsgid == ri.MaxMsgid {
		m.readMsgid[arg.ConversationID] = inserted.ServerHeader.MessageID
	}
	conv.MaxMsgs = m.getMaxMsgs(arg.ConversationID)
	sort.Sort(convByNewlyUpdated{mock: m})
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
			return res, libkb.ChatConvExistsError{ConvID: conv.Metadata.ConversationID}
		}
	}
	res.ConvID = chat1.ConversationID(len(m.world.conversations) + 1) // TODO: compute this when we need it
	first := m.insertMsgAndSort(res.ConvID, arg.TLFMessage)
	m.world.conversations = append(m.world.conversations, &chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			IdTriple:       arg.IdTriple,
			ConversationID: res.ConvID,
		},
		MaxMsgs: []chat1.MessageBoxed{first},
	})
	m.readMsgid[res.ConvID] = first.ServerHeader.MessageID

	sort.Sort(convByNewlyUpdated{mock: m})
	return res, nil
}

func (m *ChatRemoteMock) GetMessagesRemote(ctx context.Context, arg chat1.GetMessagesRemoteArg) (res chat1.GetMessagesRemoteRes, err error) {
	msgs, ok := m.world.Msgs[arg.ConversationID]
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
	m.readMsgid[conv.Metadata.ConversationID] = arg.MsgID
	return res, nil
}

func (m *ChatRemoteMock) TlfFinalize(ctx context.Context, tlfID chat1.TLFID) error {
	return nil
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

func (s msgByMessageIDDesc) Len() int { return len(s.world.Msgs[s.convID]) }
func (s msgByMessageIDDesc) Swap(i, j int) {
	s.world.Msgs[s.convID][i], s.world.Msgs[s.convID][j] = s.world.Msgs[s.convID][j], s.world.Msgs[s.convID][i]
}
func (s msgByMessageIDDesc) Less(i, j int) bool {
	return s.world.Msgs[s.convID][i].ServerHeader.MessageID > s.world.Msgs[s.convID][j].ServerHeader.MessageID
}

func (m *ChatRemoteMock) getMaxMsgs(convID chat1.ConversationID) (maxMsgs []chat1.MessageBoxed) {
	finder := make(map[chat1.MessageType]*chat1.MessageBoxed)
	for _, msg := range m.world.Msgs[convID] {
		if existing, ok := finder[msg.ServerHeader.MessageType]; !ok || existing.ServerHeader.MessageID < msg.ServerHeader.MessageID {
			finder[msg.ServerHeader.MessageType] = msg
		}
	}

	for _, msg := range finder {
		maxMsgs = append(maxMsgs, *msg)
	}

	return maxMsgs
}

func (m *ChatRemoteMock) insertMsgAndSort(convID chat1.ConversationID, msg chat1.MessageBoxed) (inserted chat1.MessageBoxed) {
	msg.ServerHeader = &chat1.MessageServerHeader{
		Ctime:        gregor1.ToTime(m.world.Fc.Now()),
		MessageID:    chat1.MessageID(len(m.world.Msgs[convID]) + 1),
		MessageType:  msg.ClientHeader.MessageType,
		Sender:       msg.ClientHeader.Sender,
		SenderDevice: msg.ClientHeader.SenderDevice,
	}
	m.world.Msgs[convID] = append(m.world.Msgs[convID], &msg)
	sort.Sort(msgByMessageIDDesc{world: m.world, convID: convID})
	return msg
}
