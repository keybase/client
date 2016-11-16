package storage

import (
	"crypto/rand"
	"math/big"
	"testing"

	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupStorageTest(t testing.TB, name string) (libkb.TestContext, *Storage, gregor1.UID) {
	tc := externals.SetupTest(t, name, 2)
	u, err := kbtest.CreateAndSignupFakeUser("cs", tc.G)
	require.NoError(t, err)
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: u.Passphrase}
	}
	return tc, New(tc.G, f), gregor1.UID(u.User.GetUID().ToBytes())
}

func randBytes(n int) []byte {
	ret := make([]byte, n)
	rand.Read(ret)
	return ret
}

func makeMsgWithType(id chat1.MessageID, supersedes chat1.MessageID, typ chat1.MessageType) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
		},
		ClientHeader: chat1.MessageClientHeader{
			MessageType: typ,
			Supersedes:  supersedes,
		},
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func makeMsg(id chat1.MessageID, supersedes chat1.MessageID) chat1.MessageUnboxed {
	return makeMsgWithType(id, supersedes, chat1.MessageType_TEXT)
}

func makeMsgRange(max int) (res []chat1.MessageUnboxed) {
	for i := max; i > 0; i-- {
		res = append(res, makeMsg(chat1.MessageID(i), chat1.MessageID(0)))
	}
	return res
}

func addMsgs(num int, msgs []chat1.MessageUnboxed) []chat1.MessageUnboxed {
	maxID := msgs[0].GetMessageID()
	for i := 0; i < num; i++ {
		msgs = append([]chat1.MessageUnboxed{makeMsg(chat1.MessageID(int(maxID)+i+1), 0)},
			msgs...)
	}
	return msgs
}

func makeConvID() chat1.ConversationID {
	rbytes := randBytes(8)
	return chat1.ConversationID(rbytes)
}

func makeConversation(maxID chat1.MessageID) chat1.Conversation {
	convID := makeConvID()
	return chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			ConversationID: convID,
		},
		ReaderInfo: &chat1.ConversationReaderInfo{
			MaxMsgid: maxID,
		},
	}
}

func doSimpleBench(b *testing.B, storage *Storage, uid gregor1.UID) {
	msgs := makeMsgRange(100000)
	conv := makeConversation(msgs[0].GetMessageID())
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		require.NoError(b, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))
		_, err := storage.Fetch(context.TODO(), conv, uid, nil, nil)
		require.NoError(b, err)
		storage.MaybeNuke(true, nil, conv.Metadata.ConversationID, uid)
	}
}

func doCommonBench(b *testing.B, storage *Storage, uid gregor1.UID) {
	msgs := makeMsgRange(107)
	conv := makeConversation(msgs[0].GetMessageID())
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		require.NoError(b, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))
		_, err := storage.Fetch(context.TODO(), conv, uid, nil, nil)
		require.NoError(b, err)

		// Add some msgs
		b.StopTimer()
		newmsgs := addMsgs(15, msgs)
		newconv := makeConversation(newmsgs[0].GetMessageID())
		b.StartTimer()

		require.NoError(b, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, newmsgs))
		storage.Fetch(context.TODO(), newconv, uid, nil, nil)
	}
}

func doRandomBench(b *testing.B, storage *Storage, uid gregor1.UID, num, len int) {
	msgs := makeMsgRange(num)
	conv := makeConversation(msgs[0].GetMessageID())
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		require.NoError(b, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))
		for j := 0; j < 300; j++ {

			b.StopTimer()
			var bi *big.Int
			var err error
			for {
				bi, err = rand.Int(rand.Reader, big.NewInt(int64(num)))
				require.NoError(b, err)
				if bi.Int64() > 1 {
					break
				}
			}
			next, err := encode(chat1.MessageID(bi.Int64()))
			require.NoError(b, err)
			p := chat1.Pagination{
				Num:  len,
				Next: next,
			}
			b.StartTimer()

			_, err = storage.Fetch(context.TODO(), conv, uid, nil, &p)
			require.NoError(b, err)
		}
	}
}

func BenchmarkStorageSimpleBlockEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newBlockEngine(tc.G))
	doSimpleBench(b, storage, uid)
}

func BenchmarkStorageSimpleMsgEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newMsgEngine(tc.G))
	doSimpleBench(b, storage, uid)
}

func BenchmarkStorageCommonBlockEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newBlockEngine(tc.G))
	doCommonBench(b, storage, uid)
}

func BenchmarkStorageCommonMsgEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newMsgEngine(tc.G))
	doCommonBench(b, storage, uid)
}

func BenchmarkStorageRandomBlockEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newBlockEngine(tc.G))
	doRandomBench(b, storage, uid, 127, 1)
}

func BenchmarkStorageRandomMsgEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newMsgEngine(tc.G))
	doRandomBench(b, storage, uid, 127, 1)
}

func BenchmarkStorageRandomLongBlockEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newBlockEngine(tc.G))
	doRandomBench(b, storage, uid, 127, 1)
}

func BenchmarkStorageRandomLongMsgEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newMsgEngine(tc.G))
	doRandomBench(b, storage, uid, 1757, 50)
}

func TestStorageBasic(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "basic")

	msgs := makeMsgRange(10)
	conv := makeConversation(msgs[0].GetMessageID())

	require.NoError(t, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
}

func TestStorageLargeList(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "large list")

	msgs := makeMsgRange(2000)
	conv := makeConversation(msgs[0].GetMessageID())

	require.NoError(t, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
}

func TestStorageSupersedes(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "suprsedes")

	msgs := makeMsgRange(110)
	superseder := makeMsg(chat1.MessageID(111), 6)
	superseder2 := makeMsg(chat1.MessageID(112), 11)
	msgs = append([]chat1.MessageUnboxed{superseder}, msgs...)
	conv := makeConversation(msgs[0].GetMessageID())

	require.NoError(t, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
	sheader := res.Messages[len(msgs)-6].Valid().ServerHeader
	require.Equal(t, chat1.MessageID(6), sheader.MessageID, "MessageID incorrect")
	require.Equal(t, chat1.MessageID(111), sheader.SupersededBy, "supersededBy incorrect")

	require.NoError(t, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid,
		[]chat1.MessageUnboxed{superseder2}))
	conv.ReaderInfo.MaxMsgid = 112
	msgs = append([]chat1.MessageUnboxed{superseder2}, msgs...)
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, nil)
	require.NoError(t, err)

	sheader = res.Messages[len(msgs)-11].Valid().ServerHeader
	require.Equal(t, chat1.MessageID(11), sheader.MessageID, "MessageID incorrect")
	require.Equal(t, chat1.MessageID(112), sheader.SupersededBy, "supersededBy incorrect")
}

func TestStorageMiss(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "miss")

	msgs := makeMsgRange(10)
	conv := makeConversation(15)

	require.NoError(t, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))
	_, err := storage.Fetch(context.TODO(), conv, uid, nil, nil)
	require.Error(t, err, "expected error")
	require.IsType(t, libkb.ChatStorageMissError{}, err, "wrong error type")
}

func TestStoragePagination(t *testing.T) {

	_, storage, uid := setupStorageTest(t, "basic")

	msgs := makeMsgRange(300)
	conv := makeConversation(msgs[0].GetMessageID())
	require.NoError(t, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))

	t.Logf("test next input")
	tp := pager.NewThreadPager()
	index, err := tp.MakeIndex(makeMsg(120, 0))
	require.NoError(t, err)
	p := chat1.Pagination{
		Num:  100,
		Next: index,
	}
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, &p)
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
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, &p)
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
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, &p)
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
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, &p)
	require.NoError(t, err)
	require.Equal(t, 100, len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i+180].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
}

func mkarray(m chat1.MessageUnboxed) []chat1.MessageUnboxed {
	return []chat1.MessageUnboxed{m}
}

func TestStorageTypeFilter(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "basic")

	textmsgs := makeMsgRange(300)
	msgs := append(mkarray(makeMsgWithType(chat1.MessageID(301), 0, chat1.MessageType_EDIT)), textmsgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(302), 0, chat1.MessageType_TLFNAME)), msgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(303), 0, chat1.MessageType_ATTACHMENT)), msgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(304), 0, chat1.MessageType_TEXT)), msgs...)
	textmsgs = append(mkarray(makeMsgWithType(chat1.MessageID(304), 0, chat1.MessageType_TEXT)), textmsgs...)
	conv := makeConversation(msgs[0].GetMessageID())

	query := chat1.GetThreadQuery{
		MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
	}

	require.NoError(t, storage.Merge(context.TODO(), conv.Metadata.ConversationID, uid, msgs))
	res, err := storage.Fetch(context.TODO(), conv, uid, &query, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	restexts := utils.FilterByType(res.Messages, &query)
	require.Equal(t, len(textmsgs), len(restexts), "wrong amount of text messages")
	for i := 0; i < len(restexts); i++ {
		require.Equal(t, textmsgs[i].GetMessageID(), restexts[i].GetMessageID(), "msg mismatch")
	}

}
