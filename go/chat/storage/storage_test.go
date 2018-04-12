package storage

import (
	"crypto/rand"
	"math/big"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupStorageTest(t testing.TB, name string) (kbtest.ChatTestContext, *Storage, gregor1.UID) {
	ltc := setupCommonTest(t, name)
	u, err := kbtest.CreateAndSignupFakeUser("cs", ltc.G)
	tc := kbtest.ChatTestContext{
		TestContext: ltc,
		ChatG:       &globals.ChatContext{},
	}
	tc.Context().ServerCacheVersions = NewServerVersions(tc.Context())
	require.NoError(t, err)
	return tc, New(tc.Context()), gregor1.UID(u.User.GetUID().ToBytes())
}

func randBytes(n int) []byte {
	ret := make([]byte, n)
	rand.Read(ret)
	return ret
}

func makeEdit(id chat1.MessageID, supersedes chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     gregor1.ToTime(time.Now()),
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_EDIT,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
			MessageID: supersedes,
			Body:      "edit",
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func makeEphemeralEdit(id chat1.MessageID, supersedes chat1.MessageID, ephemeralMetadata *chat1.MsgEphemeralMetadata) chat1.MessageUnboxed {
	msg := makeEdit(id, supersedes)
	mvalid := msg.Valid()
	mvalid.ClientHeader.EphemeralMetadata = ephemeralMetadata
	return chat1.NewMessageUnboxedWithValid(mvalid)
}

func makeDelete(id chat1.MessageID, originalMessage chat1.MessageID, allEdits []chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     gregor1.ToTime(time.Now()),
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_DELETE,
		},
		MessageBody: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{
			MessageIDs: append([]chat1.MessageID{originalMessage}, allEdits...),
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func makeText(id chat1.MessageID, text string) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     gregor1.ToTime(time.Now()),
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: text,
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func makeEphemeralText(id chat1.MessageID, text string, ephemeralMetadata *chat1.MsgEphemeralMetadata) chat1.MessageUnboxed {
	msg := makeText(id, text)
	mvalid := msg.Valid()
	mvalid.ClientHeader.EphemeralMetadata = ephemeralMetadata
	return chat1.NewMessageUnboxedWithValid(mvalid)
}

func makeSystemMessage(id chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     gregor1.ToTime(time.Now()),
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_SYSTEM,
		},
		MessageBody: chat1.NewMessageBodyWithSystem(chat1.NewMessageSystemWithComplexteam(
			chat1.MessageSystemComplexTeam{
				Team: "wutang",
			},
		)),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func makeHeadlineMessage(id chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     gregor1.ToTime(time.Now()),
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_HEADLINE,
		},
		MessageBody: chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{
			Headline: "discus discuss",
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func makeDeleteHistory(id chat1.MessageID, upto chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     gregor1.ToTime(time.Now()),
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_DELETEHISTORY,
		},
		MessageBody: chat1.NewMessageBodyWithDeletehistory(chat1.MessageDeleteHistory{
			Upto: upto,
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func makeMsgWithType(id chat1.MessageID, typ chat1.MessageType) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     gregor1.ToTime(time.Now()),
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: typ,
		},
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func makeMsgRange(max int) (res []chat1.MessageUnboxed) {
	for i := max; i > 0; i-- {
		res = append(res, makeText(chat1.MessageID(i), "junk text"))
	}
	return res
}

func addMsgs(num int, msgs []chat1.MessageUnboxed) []chat1.MessageUnboxed {
	maxID := msgs[0].GetMessageID()
	for i := 0; i < num; i++ {
		msgs = append([]chat1.MessageUnboxed{makeText(chat1.MessageID(int(maxID)+i+1), "addMsgs junk text")},
			msgs...)
	}
	return msgs
}

func makeConvID() chat1.ConversationID {
	rbytes := randBytes(8)
	return chat1.ConversationID(rbytes)
}

func makeConversation(maxID chat1.MessageID) chat1.Conversation {
	return makeConversationAt(makeConvID(), maxID)
}

func makeConversationAt(convID chat1.ConversationID, maxID chat1.MessageID) chat1.Conversation {
	return chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			ConversationID: convID,
		},
		ReaderInfo: &chat1.ConversationReaderInfo{
			MaxMsgid: maxID,
		},
	}
}

// Sort messages by ID descending
func sortMessagesDesc(msgs []chat1.MessageUnboxed) []chat1.MessageUnboxed {
	var res []chat1.MessageUnboxed
	for _, m := range msgs {
		res = append(res, m)
	}
	sort.SliceStable(res, func(i, j int) bool {
		return res[j].GetMessageID() < res[i].GetMessageID()
	})
	return res
}

func mustMerge(t testing.TB, storage *Storage,
	convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed) MergeResult {
	res, err := storage.Merge(context.Background(), convID, uid, msgs)
	require.NoError(t, err)
	return res
}

func doSimpleBench(b *testing.B, storage *Storage, uid gregor1.UID) {
	msgs := makeMsgRange(100000)
	conv := makeConversation(msgs[0].GetMessageID())
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		mustMerge(b, storage, conv.Metadata.ConversationID, uid, msgs)
		_, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
		require.NoError(b, err)
		storage.MaybeNuke(true, nil, conv.Metadata.ConversationID, uid)
	}
}

func doCommonBench(b *testing.B, storage *Storage, uid gregor1.UID) {
	msgs := makeMsgRange(107)
	conv := makeConversation(msgs[0].GetMessageID())
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mustMerge(b, storage, conv.Metadata.ConversationID, uid, msgs)
		_, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
		require.NoError(b, err)

		// Add some msgs
		b.StopTimer()
		newmsgs := addMsgs(15, msgs)
		newconv := makeConversation(newmsgs[0].GetMessageID())
		b.StartTimer()

		mustMerge(b, storage, conv.Metadata.ConversationID, uid, newmsgs)
		storage.Fetch(context.TODO(), newconv, uid, nil, nil, nil)
	}
}

func doRandomBench(b *testing.B, storage *Storage, uid gregor1.UID, num, len int) {
	msgs := makeMsgRange(num)
	conv := makeConversation(msgs[0].GetMessageID())
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mustMerge(b, storage, conv.Metadata.ConversationID, uid, msgs)
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

			_, err = storage.Fetch(context.TODO(), conv, uid, nil, nil, &p)
			require.NoError(b, err)
		}
	}
}

func BenchmarkStorageSimpleBlockEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newBlockEngine(tc.Context()))
	doSimpleBench(b, storage, uid)
}

func BenchmarkStorageSimpleMsgEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newMsgEngine(tc.Context()))
	doSimpleBench(b, storage, uid)
}

func BenchmarkStorageCommonBlockEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newBlockEngine(tc.Context()))
	doCommonBench(b, storage, uid)
}

func BenchmarkStorageCommonMsgEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newMsgEngine(tc.Context()))
	doCommonBench(b, storage, uid)
}

func BenchmarkStorageRandomBlockEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newBlockEngine(tc.Context()))
	doRandomBench(b, storage, uid, 127, 1)
}

func BenchmarkStorageRandomMsgEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newMsgEngine(tc.Context()))
	doRandomBench(b, storage, uid, 127, 1)
}

func BenchmarkStorageRandomLongBlockEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newBlockEngine(tc.Context()))
	doRandomBench(b, storage, uid, 127, 1)
}

func BenchmarkStorageRandomLongMsgEngine(b *testing.B) {
	tc, storage, uid := setupStorageTest(b, "basic")
	storage.setEngine(newMsgEngine(tc.Context()))
	doRandomBench(b, storage, uid, 1757, 50)
}

func TestStorageBasic(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "basic")

	msgs := makeMsgRange(10)
	conv := makeConversation(msgs[0].GetMessageID())

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
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

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
}

func TestStorageSupersedes(t *testing.T) {
	var err error

	_, storage, uid := setupStorageTest(t, "supersedes")

	// First test an Edit message.
	supersedingEdit := makeEdit(chat1.MessageID(111), 6)

	msgs := makeMsgRange(110)
	msgs = append([]chat1.MessageUnboxed{supersedingEdit}, msgs...)
	conv := makeConversation(msgs[0].GetMessageID())

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}
	sheader := res.Messages[len(msgs)-6].Valid().ServerHeader
	require.Equal(t, chat1.MessageID(6), sheader.MessageID, "MessageID incorrect")
	require.Equal(t, chat1.MessageID(111), sheader.SupersededBy, "supersededBy incorrect")

	// Now test a delete message. This should result in the deletion of *both*
	// the original message's body and the body of the edit above.
	supersedingDelete := makeDelete(chat1.MessageID(112), 6, []chat1.MessageID{111})

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, []chat1.MessageUnboxed{supersedingDelete})
	conv.ReaderInfo.MaxMsgid = 112
	msgs = append([]chat1.MessageUnboxed{supersedingDelete}, msgs...)
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)

	deletedMessage := res.Messages[len(msgs)-6].Valid()
	deletedHeader := deletedMessage.ServerHeader
	require.Equal(t, chat1.MessageID(6), deletedHeader.MessageID, "MessageID incorrect")
	require.Equal(t, chat1.MessageID(112), deletedHeader.SupersededBy, "supersededBy incorrect")
	// Check that the body is deleted.
	deletedBodyType, err := deletedMessage.MessageBody.MessageType()
	require.NoError(t, err)
	require.Equal(t, chat1.MessageType_NONE, deletedBodyType, "expected the body to be deleted, but it's not!!!")
	// Check that the body of the edit is *also* is deleted.
	deletedEdit := res.Messages[len(msgs)-111].Valid()
	deletedEditBodyType, err := deletedEdit.MessageBody.MessageType()
	require.NoError(t, err)
	require.Equal(t, chat1.MessageType_NONE, deletedEditBodyType, "expected the edit's body to be deleted also, but it's not!!!")
}

func TestStorageDeleteHistory(t *testing.T) {
	// Uses this conversation:
	// A start                            <not deletable>
	// B text
	// C text <----\        edited by E
	// D headline  |                      <not deletable>
	// E edit -----^        edits C
	// F text <---\         deleted by G
	// G delete --^    ___  deletes F     <not deletable>
	// H text           |
	// I delete-history ^ upto H
	// J delete-history upto itself
	// K text

	_, storage, uid := setupStorageTest(t, "delh")

	convID := makeConvID()
	msgA := makeMsgWithType(1, chat1.MessageType_TLFNAME)
	msgB := makeText(2, "some text")
	msgC := makeText(3, "some text")
	msgD := makeHeadlineMessage(4)
	msgE := makeEdit(5, msgC.GetMessageID())
	msgF := makeText(6, "some text")
	msgG := makeDelete(7, msgF.GetMessageID(), nil)
	msgH := makeText(8, "some text")
	msgI := makeDeleteHistory(9, msgH.GetMessageID())
	msgJ := makeDeleteHistory(10, 10)
	msgK := makeText(11, "some text")

	type expectedM struct {
		Name         string // letter label
		MsgID        chat1.MessageID
		BodyPresent  bool
		SupersededBy chat1.MessageID
	}

	var expectedState []expectedM // expectations sorted by ID ascending
	setExpected := func(name string, msg chat1.MessageUnboxed, bodyPresent bool, supersededBy chat1.MessageID) {
		xset := expectedM{name, msg.GetMessageID(), bodyPresent, supersededBy}
		var found bool
		for i, x := range expectedState {
			if x.Name == name {
				found = true
				expectedState[i] = xset
			}
		}
		if !found {
			expectedState = append(expectedState, xset)
		}
		sort.Slice(expectedState, func(i, j int) bool {
			return expectedState[i].MsgID < expectedState[j].MsgID
		})
	}
	assertStateHelper := func(maxMsgID chat1.MessageID, allowHoles bool) {
		var rc ResultCollector
		if allowHoles {
			rc = NewInsatiableResultCollector()
		}
		res, err := storage.Fetch(context.Background(), makeConversationAt(convID, maxMsgID), uid, rc, nil, nil)
		require.NoError(t, err)
		if len(res.Messages) != len(expectedState) {
			t.Logf("wrong number of messages")
			for _, m := range res.Messages {
				t.Logf("msgid:%v type:%v", m.GetMessageID(), m.GetMessageType())
			}
			require.Equal(t, len(expectedState), len(res.Messages), "wrong number of messages")
		}
		for i, x := range expectedState {
			t.Logf("[%v] checking msgID:%v supersededBy:%v", x.Name, x.MsgID, x.SupersededBy)
			m := res.Messages[len(res.Messages)-1-i]
			require.True(t, m.IsValid(), "[%v] message should be valid", x.Name)
			require.Equal(t, x.MsgID, m.Valid().ServerHeader.MessageID, "[%v] message ID", x.Name)
			if m.GetMessageType() != chat1.MessageType_TLFNAME {
				if !x.BodyPresent && x.SupersededBy == 0 {
					t.Fatalf("You expected the body to be deleted but the message not to be superseded. Are you sure?")
				}
			}
			require.Equal(t, x.SupersededBy, m.Valid().ServerHeader.SupersededBy, "[%v] superseded by", x.Name)
			if x.BodyPresent {
				require.False(t, m.Valid().MessageBody.IsNil(), "[%v] message body should not be deleted", x.Name)
			} else {
				require.True(t, m.Valid().MessageBody.IsNil(), "[%v] message body should be deleted", x.Name)
			}
		}
	}
	assertState := func(maxMsgID chat1.MessageID) {
		assertStateHelper(maxMsgID, false)
	}
	assertStateAllowHoles := func(maxMsgID chat1.MessageID) {
		assertStateHelper(maxMsgID, true)
	}
	merge := func(msgsUnsorted []chat1.MessageUnboxed, expectedDeletedHistory bool) {
		res := mustMerge(t, storage, convID, uid, sortMessagesDesc(msgsUnsorted))
		if expectedDeletedHistory {
			require.NotNil(t, res.Expunged, "deleted history merge response")
		} else {
			require.Nil(t, res.Expunged, "deleted history merge response")
		}
		t.Logf("merge complete")
	}

	t.Logf("initial merge")
	// merge with no delh messages
	merge([]chat1.MessageUnboxed{msgA, msgB, msgC, msgD, msgE, msgF, msgG}, false)
	setExpected("A", msgA, false, 0) // TLFNAME messages have no body
	setExpected("B", msgB, true, 0)
	setExpected("C", msgC, true, msgE.GetMessageID())
	setExpected("D", msgD, true, 0)
	setExpected("E", msgE, true, 0)
	setExpected("F", msgF, false, msgG.GetMessageID())
	setExpected("G", msgG, true, 0)
	assertState(msgG.GetMessageID())

	t.Logf("merge first delh")
	// merge with one delh
	merge([]chat1.MessageUnboxed{msgH, msgI}, true)
	setExpected("A", msgA, false, 0)
	setExpected("B", msgB, false, msgI.GetMessageID())
	setExpected("C", msgC, false, msgI.GetMessageID())
	setExpected("D", msgD, true, 0) // not deletable
	setExpected("E", msgE, false, msgI.GetMessageID())
	setExpected("F", msgF, false, msgG.GetMessageID())
	setExpected("G", msgG, true, 0) // delete does not get deleted
	setExpected("H", msgH, true, 0) // after the cutoff
	setExpected("I", msgI, true, 0)
	assertState(msgI.GetMessageID())

	t.Logf("merge an already-processed delh")
	merge([]chat1.MessageUnboxed{msgH, msgI}, false)
	assertState(msgI.GetMessageID())

	t.Logf("merge second delh (J)")
	merge([]chat1.MessageUnboxed{msgJ, msgK}, true)
	setExpected("H", msgH, false, msgJ.GetMessageID())
	setExpected("I", msgI, true, 0) // delh can't be deleted
	setExpected("J", msgJ, true, 0) // delh can't be deleted
	setExpected("K", msgK, true, 0) // after the cutoff
	assertState(msgK.GetMessageID())

	t.Logf("merge non-latest delh")
	merge([]chat1.MessageUnboxed{msgI}, false)
	assertState(msgK.GetMessageID())

	t.Logf("discard storage")
	// Start over on storage, this time try things while missing
	// the beginning of the chat, and having holes in storage.
	_, err := storage.G().LocalChatDb.Nuke()
	require.NoError(t, err)
	expectedState = nil

	t.Logf("merge early part")
	merge([]chat1.MessageUnboxed{msgA, msgB}, false)
	setExpected("A", msgA, false, 0)
	setExpected("B", msgB, true, 0)
	assertState(msgB.GetMessageID())

	t.Logf("merge after gap")
	merge([]chat1.MessageUnboxed{msgH, msgI, msgJ, msgK}, true)
	// B gets deleted even through it was across a gap
	setExpected("B", msgB, false, msgJ.GetMessageID())
	setExpected("H", msgH, false, msgJ.GetMessageID())
	setExpected("I", msgI, true, 0) // delh can't be deleted
	setExpected("J", msgJ, true, 0) // delh can't be deleted
	setExpected("K", msgK, true, 0) // after the cutoff
	assertStateAllowHoles(msgK.GetMessageID())
}

func TestStorageExpunge(t *testing.T) {
	// Uses this conversation:
	// A start                            <not deletable>
	// B text
	// C text <----\        edited by E
	// D headline  |                      <not deletable>
	// E edit -----^        edits C
	// F text <---\         deleted by G
	// G delete --^    ___  deletes F     <not deletable>
	// H text           |
	// I delete-history ^ upto H

	_, storage, uid := setupStorageTest(t, "delh")

	convID := makeConvID()
	msgA := makeMsgWithType(1, chat1.MessageType_TLFNAME)
	msgB := makeText(2, "some text")
	msgC := makeText(3, "some text")
	msgD := makeHeadlineMessage(4)
	msgE := makeEdit(5, msgC.GetMessageID())
	msgF := makeText(6, "some text")
	msgG := makeDelete(7, msgF.GetMessageID(), nil)
	msgH := makeText(8, "some text")
	msgI := makeDeleteHistory(9, msgH.GetMessageID())

	type expectedM struct {
		Name         string // letter label
		MsgID        chat1.MessageID
		BodyPresent  bool
		SupersededBy chat1.MessageID
	}
	dontCare := chat1.MessageID(12341234)

	var expectedState []expectedM // expectations sorted by ID ascending
	setExpected := func(name string, msg chat1.MessageUnboxed, bodyPresent bool, supersededBy chat1.MessageID) {
		xset := expectedM{name, msg.GetMessageID(), bodyPresent, supersededBy}
		var found bool
		for i, x := range expectedState {
			if x.Name == name {
				found = true
				expectedState[i] = xset
			}
		}
		if !found {
			expectedState = append(expectedState, xset)
		}
		sort.Slice(expectedState, func(i, j int) bool {
			return expectedState[i].MsgID < expectedState[j].MsgID
		})
	}
	assertState := func(maxMsgID chat1.MessageID) {
		var rc ResultCollector
		res, err := storage.Fetch(context.Background(), makeConversationAt(convID, maxMsgID), uid, rc, nil, nil)
		require.NoError(t, err)
		if len(res.Messages) != len(expectedState) {
			t.Logf("wrong number of messages")
			for _, m := range res.Messages {
				t.Logf("msgid:%v type:%v", m.GetMessageID(), m.GetMessageType())
			}
			require.Equal(t, len(expectedState), len(res.Messages), "wrong number of messages")
		}
		for i, x := range expectedState {
			t.Logf("[%v] checking msgID:%v supersededBy:%v", x.Name, x.MsgID, x.SupersededBy)
			m := res.Messages[len(res.Messages)-1-i]
			require.True(t, m.IsValid(), "[%v] message should be valid", x.Name)
			require.Equal(t, x.MsgID, m.Valid().ServerHeader.MessageID, "[%v] message ID", x.Name)
			if m.GetMessageType() != chat1.MessageType_TLFNAME {
				if !x.BodyPresent && x.SupersededBy == 0 {
					t.Fatalf("You expected the body to be deleted but the message not to be superseded. Are you sure?")
				}
			}
			if x.SupersededBy != dontCare {
				require.Equal(t, x.SupersededBy, m.Valid().ServerHeader.SupersededBy, "[%v] superseded by", x.Name)
			}
			if x.BodyPresent {
				require.False(t, m.Valid().MessageBody.IsNil(), "[%v] message body should not be deleted", x.Name)
			} else {
				require.True(t, m.Valid().MessageBody.IsNil(), "[%v] message body should be deleted", x.Name)
			}
		}
	}
	merge := func(msgsUnsorted []chat1.MessageUnboxed, expectedDeletedHistory bool) {
		res := mustMerge(t, storage, convID, uid, sortMessagesDesc(msgsUnsorted))
		if expectedDeletedHistory {
			require.NotNil(t, res.Expunged, "deleted history merge response")
		} else {
			require.Nil(t, res.Expunged, "deleted history merge response")
		}
		t.Logf("merge complete")
	}
	expunge := func(upto chat1.MessageID, expectedDeletedHistory bool) {
		res, err := storage.Expunge(context.Background(), convID, uid, chat1.Expunge{Upto: upto})
		require.NoError(t, err)
		if expectedDeletedHistory {
			require.NotNil(t, res.Expunged, "deleted history merge response")
		} else {
			require.Nil(t, res.Expunged, "deleted history merge response")
		}
	}

	t.Logf("initial merge")
	// merge with no delh messages
	merge([]chat1.MessageUnboxed{msgA, msgB, msgC, msgD, msgE, msgF, msgG}, false)
	setExpected("A", msgA, false, 0) // TLFNAME messages have no body
	setExpected("B", msgB, true, 0)
	setExpected("C", msgC, true, msgE.GetMessageID())
	setExpected("D", msgD, true, 0)
	setExpected("E", msgE, true, 0)
	setExpected("F", msgF, false, msgG.GetMessageID())
	setExpected("G", msgG, true, 0)
	assertState(msgG.GetMessageID())

	t.Logf("expunge up to E")
	setExpected("B", msgB, false, dontCare)
	setExpected("C", msgC, false, dontCare)
	expunge(msgE.GetMessageID(), true)
	assertState(msgG.GetMessageID())

	t.Logf("expunge with no effect")
	expunge(msgE.GetMessageID(), false)

	t.Logf("another expunge with no effect")
	expunge(msgC.GetMessageID(), false)

	t.Logf("merge first delh")
	// merge with one delh
	merge([]chat1.MessageUnboxed{msgH, msgI}, true)
	setExpected("E", msgE, false, msgI.GetMessageID())
	setExpected("F", msgF, false, msgG.GetMessageID())
	setExpected("H", msgH, true, 0) // after the cutoff
	setExpected("I", msgI, true, 0)
	assertState(msgI.GetMessageID())

	t.Logf("expunge the rest")
	setExpected("H", msgH, false, dontCare) // after the cutoff
	expunge(msgI.GetMessageID()+12, true)
}

func TestStorageMiss(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "miss")

	msgs := makeMsgRange(10)
	conv := makeConversation(15)

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)
	_, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.Error(t, err, "expected error")
	require.IsType(t, MissError{}, err, "wrong error type")
}

func TestStoragePagination(t *testing.T) {

	_, storage, uid := setupStorageTest(t, "basic")

	msgs := makeMsgRange(300)
	conv := makeConversation(msgs[0].GetMessageID())
	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)

	t.Logf("test next input")
	tp := pager.NewThreadPager()
	index, err := tp.MakeIndex(makeText(120, "TestStoragePagination junk text"))
	require.NoError(t, err)
	p := chat1.Pagination{
		Num:  100,
		Next: index,
	}
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, &p)
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
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, nil, &p)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(219), msgs[81].GetMessageID(), "wrong msg id at broder")
	require.Equal(t, 100, len(res.Messages), "wrong amount of messages")
	for i := 0; i < len(res.Messages); i++ {
		require.Equal(t, msgs[i+81].GetMessageID(), res.Messages[i].GetMessageID(), "msg mismatch")
	}

	t.Logf("test prev input")
	index, err = tp.MakeIndex(makeText(120, "TestStoragePagination junk text #2"))
	require.NoError(t, err)
	p = chat1.Pagination{
		Num:      100,
		Previous: index,
	}
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, nil, &p)
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
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, nil, &p)
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
	msgs := append(mkarray(makeMsgWithType(chat1.MessageID(301), chat1.MessageType_EDIT)), textmsgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(302), chat1.MessageType_TLFNAME)), msgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(303), chat1.MessageType_ATTACHMENT)), msgs...)
	msgs = append(mkarray(makeMsgWithType(chat1.MessageID(304), chat1.MessageType_TEXT)), msgs...)
	textmsgs = append(mkarray(makeMsgWithType(chat1.MessageID(304), chat1.MessageType_TEXT)), textmsgs...)
	conv := makeConversation(msgs[0].GetMessageID())

	query := chat1.GetThreadQuery{
		MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
	}

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, &query, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages), "wrong amount of messages")
	restexts := utils.FilterByType(res.Messages, &query, true)
	require.Equal(t, len(textmsgs), len(restexts), "wrong amount of text messages")
	for i := 0; i < len(restexts); i++ {
		require.Equal(t, textmsgs[i].GetMessageID(), restexts[i].GetMessageID(), "msg mismatch")
	}

}

func TestStorageLocalMax(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "local-max")

	msgs := makeMsgRange(10)
	conv := makeConversation(15)

	_, err := storage.FetchUpToLocalMaxMsgID(context.TODO(), conv.Metadata.ConversationID, uid, nil, nil, nil)
	require.Error(t, err)
	require.IsType(t, MissError{}, err, "wrong error type")

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)
	tv, err := storage.FetchUpToLocalMaxMsgID(context.TODO(), conv.Metadata.ConversationID, uid, nil, nil, nil)
	require.NoError(t, err)
	require.Len(t, tv.Messages, 10)
}

func TestStorageFetchMessages(t *testing.T) {
	_, storage, uid := setupStorageTest(t, "fetchMessages")

	msgs := makeMsgRange(20)
	conv := makeConversation(25)

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)

	msgIDs := []chat1.MessageID{10, 15, 6}
	umsgs, err := storage.FetchMessages(context.TODO(), conv.Metadata.ConversationID, uid, msgIDs)
	require.NoError(t, err)
	require.Equal(t, len(msgIDs), len(umsgs), "size mismatch")
	for _, umsg := range umsgs {
		require.NotNil(t, umsg, "msg not found")
	}

	msgIDs = []chat1.MessageID{10, 15, 6, 21}
	umsgs, err = storage.FetchMessages(context.TODO(), conv.Metadata.ConversationID, uid, msgIDs)
	require.NoError(t, err)
	require.Equal(t, len(msgIDs), len(umsgs), "size mismatch")
	nils := 0
	for _, umsg := range umsgs {
		if umsg == nil {
			nils++
		}
	}
	require.Equal(t, 1, nils, "wrong number of nils")
}

func TestStorageServerVersion(t *testing.T) {
	tc, storage, uid := setupStorageTest(t, "serverVersion")

	msgs := makeMsgRange(300)
	conv := makeConversation(msgs[0].GetMessageID())
	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)
	res, err := storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages))

	cerr := tc.Context().ServerCacheVersions.Set(context.TODO(), chat1.ServerCacheVers{
		BodiesVers: 5,
	})
	require.NoError(t, cerr)

	res, err = storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.Error(t, err)
	require.IsType(t, MissError{}, err)

	mustMerge(t, storage, conv.Metadata.ConversationID, uid, msgs)
	res, err = storage.Fetch(context.TODO(), conv, uid, nil, nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(msgs), len(res.Messages))
}

func TestStorageDetectBodyHashReplay(t *testing.T) {
	tc, _, _ := setupStorageTest(t, "fetchMessages")

	// The first time we encounter a body hash it's stored.
	err := CheckAndRecordBodyHash(context.Background(), tc.Context(), chat1.Hash("foo"), 1, chat1.ConversationID("bar"))
	require.NoError(t, err)

	// Seeing the same body hash again in the same message is fine. That just
	// means we uboxed it twice.
	err = CheckAndRecordBodyHash(context.Background(), tc.Context(), chat1.Hash("foo"), 1, chat1.ConversationID("bar"))
	require.NoError(t, err)

	// But seeing the hash again with a different convID/msgID is a replay, and
	// it must trigger an error.
	err = CheckAndRecordBodyHash(context.Background(), tc.Context(), chat1.Hash("foo"), 1, chat1.ConversationID("bar2"))
	require.Error(t, err)
	err = CheckAndRecordBodyHash(context.Background(), tc.Context(), chat1.Hash("foo"), 2, chat1.ConversationID("bar"))
	require.Error(t, err)
}

func TestStorageDetectPrevPtrInconsistency(t *testing.T) {
	tc, _, _ := setupStorageTest(t, "fetchMessages")

	// The first time we encounter a message ID (either in unboxing or in
	// another message's prev pointer) its header hash is stored.
	err := CheckAndRecordPrevPointer(context.Background(), tc.Context(), 1, chat1.ConversationID("bar"), chat1.Hash("foo"))
	require.NoError(t, err)

	// Seeing the same header hash again in the same message is fine. That just
	// means we uboxed it twice.
	err = CheckAndRecordPrevPointer(context.Background(), tc.Context(), 1, chat1.ConversationID("bar"), chat1.Hash("foo"))
	require.NoError(t, err)

	// But seeing the same convID/msgID with a different header hash is a
	// consistency violation, and it must trigger an error.
	err = CheckAndRecordPrevPointer(context.Background(), tc.Context(), 1, chat1.ConversationID("bar"), chat1.Hash("foo2"))
	require.Error(t, err)
}
