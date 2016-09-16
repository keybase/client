// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type chatMockWorld struct {
	me *kbtest.FakeUser

	users   map[string]gregor1.UID
	tlfs    map[keybase1.CanonicalTlfName]chat1.TLFID
	tlfKeys map[keybase1.CanonicalTlfName][]keybase1.CryptKey
}

func newChatMockWorld(user *kbtest.FakeUser) (world *chatMockWorld) {
	world = &chatMockWorld{me: user}

	others := []string{"t_alice", "t_bob", "t_charlie", "t_doug"}

	world.users = map[string]gregor1.UID{
		"t_alice":   gregor1.UID(mustDecodeHex("295a7eea607af32040647123732bc819")),
		"t_bob":     gregor1.UID(mustDecodeHex("afb5eda3154bc13c1df0189ce93ba119")),
		"t_charlie": gregor1.UID(mustDecodeHex("9d56bd0c02ac2711e142faf484ea9519")),
		"t_doug":    gregor1.UID(mustDecodeHex("c4c565570e7e87cafd077509abf5f619")),
	}
	world.users[user.Username] = gregor1.UID(user.User.GetUID().ToBytes())

	world.tlfs = make(map[keybase1.CanonicalTlfName]chat1.TLFID)
	for i := 0; i < len(others); i++ { // 2-person conversations
		tlfName := canonicalTlfNameForTest(user.Username + "," + others[i])
		world.tlfs[tlfName] = mustGetRandBytesWithControlledFirstByte(16, byte(len(world.tlfs)+1))
	}
	for i := 1; i < len(others); i++ { // 3-person conversations
		tlfName := canonicalTlfNameForTest(user.Username + "," + others[i] + "," + others[i-1])
		world.tlfs[tlfName] = mustGetRandBytesWithControlledFirstByte(16, byte(len(world.tlfs)+1))
	}

	world.tlfKeys = make(map[keybase1.CanonicalTlfName][]keybase1.CryptKey)
	for tlfName := range world.tlfs {
		world.tlfKeys[tlfName] = mustGetRandCryptKeys(byte(len(world.tlfKeys) + 1))
	}

	return world
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

type tlfMock struct {
	world *chatMockWorld
}

var _ keybase1.TlfInterface = tlfMock{}

func newTlfMock(world *chatMockWorld) tlfMock {
	return tlfMock{world}
}

func canonicalTlfNameForTest(tlfName string) keybase1.CanonicalTlfName {
	// very much simplified canonicalization.
	// TODO: implement rest when we need it
	names := strings.Split(tlfName, ",")
	sort.Strings(names)
	return keybase1.CanonicalTlfName(strings.Join(names, ","))
}

func (m tlfMock) CryptKeys(ctx context.Context, tlfName string) (res keybase1.TLFCryptKeys, err error) {
	res.CanonicalName = canonicalTlfNameForTest(tlfName)
	tlfID, ok := m.world.tlfs[res.CanonicalName]
	if !ok {
		err = fmt.Errorf("TLF %s not found", res.CanonicalName)
		return res, err
	}
	res.TlfID = keybase1.TLFID(hex.EncodeToString([]byte(tlfID)))
	if res.CryptKeys, ok = m.world.tlfKeys[res.CanonicalName]; !ok {
		err = fmt.Errorf("CryptKeys for TLF %s not found", res.CanonicalName)
		return res, err
	}
	return res, nil
}

// Not used by tests?
func (m tlfMock) CompleteAndCanonicalizeTlfName(ctx context.Context, tlfName string) (res keybase1.CanonicalTlfName, err error) {
	return
}

type chatRemoteMock struct {
	world *chatMockWorld

	// should always be sorted by newly updated conversation first
	conversations []*chat1.Conversation

	// each slice should always be sorted by message ID in desc, i.e. newest messages first
	msgs map[chat1.ConversationID][]*chat1.MessageBoxed
}

var _ chat1.RemoteInterface = (*chatRemoteMock)(nil)

func newChatRemoteMock(world *chatMockWorld) (m *chatRemoteMock) {
	m = &chatRemoteMock{
		world: world,
		msgs:  make(map[chat1.ConversationID][]*chat1.MessageBoxed),
	}
	return m
}

func (m *chatRemoteMock) GetInboxRemote(ctx context.Context, arg chat1.GetInboxRemoteArg) (res chat1.GetInboxRemoteRes, err error) {
	// TODO: add pagination support
	for _, conv := range m.conversations {
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
			if arg.Query.UnreadOnly && conv.ReaderInfo.ReadMsgid != conv.ReaderInfo.MaxMsgid {
				continue
			}
			// TODO: check arg.Query.TlfVisibility
			if arg.Query.After != nil && conv.ReaderInfo.Mtime < *arg.Query.After {
				continue
			}
			if arg.Query.Before != nil && conv.ReaderInfo.Mtime > *arg.Query.Before {
				continue
			}
		}
		res.Inbox.Conversations = append(res.Inbox.Conversations, *conv)
		if arg.Pagination != nil && arg.Pagination.Num != 0 && arg.Pagination.Num == len(res.Inbox.Conversations) {
			break
		}
	}
	return res, nil
}

func (m *chatRemoteMock) GetInboxByTLFIDRemote(ctx context.Context, tlfID chat1.TLFID) (res chat1.GetInboxByTLFIDRemoteRes, err error) {
	for _, conv := range m.conversations {
		if tlfID.Eq(conv.Metadata.IdTriple.Tlfid) {
			res.Convs = []chat1.Conversation{*conv}
			return res, nil
		}
	}
	return res, errors.New("conversation not found")
}

func (m *chatRemoteMock) GetThreadRemote(ctx context.Context, arg chat1.GetThreadRemoteArg) (res chat1.GetThreadRemoteRes, err error) {
	var mts map[chat1.MessageType]bool
	if arg.Query != nil && len(arg.Query.MessageTypes) > 0 {
		mts = make(map[chat1.MessageType]bool)
		for _, mt := range arg.Query.MessageTypes {
			mts[mt] = true
		}
	}

	// TODO: add pagination support
	msgs := m.msgs[arg.ConversationID]
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
		conv := m.getConversationByID(arg.ConversationID)
		if conv == nil {
			err = errors.New("conversation not found")
			return res, err
		}
		conv.ReaderInfo.MaxMsgid = msgs[0].ServerHeader.MessageID
	}
	return res, nil
}

func (m *chatRemoteMock) GetConversationMetadataRemote(ctx context.Context, convID chat1.ConversationID) (res chat1.GetConversationMetadataRemoteRes, err error) {
	conv := m.getConversationByID(convID)
	if conv == nil {
		err = errors.New("conversation not found")
		return res, err
	}
	res.Conv = *conv
	return res, err
}

func (m *chatRemoteMock) PostRemote(ctx context.Context, arg chat1.PostRemoteArg) (res chat1.PostRemoteRes, err error) {
	inserted := m.insertMsgAndSort(arg.ConversationID, arg.MessageBoxed)
	conv := m.getConversationByID(arg.ConversationID)
	conv.ReaderInfo.MaxMsgid = inserted.ServerHeader.MessageID
	conv.ReaderInfo.Mtime = inserted.ServerHeader.Ctime
	conv.MaxMsgs = m.getMaxMsgs(arg.ConversationID)
	sort.Sort(convByNewlyUpdated{mock: m})
	return
}

func (m *chatRemoteMock) NewConversationRemote(ctx context.Context, arg chat1.ConversationIDTriple) (res chat1.NewConversationRemoteRes, err error) {
	return res, errors.New("not implemented anymore")
}

func (m *chatRemoteMock) NewConversationRemote2(ctx context.Context, arg chat1.NewConversationRemote2Arg) (res chat1.NewConversationRemoteRes, err error) {
	res.ConvID = chat1.ConversationID(len(m.conversations) + 1) // TODO: compute this when we need it
	first := m.insertMsgAndSort(res.ConvID, arg.TLFMessage)
	m.conversations = append(m.conversations, &chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			IdTriple:       arg.IdTriple,
			ConversationID: res.ConvID,
		},
		MaxMsgs: []chat1.MessageBoxed{first},
		ReaderInfo: &chat1.ConversationReaderInfo{
			MaxMsgid: first.ServerHeader.MessageID,
			Mtime:    gregor1.ToTime(time.Now()),
		},
	})
	sort.Sort(convByNewlyUpdated{mock: m})
	return res, nil
}

func (m *chatRemoteMock) GetMessagesRemote(ctx context.Context, arg chat1.GetMessagesRemoteArg) (res chat1.GetMessagesRemoteRes, err error) {
	msgs, ok := m.msgs[arg.ConversationID]
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

func (m *chatRemoteMock) MarkAsRead(ctx context.Context, arg chat1.MarkAsReadArg) (res chat1.MarkAsReadRes, err error) {
	conv := m.getConversationByID(arg.ConversationID)
	if conv == nil {
		err = errors.New("conversation not found")
		return res, err
	}
	conv.ReaderInfo.ReadMsgid = arg.MsgID
	return res, nil
}

type convByNewlyUpdated struct {
	mock *chatRemoteMock
}

func (s convByNewlyUpdated) Len() int { return len(s.mock.conversations) }
func (s convByNewlyUpdated) Swap(i, j int) {
	s.mock.conversations[i], s.mock.conversations[j] = s.mock.conversations[j], s.mock.conversations[i]
}
func (s convByNewlyUpdated) Less(i, j int) bool {
	return s.mock.conversations[i].ReaderInfo.Mtime > s.mock.conversations[j].ReaderInfo.Mtime
}

type msgByMessageIDDesc struct {
	mock   *chatRemoteMock
	convID chat1.ConversationID
}

func (s msgByMessageIDDesc) Len() int { return len(s.mock.msgs[s.convID]) }
func (s msgByMessageIDDesc) Swap(i, j int) {
	s.mock.msgs[s.convID][i], s.mock.msgs[s.convID][j] = s.mock.msgs[s.convID][j], s.mock.msgs[s.convID][i]
}
func (s msgByMessageIDDesc) Less(i, j int) bool {
	return s.mock.msgs[s.convID][i].ServerHeader.MessageID > s.mock.msgs[s.convID][j].ServerHeader.MessageID
}

func (m *chatRemoteMock) getMaxMsgs(convID chat1.ConversationID) (maxMsgs []chat1.MessageBoxed) {
	finder := make(map[chat1.MessageType]*chat1.MessageBoxed)
	for _, msg := range m.msgs[convID] {
		if existing, ok := finder[msg.ServerHeader.MessageType]; !ok || existing.ServerHeader.MessageID < msg.ServerHeader.MessageID {
			finder[msg.ServerHeader.MessageType] = msg
		}
	}

	for _, msg := range finder {
		maxMsgs = append(maxMsgs, *msg)
	}

	return maxMsgs
}

func (m *chatRemoteMock) getConversationByID(convID chat1.ConversationID) *chat1.Conversation {
	for _, conv := range m.conversations {
		if conv.Metadata.ConversationID.String() == convID.String() {
			return conv
		}
	}
	return nil
}

func (m *chatRemoteMock) insertMsgAndSort(convID chat1.ConversationID, msg chat1.MessageBoxed) (inserted chat1.MessageBoxed) {
	msg.ServerHeader = &chat1.MessageServerHeader{
		Ctime:        gregor1.ToTime(time.Now()),
		MessageID:    chat1.MessageID(len(m.msgs[convID]) + 1),
		MessageType:  msg.ClientHeader.MessageType,
		Sender:       msg.ClientHeader.Sender,
		SenderDevice: msg.ClientHeader.SenderDevice,
	}
	m.msgs[convID] = append(m.msgs[convID], &msg)
	sort.Sort(msgByMessageIDDesc{mock: m, convID: convID})
	return msg
}
