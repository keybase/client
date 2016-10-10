package chat

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"testing"

	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func setupStorageTest(t *testing.T, name string) (libkb.TestContext, *Storage) {
	tc := externals.SetupTest(t, name, 2)
	return tc, NewStorage(tc.G)
}

func randBytes(n int) []byte {
	ret := make([]byte, n)
	rand.Read(ret)
	return ret
}

func makeMsgWithType(id chat1.MessageID, supersedes chat1.MessageID, typ chat1.MessageType) chat1.MessageFromServerOrError {
	return chat1.MessageFromServerOrError{
		Message: &chat1.MessageFromServer{
			ServerHeader: chat1.MessageServerHeader{
				MessageID:   id,
				MessageType: typ,
			},
			MessagePlaintext: chat1.NewMessagePlaintextWithV1(chat1.MessagePlaintextV1{
				ClientHeader: chat1.MessageClientHeader{
					Supersedes: supersedes,
				},
			}),
		},
	}
}

func makeMsg(id chat1.MessageID, supersedes chat1.MessageID) chat1.MessageFromServerOrError {
	return makeMsgWithType(id, supersedes, chat1.MessageType_TEXT)
}

func makeMsgRange(max int) (res []chat1.MessageFromServerOrError) {
	for i := max; i > 0; i-- {
		res = append(res, makeMsg(chat1.MessageID(i), chat1.MessageID(0)))
	}
	return res
}

func makeConvID(t *testing.T) chat1.ConversationID {
	// Read into int64
	var res uint64
	rbytes := randBytes(8)
	buf := bytes.NewReader(rbytes)
	err := binary.Read(buf, binary.LittleEndian, &res)
	require.NoError(t, err)
	return chat1.ConversationID(res)
}

func makeUID() gregor1.UID {
	raw := randBytes(16)
	return gregor1.UID(raw)
}

func makeConversation(t *testing.T, maxID chat1.MessageID) chat1.Conversation {
	convID := makeConvID(t)
	return chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			ConversationID: convID,
		},
		ReaderInfo: &chat1.ConversationReaderInfo{
			MaxMsgid: maxID,
		},
	}
}

func TestStorageBasic(t *testing.T) {
	_, storage := setupStorageTest(t, "basic")

	msgs := makeMsgRange(10)
	conv := makeConversation(t, msgs[0].GetMessageID())
	uid := makeUID()

	require.NoError(t, storage.Merge(conv.Metadata.ConversationID, uid, msgs))
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
}

func TestStorageLargeList(t *testing.T) {
	_, storage := setupStorageTest(t, "large list")

	msgs := makeMsgRange(2000)
	conv := makeConversation(t, msgs[0].GetMessageID())
	uid := makeUID()

	require.NoError(t, storage.Merge(conv.Metadata.ConversationID, uid, msgs))
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
}

func TestStorageSupersedes(t *testing.T) {
	_, storage := setupStorageTest(t, "suprsedes")

	msgs := makeMsgRange(110)
	superseder := makeMsg(chat1.MessageID(111), 6)
	superseder2 := makeMsg(chat1.MessageID(112), 11)
	msgs = append([]chat1.MessageFromServerOrError{superseder}, msgs...)
	conv := makeConversation(t, msgs[0].GetMessageID())
	uid := makeUID()

	require.NoError(t, storage.Merge(conv.Metadata.ConversationID, uid, msgs))
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
	sheader := res.Messages[len(msgs)-6].Message.ServerHeader
	require.Equal(t, chat1.MessageID(6), sheader.MessageID, "MessageID incorrect")
	require.Equal(t, chat1.MessageID(111), sheader.SupersededBy, "supersededBy incorrect")

	require.NoError(t, storage.Merge(conv.Metadata.ConversationID, uid,
		[]chat1.MessageFromServerOrError{superseder2}))
	conv.ReaderInfo.MaxMsgid = 112
	msgs = append([]chat1.MessageFromServerOrError{superseder2}, msgs...)
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)

	sheader = res.Messages[len(msgs)-11].Message.ServerHeader
	require.Equal(t, chat1.MessageID(11), sheader.MessageID, "MessageID incorrect")
	require.Equal(t, chat1.MessageID(112), sheader.SupersededBy, "supersededBy incorrect")
}

func TestStorageMiss(t *testing.T) {
	_, storage := setupStorageTest(t, "miss")

	msgs := makeMsgRange(10)
	conv := makeConversation(t, 15)
	uid := makeUID()

	require.NoError(t, storage.Merge(conv.Metadata.ConversationID, uid, msgs))
	_, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.Error(t, err, "expected error")
	require.IsType(t, libkb.ChatStorageMissError{}, err, "wrong error type")
}

func TestStoragePagination(t *testing.T) {

	_, storage := setupStorageTest(t, "basic")

	msgs := makeMsgRange(300)
	conv := makeConversation(t, msgs[0].GetMessageID())
	uid := makeUID()
	require.NoError(t, storage.Merge(conv.Metadata.ConversationID, uid, msgs))

	t.Logf("test next input")
	tp := pager.NewThreadPager()
	index, err := tp.MakeIndex(makeMsg(120, 0))
	require.NoError(t, err)
	p := chat1.Pagination{
		Num:  100,
		Next: index,
	}
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, &p, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(119), msgs[181].GetMessageID(), "wrong msg id at border")
	require.Equal(t, 100, len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i+181].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
	p = chat1.Pagination{
		Num:      100,
		Previous: res.Pagination.Previous,
	}
	t.Logf("fetching previous from result")
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, &p, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(219), msgs[81].GetMessageID(), "wrong msg id at broder")
	require.Equal(t, 100, len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i+81].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}

	t.Logf("test prev input")
	index, err = tp.MakeIndex(makeMsg(120, 0))
	require.NoError(t, err)
	p = chat1.Pagination{
		Num:      100,
		Previous: index,
	}
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, &p, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(220), msgs[80].GetMessageID(), "wrong msg id at border")
	require.Equal(t, 100, len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i+80].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
	p = chat1.Pagination{
		Num:  100,
		Next: res.Pagination.Next,
	}
	t.Logf("fetching next from result")
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, &p, nil)
	require.NoError(t, err)
	require.Equal(t, 100, len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i+180].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
}

func mkarray(m chat1.MessageFromServerOrError) []chat1.MessageFromServerOrError {
	return []chat1.MessageFromServerOrError{m}
}

func TestStorageTypeFilter(t *testing.T) {
	_, storage := setupStorageTest(t, "basic")

	textmsgs := makeMsgRange(300)
	uid := makeUID()
	msgs := append(mkarray(makeMsgWithType(chat1.MessageID(301), 0, chat1.MessageType_EDIT)), textmsgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(302), 0, chat1.MessageType_TLFNAME)), msgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(303), 0, chat1.MessageType_ATTACHMENT)), msgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(304), 0, chat1.MessageType_TEXT)), msgs...)
	textmsgs = append(mkarray(makeMsgWithType(chat1.MessageID(304), 0, chat1.MessageType_TEXT)), textmsgs...)
	conv := makeConversation(t, msgs[0].GetMessageID())

	query := chat1.GetThreadQuery{
		MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
	}

	require.NoError(t, storage.Merge(conv.Metadata.ConversationID, uid, msgs))
	res, err := storage.Fetch(context.TODO(), conv, uid, &query, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	restexts := FilterByType(res.Messages, &query)
	require.Equal(t, len(textmsgs), len(restexts), "wrong amount of text messages")
	for i := 0; i < len(restexts); i++ {
		require.Equal(t, textmsgs[i].GetMessageID(), restexts[i].GetMessageID(), "msg mismatch")
	}

}
