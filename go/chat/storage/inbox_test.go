package storage

import (
	"context"
	"sort"
	"testing"
	"time"

	"encoding/hex"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func setupInboxTest(t testing.TB, name string) (kbtest.ChatTestContext, *Inbox, gregor1.UID) {
	ctc := setupCommonTest(t, name)

	u, err := kbtest.CreateAndSignupFakeUser("ib", ctc.TestContext.G)
	require.NoError(t, err)
	uid := gregor1.UID(u.User.GetUID().ToBytes())
	return ctc, NewInbox(ctc.Context()), uid
}

func makeTlfID() chat1.TLFID {
	return randBytes(8)
}

func makeConvo(mtime gregor1.Time, rmsg chat1.MessageID, mmsg chat1.MessageID) types.RemoteConversation {
	conv := chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			ConversationID: randBytes(8),
			IdTriple: chat1.ConversationIDTriple{
				Tlfid:     makeTlfID(),
				TopicType: chat1.TopicType_CHAT,
				TopicID:   randBytes(8),
			},
			Visibility: keybase1.TLFVisibility_PRIVATE,
			Status:     chat1.ConversationStatus_UNFILED,
		},
		ReaderInfo: &chat1.ConversationReaderInfo{
			Mtime:     mtime,
			ReadMsgid: rmsg,
			MaxMsgid:  mmsg,
		},
		// Make it look like there's a visible message in here too
		MaxMsgSummaries: []chat1.MessageSummary{{MessageType: chat1.MessageType_TEXT, MsgID: 1}},
	}
	return utils.RemoteConv(conv)
}

func makeInboxMsg(id chat1.MessageID, typ chat1.MessageType) chat1.MessageBoxed {
	return chat1.MessageBoxed{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: typ,
		},
		ServerHeader: &chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     gregor1.ToTime(time.Now()),
		},
	}
}

func convListCompare(t *testing.T, ref []types.RemoteConversation, res []types.RemoteConversation,
	name string) {
	require.Equal(t, len(ref), len(res), name+" size mismatch")
	refMap := make(map[chat1.ConvIDStr]types.RemoteConversation)
	for _, conv := range ref {
		refMap[conv.GetConvID().ConvIDStr()] = conv
	}
	for _, conv := range res {
		require.Equal(t, refMap[conv.GetConvID().ConvIDStr()], conv)
	}
}

func TestInboxBasic(t *testing.T) {

	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	// Fetch with no query parameter
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	vers, res, err := inbox.Read(context.TODO(), uid, nil)

	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(1), vers, "version mismatch")
	convListCompare(t, convs, res, "basic")
}

func TestInboxSummarize(t *testing.T) {
	tc, inbox, uid := setupInboxTest(t, "summarize")
	defer tc.Cleanup()

	conv := makeConvo(gregor1.Time(1), 1, 1)
	maxMsgID := chat1.MessageID(6)
	conv.Conv.MaxMsgs = []chat1.MessageBoxed{{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: chat1.MessageType_TEXT,
		},
		ServerHeader: &chat1.MessageServerHeader{
			MessageID: maxMsgID,
		},
	}}

	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, []chat1.Conversation{conv.Conv}, nil))
	_, res, err := inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)
	require.Zero(t, len(res[0].Conv.MaxMsgs))
	require.Equal(t, 1, len(res[0].Conv.MaxMsgSummaries))
	require.Equal(t, maxMsgID, res[0].Conv.MaxMsgSummaries[0].GetMessageID())
}

func TestInboxQueries(t *testing.T) {
	tc, inbox, uid := setupInboxTest(t, "queries")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 20
	var convs []types.RemoteConversation
	for i := 0; i < numConvs; i++ {
		conv := makeConvo(gregor1.Time(i), 1, 1)
		convs = append(convs, conv)
	}

	// Make two dev convos
	var devs, publics, unreads, ignored, muted, full []types.RemoteConversation
	convs[3].Conv.Metadata.IdTriple.TopicType = chat1.TopicType_DEV
	convs[7].Conv.Metadata.IdTriple.TopicType = chat1.TopicType_DEV
	devs = append(devs, []types.RemoteConversation{convs[7], convs[3]}...)

	// Make one public convos
	convs[13].Conv.Metadata.Visibility = keybase1.TLFVisibility_PUBLIC
	publics = append(publics, convs[13])

	// Make three unread convos
	makeUnread := func(ri *chat1.ConversationReaderInfo) {
		ri.ReadMsgid = 0
	}
	makeUnread(convs[5].Conv.ReaderInfo)
	makeUnread(convs[13].Conv.ReaderInfo)
	makeUnread(convs[19].Conv.ReaderInfo)
	unreads = append(unreads, []types.RemoteConversation{convs[19], convs[13], convs[5]}...)

	// Make two ignored
	convs[18].Conv.Metadata.Status = chat1.ConversationStatus_IGNORED
	convs[4].Conv.Metadata.Status = chat1.ConversationStatus_IGNORED
	ignored = append(ignored, []types.RemoteConversation{convs[18], convs[4]}...)

	// Make one muted
	convs[12].Conv.Metadata.Status = chat1.ConversationStatus_MUTED
	muted = append(muted, []types.RemoteConversation{convs[12]}...)

	// Mark one as finalized and superseded by
	convs[6].Conv.Metadata.FinalizeInfo = &chat1.ConversationFinalizeInfo{
		ResetFull: "reset",
	}
	convs[6].Conv.Metadata.SupersededBy = append(convs[6].Conv.Metadata.SupersededBy, convs[17].Conv.Metadata)
	convs[17].Conv.Metadata.Supersedes = append(convs[17].Conv.Metadata.Supersedes, convs[6].Conv.Metadata)
	for i := len(convs) - 1; i >= 0; i-- {
		if i == 6 {
			continue
		}
		full = append(full, convs[i])
	}
	for _, conv := range full {
		t.Logf("convID: %s", conv.GetConvID())
	}

	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))

	// Merge in queries and try to read them back out
	var q *chat1.GetInboxQuery
	mergeReadAndCheck := func(t *testing.T, ref []types.RemoteConversation, name string) {
		require.NoError(t, inbox.Merge(context.TODO(), uid, 1, []chat1.Conversation{}, q))
		_, res, err := inbox.Read(context.TODO(), uid, q)
		require.NoError(t, err)
		convListCompare(t, ref, res, name)
	}
	t.Logf("merging all convs with nil query")
	q = nil
	mergeReadAndCheck(t, full, "all")

	t.Logf("merging dev query")
	devtype := chat1.TopicType_DEV
	q = &chat1.GetInboxQuery{TopicType: &devtype}
	mergeReadAndCheck(t, devs, "devs")

	t.Logf("merging public query")
	publicVis := keybase1.TLFVisibility_PUBLIC
	q = &chat1.GetInboxQuery{TlfVisibility: &publicVis}
	mergeReadAndCheck(t, publics, "public")

	t.Logf("merging unread query")
	q = &chat1.GetInboxQuery{UnreadOnly: true}
	mergeReadAndCheck(t, unreads, "unread")

	t.Logf("merging ignore query")
	q = &chat1.GetInboxQuery{Status: []chat1.ConversationStatus{chat1.ConversationStatus_IGNORED}}
	mergeReadAndCheck(t, ignored, "ignored")

	t.Logf("merging muted query")
	q = &chat1.GetInboxQuery{Status: []chat1.ConversationStatus{chat1.ConversationStatus_MUTED}}
	mergeReadAndCheck(t, muted, "muted")

	t.Logf("merging tlf ID query")
	q = &chat1.GetInboxQuery{TlfID: &full[0].Conv.Metadata.IdTriple.Tlfid}
	tlfIDs := []types.RemoteConversation{full[0]}
	mergeReadAndCheck(t, tlfIDs, "tlfids")

	t.Logf("merging after query")
	after := full[:4]
	atime := gregor1.Time(15)
	q = &chat1.GetInboxQuery{After: &atime}
	mergeReadAndCheck(t, after, "after")

	t.Logf("merging before query")
	before := full[5:]
	var beforeConvIDs []chat1.ConversationID
	for _, bconv := range before {
		beforeConvIDs = append(beforeConvIDs, bconv.GetConvID())
	}
	btime := gregor1.Time(15)
	q = &chat1.GetInboxQuery{Before: &btime}
	mergeReadAndCheck(t, before, "before")

	t.Logf("check conv IDs queries work")
	q = &chat1.GetInboxQuery{Before: &btime, ConvIDs: beforeConvIDs}
	_, cres, err := inbox.Read(context.TODO(), uid, q)
	require.NoError(t, err)
	convListCompare(t, before, cres, "convIDs")
}

func TestInboxEmptySuperseder(t *testing.T) {
	tc, inbox, uid := setupInboxTest(t, "queries")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 20
	var convs []types.RemoteConversation
	for i := 0; i < numConvs; i++ {
		conv := makeConvo(gregor1.Time(i), 1, 1)
		conv.Conv.MaxMsgSummaries = nil
		convs = append(convs, conv)
	}
	var full, superseded []types.RemoteConversation
	convs[6].Conv.Metadata.SupersededBy = append(convs[6].Conv.Metadata.SupersededBy, convs[17].Conv.Metadata)
	convs[17].Conv.Metadata.Supersedes = append(convs[17].Conv.Metadata.Supersedes, convs[6].Conv.Metadata)
	for i := len(convs) - 1; i >= 0; i-- {
		// Don't skip the superseded one, since it's not supposed to be filtered out
		// by an empty superseder
		full = append(full, convs[i])
	}
	for _, conv := range full {
		t.Logf("convID: %s", conv.GetConvID())
	}

	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))

	// Merge in queries and try to read them back out
	var q *chat1.GetInboxQuery
	mergeReadAndCheck := func(t *testing.T, ref []types.RemoteConversation, name string) {
		require.NoError(t, inbox.Merge(context.TODO(), uid, 1, []chat1.Conversation{}, q))
		_, res, err := inbox.Read(context.TODO(), uid, q)
		require.NoError(t, err)
		convListCompare(t, ref, res, name)
	}
	t.Logf("merging all convs with nil query")
	q = nil
	mergeReadAndCheck(t, full, "all")

	t.Logf("merging empty superseder query")
	// Don't skip the superseded one, since it's not supposed to be filtered out
	// by an empty superseder
	superseded = append(superseded, full...)
	q = &chat1.GetInboxQuery{}
	// OneChatTypePerTLF
	t.Logf("full has %d, superseded has %d", len(full), len(superseded))

	mergeReadAndCheck(t, superseded, "superseded")

	// Now test OneChatTypePerTLF
	tc, inbox, uid = setupInboxTest(t, "queries2")
	defer tc.Cleanup()

	full = []types.RemoteConversation{}
	superseded = []types.RemoteConversation{}
	for i := len(convs) - 1; i >= 0; i-- {
		// skip the superseded one, since it's supposed to be filtered out
		// if not OneChatTypePerTLF
		if i == 6 {
			continue
		}
		full = append(full, convs[i])
	}
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(full), nil))
	superseded = append(superseded, full...)
	oneChatTypePerTLF := false
	q = &chat1.GetInboxQuery{OneChatTypePerTLF: &oneChatTypePerTLF}
	mergeReadAndCheck(t, superseded, "superseded")

}

func TestInboxNewConversation(t *testing.T) {
	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}
	convs[5].Conv.Metadata.FinalizeInfo = &chat1.ConversationFinalizeInfo{
		ResetFull: "reset",
	}

	t.Logf("basic newconv")
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	newConv := makeConvo(gregor1.Time(11), 1, 1)
	require.NoError(t, inbox.NewConversation(context.TODO(), uid, 2, newConv.Conv))
	_, res, err := inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)
	convs = append([]types.RemoteConversation{newConv}, convs...)
	convListCompare(t, convs, res, "newconv")

	t.Logf("repeat conv")
	require.NoError(t, inbox.NewConversation(context.TODO(), uid, 3, newConv.Conv))
	_, res, err = inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)
	convListCompare(t, convs, res, "repeatconv")

	t.Logf("supersede newconv")
	newConv = makeConvo(gregor1.Time(12), 1, 1)
	newConv.Conv.Metadata.Supersedes = append(newConv.Conv.Metadata.Supersedes, convs[6].Conv.Metadata)
	require.NoError(t, inbox.NewConversation(context.TODO(), uid, 4, newConv.Conv))
	_, res, err = inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)
	convs = append([]types.RemoteConversation{newConv}, convs...)
	convListCompare(t, append(convs[:7], convs[8:]...), res, "newconv finalized")

	require.Equal(t, numConvs+2, len(convs), "n convs")

	err = inbox.NewConversation(context.TODO(), uid, 10, newConv.Conv)
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxNewMessage(t *testing.T) {

	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	uid1 := uid
	uid2, err := hex.DecodeString("22")
	require.NoError(t, err)
	uid3, err := hex.DecodeString("33")
	require.NoError(t, err)

	convs[5].Conv.Metadata.ActiveList = []gregor1.UID{uid2, uid3, uid1}
	convs[6].Conv.Metadata.ActiveList = []gregor1.UID{uid2, uid3}
	conv := convs[5]
	msg := makeInboxMsg(2, chat1.MessageType_TEXT)
	msg.ClientHeader.Sender = uid1
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	convID := conv.GetConvID()
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 2, conv.GetConvID(), msg, nil))
	_, res, err := inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	require.Equal(t, conv.GetConvID(), res[0].GetConvID(), "conv not promoted")
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.MaxMsgid, "wrong max msgid")
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.ReadMsgid, "wrong read msgid")
	require.Equal(t, msg.Ctime(), res[0].Conv.ReaderInfo.LastSendTime)
	require.Equal(t, []gregor1.UID{uid1, uid2, uid3}, res[0].Conv.Metadata.ActiveList, "active list")
	maxMsg, err := res[0].Conv.GetMaxMessage(chat1.MessageType_TEXT)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(2), maxMsg.GetMessageID(), "max msg not updated")

	// Test incomplete active list
	conv = convs[6]
	convID = conv.GetConvID()
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 3, conv.GetConvID(), msg, nil))
	_, res, err = inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	require.Equal(t, []gregor1.UID{uid1, uid2, uid3}, res[0].Conv.Metadata.ActiveList, "active list")

	// Send another one from a diff User
	msg2 := makeInboxMsg(3, chat1.MessageType_TEXT)
	msg2.ClientHeader.Sender = uid2
	convID = conv.GetConvID()
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 4, conv.GetConvID(), msg2, nil))
	_, res, err = inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(3), res[0].Conv.ReaderInfo.MaxMsgid, "wrong max msgid")
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.ReadMsgid, "wrong read msgid")
	require.Equal(t, msg.Ctime(), res[0].Conv.ReaderInfo.LastSendTime)
	require.Equal(t, []gregor1.UID{uid2, uid1, uid3}, res[0].Conv.Metadata.ActiveList, "active list")
	maxMsg, err = res[0].Conv.GetMaxMessage(chat1.MessageType_TEXT)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(3), maxMsg.GetMessageID())

	// Test delete mechanics
	delMsg := makeInboxMsg(4, chat1.MessageType_TEXT)
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 5, conv.GetConvID(), delMsg, nil))
	_, res, err = inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	maxMsg, err = res[0].Conv.GetMaxMessage(chat1.MessageType_TEXT)
	require.NoError(t, err)
	require.Equal(t, delMsg.GetMessageID(), maxMsg.GetMessageID())
	delete := makeInboxMsg(5, chat1.MessageType_DELETE)
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 0, conv.GetConvID(), delete, nil))
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 6, conv.GetConvID(), delete,
		[]chat1.MessageSummary{msg2.Summary()}))
	_, res, err = inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	maxMsg, err = res[0].Conv.GetMaxMessage(chat1.MessageType_TEXT)
	require.NoError(t, err)
	require.Equal(t, msg2.GetMessageID(), maxMsg.GetMessageID())
	delete = makeInboxMsg(6, chat1.MessageType_DELETE)
	err = inbox.NewMessage(context.TODO(), uid, 7, conv.GetConvID(), delete, nil)
	require.Error(t, err)
	require.IsType(t, VersionMismatchError{}, err)

	err = inbox.NewMessage(context.TODO(), uid, 10, conv.GetConvID(), msg2, nil)
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxReadMessage(t *testing.T) {

	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	uid2, err := hex.DecodeString("22")
	require.NoError(t, err)

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	_, _, err = inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)

	conv := convs[5]
	convID := conv.GetConvID()
	msg := makeInboxMsg(2, chat1.MessageType_TEXT)
	msg.ClientHeader.Sender = uid2
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 2, conv.GetConvID(), msg, nil))
	_, res, err := inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.MaxMsgid, "wrong max msgid")
	require.Equal(t, chat1.MessageID(1), res[0].Conv.ReaderInfo.ReadMsgid, "wrong read msgid")
	require.Equal(t, gregor1.Time(0), res[0].Conv.ReaderInfo.LastSendTime)
	require.NoError(t, inbox.ReadMessage(context.TODO(), uid, 3, conv.GetConvID(), 2))
	_, res, err = inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.MaxMsgid, "wrong max msgid")
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.ReadMsgid, "wrong read msgid")
	require.Equal(t, gregor1.Time(0), res[0].Conv.ReaderInfo.LastSendTime)

	err = inbox.ReadMessage(context.TODO(), uid, 10, conv.GetConvID(), 3)
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxSetStatus(t *testing.T) {

	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	conv := convs[5]
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	require.NoError(t, inbox.SetStatus(context.TODO(), uid, 2, conv.GetConvID(),
		chat1.ConversationStatus_IGNORED))

	q := chat1.GetInboxQuery{
		Status: []chat1.ConversationStatus{chat1.ConversationStatus_IGNORED},
	}
	require.NoError(t, inbox.Merge(context.TODO(), uid, 2, []chat1.Conversation{}, &q))
	_, res, err := inbox.Read(context.TODO(), uid, &q)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "length")
	require.Equal(t, conv.GetConvID(), res[0].GetConvID(), "id")

	t.Logf("sending new message to wake up conv")
	msg := makeInboxMsg(3, chat1.MessageType_TEXT)
	msg.ClientHeader.Sender = uid
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 3, conv.GetConvID(), msg, nil))
	_, res, err = inbox.Read(context.TODO(), uid, &q)
	require.NoError(t, err)
	require.Equal(t, 0, len(res), "ignore not unset")

	err = inbox.SetStatus(context.TODO(), uid, 10, conv.GetConvID(), chat1.ConversationStatus_BLOCKED)
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxSetStatusMuted(t *testing.T) {

	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	conv := convs[5]
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	require.NoError(t, inbox.SetStatus(context.TODO(), uid, 2, conv.GetConvID(),
		chat1.ConversationStatus_MUTED))

	q := chat1.GetInboxQuery{
		Status: []chat1.ConversationStatus{chat1.ConversationStatus_MUTED},
	}
	require.NoError(t, inbox.Merge(context.TODO(), uid, 2, []chat1.Conversation{}, &q))
	_, res, err := inbox.Read(context.TODO(), uid, &q)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "length")
	require.Equal(t, conv.GetConvID(), res[0].GetConvID(), "id")

	t.Logf("sending new message to wake up conv")
	msg := makeInboxMsg(3, chat1.MessageType_TEXT)
	msg.ClientHeader.Sender = uid
	require.NoError(t, inbox.NewMessage(context.TODO(), uid, 3, conv.GetConvID(), msg, nil))
	_, res, err = inbox.Read(context.TODO(), uid, &q)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "muted wrongly unset")

	err = inbox.SetStatus(context.TODO(), uid, 10, conv.GetConvID(), chat1.ConversationStatus_BLOCKED)
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxTlfFinalize(t *testing.T) {

	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	conv := convs[5]
	convID := conv.GetConvID()
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	require.NoError(t, inbox.TlfFinalize(context.TODO(), uid, 2, []chat1.ConversationID{conv.GetConvID()},
		chat1.ConversationFinalizeInfo{ResetFull: "reset"}))
	_, res, err := inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "length")
	require.Equal(t, conv.GetConvID(), res[0].GetConvID(), "id")
	require.NotNil(t, res[0].Conv.Metadata.FinalizeInfo, "finalize info")

	err = inbox.TlfFinalize(context.TODO(), uid, 10, []chat1.ConversationID{conv.GetConvID()},
		chat1.ConversationFinalizeInfo{ResetFull: "reset"})
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxSync(t *testing.T) {
	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	_, res, err := inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)

	var syncConvs []chat1.Conversation
	convs[0].Conv.Metadata.Status = chat1.ConversationStatus_MUTED
	convs[6].Conv.Metadata.Status = chat1.ConversationStatus_MUTED
	syncConvs = append(syncConvs, convs[0].Conv)
	syncConvs = append(syncConvs, convs[6].Conv)
	newConv := makeConvo(gregor1.Time(60), 1, 1)
	syncConvs = append(syncConvs, newConv.Conv)

	vers, err := inbox.Version(context.TODO(), uid)
	require.NoError(t, err)
	syncRes, err := inbox.Sync(context.TODO(), uid, vers+1, syncConvs)
	require.NoError(t, err)
	newVers, newRes, err := inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)
	sort.Sort(ByDatabaseOrder(newRes))
	require.Equal(t, vers+1, newVers)
	require.Equal(t, len(res)+1, len(newRes))
	require.Equal(t, newConv.GetConvID(), newRes[0].GetConvID())
	require.Equal(t, chat1.ConversationStatus_MUTED, newRes[1].Conv.Metadata.Status)
	require.Equal(t, chat1.ConversationStatus_MUTED, newRes[7].Conv.Metadata.Status)
	require.Equal(t, chat1.ConversationStatus_UNFILED, newRes[4].Conv.Metadata.Status)
	require.False(t, syncRes.TeamTypeChanged)
	require.Len(t, syncRes.Expunges, 0)

	syncConvs = nil
	vers, err = inbox.Version(context.TODO(), uid)
	require.NoError(t, err)
	convs[8].Conv.Metadata.TeamType = chat1.TeamType_COMPLEX
	syncConvs = append(syncConvs, convs[8].Conv)
	convs[9].Conv.Expunge = chat1.Expunge{Upto: 3}
	syncConvs = append(syncConvs, convs[9].Conv)
	syncRes, err = inbox.Sync(context.TODO(), uid, vers+1, syncConvs)
	require.NoError(t, err)
	newVers, newRes, err = inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)
	sort.Sort(ByDatabaseOrder(newRes))
	require.Equal(t, vers+1, newVers)
	require.Equal(t, chat1.TeamType_COMPLEX, newRes[9].Conv.Metadata.TeamType)
	require.True(t, syncRes.TeamTypeChanged)
	require.Len(t, syncRes.Expunges, 1)
	require.True(t, convs[9].Conv.GetConvID().Eq(syncRes.Expunges[0].ConvID))
	require.Equal(t, convs[9].Conv.Expunge, syncRes.Expunges[0].Expunge)
}

func TestInboxServerVersion(t *testing.T) {
	tc, inbox, uid := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	_, res, err := inbox.Read(context.TODO(), uid, nil)
	require.NoError(t, err)
	require.Equal(t, numConvs, len(res))

	// Increase server version
	cerr := tc.Context().ServerCacheVersions.Set(context.TODO(), chat1.ServerCacheVers{
		InboxVers: 5,
	})
	require.NoError(t, cerr)

	_, _, err = inbox.Read(context.TODO(), uid, nil)
	require.Error(t, err)
	require.IsType(t, MissError{}, err)

	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	idata, err := inbox.readDiskVersions(context.TODO(), uid, true)
	require.NoError(t, err)
	require.Equal(t, 5, idata.ServerVersion)
}

func TestInboxKBFSUpgrade(t *testing.T) {
	tc, inbox, uid := setupInboxTest(t, "kbfs")
	defer tc.Cleanup()
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}
	conv := convs[5]
	convID := conv.GetConvID()
	require.Equal(t, chat1.ConversationMembersType_KBFS, conv.Conv.GetMembersType())
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	require.NoError(t, inbox.UpgradeKBFSToImpteam(context.TODO(), uid, 2, conv.GetConvID()))
	_, res, err := inbox.Read(context.TODO(), uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "length")
	require.Equal(t, conv.GetConvID(), res[0].GetConvID(), "id")
	require.Equal(t, chat1.ConversationMembersType_IMPTEAMUPGRADE, res[0].Conv.Metadata.MembersType)
}

func makeUID(t *testing.T) gregor1.UID {
	b, err := libkb.RandBytes(16)
	require.NoError(t, err)
	return gregor1.UID(b)
}

func TestInboxMembershipDupUpdate(t *testing.T) {
	ctc, inbox, uid := setupInboxTest(t, "membership")
	defer ctc.Cleanup()

	uid2 := makeUID(t)
	conv := makeConvo(gregor1.Time(1), 1, 1)
	conv.Conv.Metadata.AllList = []gregor1.UID{uid, uid2}
	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, []chat1.Conversation{conv.Conv}, nil))

	otherJoinedConvs := []chat1.ConversationMember{{
		Uid:    uid2,
		ConvID: conv.GetConvID(),
	}}
	roleUpdates, err := inbox.MembershipUpdate(context.TODO(), uid, 2, []chat1.Conversation{conv.Conv},
		nil, otherJoinedConvs, nil, nil, nil, nil)
	require.NoError(t, err)
	require.Nil(t, roleUpdates)

	_, res, err := inbox.ReadAll(context.TODO(), uid, true)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, 2, len(res[0].Conv.Metadata.AllList))
}

func TestInboxMembershipUpdate(t *testing.T) {
	ctc, inbox, uid := setupInboxTest(t, "membership")
	defer ctc.Cleanup()

	u2, err := kbtest.CreateAndSignupFakeUser("ib", ctc.G)
	require.NoError(t, err)
	uid2 := gregor1.UID(u2.User.GetUID().ToBytes())

	u3, err := kbtest.CreateAndSignupFakeUser("ib", ctc.G)
	require.NoError(t, err)
	uid3 := gregor1.UID(u3.User.GetUID().ToBytes())

	u4, err := kbtest.CreateAndSignupFakeUser("ib", ctc.G)
	require.NoError(t, err)
	uid4 := gregor1.UID(u4.User.GetUID().ToBytes())

	t.Logf("uid: %s uid2: %s uid3: %s uid4: %s", uid, uid2, uid3, uid4)

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	tlfID := makeTlfID()
	for i := numConvs - 1; i >= 0; i-- {
		conv := makeConvo(gregor1.Time(i), 1, 1)
		conv.Conv.Metadata.IdTriple.Tlfid = tlfID
		conv.Conv.Metadata.AllList = []gregor1.UID{uid, uid3, uid4}
		convs = append(convs, conv)
	}

	require.NoError(t, inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil))
	var joinedConvs []types.RemoteConversation
	numJoinedConvs := 5
	for i := 0; i < numJoinedConvs; i++ {
		conv := makeConvo(gregor1.Time(i), 1, 1)
		conv.Conv.Metadata.IdTriple.Tlfid = tlfID
		conv.Conv.Metadata.AllList = []gregor1.UID{uid, uid3, uid4}
		joinedConvs = append(joinedConvs, conv)
	}

	otherJoinConvID := convs[0].GetConvID()
	otherJoinedConvs := []chat1.ConversationMember{{
		Uid:    uid2,
		ConvID: otherJoinConvID,
	}}
	otherRemovedConvID := convs[1].GetConvID()
	otherRemovedConvs := []chat1.ConversationMember{{
		Uid:    uid3,
		ConvID: otherRemovedConvID,
	}}
	otherResetConvID := convs[2].GetConvID()
	otherResetConvs := []chat1.ConversationMember{{
		Uid:    uid4,
		ConvID: otherResetConvID,
	}}
	userRemovedConvID := convs[5].GetConvID()
	userRemovedConvs := []chat1.ConversationMember{{
		Uid:    uid,
		ConvID: userRemovedConvID,
	}}
	userResetConvID := convs[6].GetConvID()
	userResetConvs := []chat1.ConversationMember{{
		Uid:    uid,
		ConvID: userResetConvID,
	}}

	roleUpdates, err := inbox.MembershipUpdate(context.TODO(), uid, 2, utils.PluckConvs(joinedConvs),
		userRemovedConvs, otherJoinedConvs, otherRemovedConvs,
		userResetConvs, otherResetConvs, &chat1.TeamMemberRoleUpdate{
			TlfID: tlfID,
			Role:  keybase1.TeamRole_WRITER,
		})
	require.NoError(t, err)
	require.NotNil(t, roleUpdates)

	vers, res, err := inbox.ReadAll(context.TODO(), uid, true)
	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(2), vers)
	for i, c := range res {
		// make sure we bump the local version during the membership update for a role change
		require.EqualValues(t, 1, c.Conv.Metadata.LocalVersion)
		res[i].Conv.Metadata.LocalVersion = 0 // zero it out for later equality checks
		if c.GetConvID().Eq(convs[5].GetConvID()) {
			require.Equal(t, chat1.ConversationMemberStatus_LEFT, c.Conv.ReaderInfo.Status)
			require.Equal(t, keybase1.TeamRole_WRITER, c.Conv.ReaderInfo.UntrustedTeamRole)
			convs[5].Conv.ReaderInfo.Status = chat1.ConversationMemberStatus_LEFT
			convs[5].Conv.Metadata.Version = chat1.ConversationVers(2)
		} else if c.GetConvID().Eq(convs[6].GetConvID()) {
			require.Equal(t, chat1.ConversationMemberStatus_RESET, c.Conv.ReaderInfo.Status)
			require.Equal(t, keybase1.TeamRole_WRITER, c.Conv.ReaderInfo.UntrustedTeamRole)
			convs[6].Conv.ReaderInfo.Status = chat1.ConversationMemberStatus_RESET
			convs[6].Conv.Metadata.Version = chat1.ConversationVers(2)
		}
	}
	expected := append(convs, joinedConvs...)
	sort.Sort(utils.RemoteConvByConvID(expected))
	sort.Sort(utils.ByConvID(roleUpdates))
	sort.Sort(utils.RemoteConvByConvID(res))
	require.Equal(t, len(expected), len(res))
	for i := 0; i < len(res); i++ {
		sort.Sort(chat1.ByUID(res[i].Conv.Metadata.AllList))
		sort.Sort(chat1.ByUID(expected[i].Conv.Metadata.AllList))
		require.Equal(t, keybase1.TeamRole_WRITER, res[i].Conv.ReaderInfo.UntrustedTeamRole)
		require.True(t, expected[i].GetConvID().Eq(roleUpdates[i]))
		if res[i].GetConvID().Eq(otherJoinConvID) {
			allUsers := []gregor1.UID{uid, uid2, uid3, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
			require.Zero(t, len(res[i].Conv.Metadata.ResetList))
		} else if res[i].GetConvID().Eq(otherRemovedConvID) {
			allUsers := []gregor1.UID{uid, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
			require.Zero(t, len(res[i].Conv.Metadata.ResetList))
		} else if res[i].GetConvID().Eq(otherResetConvID) {
			allUsers := []gregor1.UID{uid, uid3, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			resetUsers := []gregor1.UID{uid4}
			require.Len(t, res[i].Conv.Metadata.AllList, len(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
			require.Equal(t, resetUsers, res[i].Conv.Metadata.ResetList)
		} else if res[i].GetConvID().Eq(userRemovedConvID) {
			allUsers := []gregor1.UID{uid3, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			require.Len(t, res[i].Conv.Metadata.AllList, len(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
			require.Zero(t, len(res[i].Conv.Metadata.ResetList))
		} else if res[i].GetConvID().Eq(userResetConvID) {
			allUsers := []gregor1.UID{uid, uid3, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			resetUsers := []gregor1.UID{uid}
			require.Len(t, res[i].Conv.Metadata.AllList, len(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
			require.Equal(t, resetUsers, res[i].Conv.Metadata.ResetList)
		} else {
			allUsers := []gregor1.UID{uid, uid3, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
			expected[i].Conv.ReaderInfo.UntrustedTeamRole = keybase1.TeamRole_WRITER
			require.Equal(t, expected[i], res[i])
		}
	}
}

// TestInboxCacheOnLogout checks that calling OnLogout() clears the cache.
func TestInboxCacheOnLogout(t *testing.T) {
	uid := keybase1.MakeTestUID(3)
	inboxMemCache.PutVersions(gregor1.UID(uid), &inboxDiskVersions{})
	require.NotEmpty(t, len(inboxMemCache.versMap))
	err := inboxMemCache.OnLogout(libkb.NewMetaContextTODO(nil))
	require.NoError(t, err)
	require.Nil(t, inboxMemCache.GetVersions(gregor1.UID(uid)))
	require.Empty(t, len(inboxMemCache.versMap))
}

func TestUpdateLocalMtime(t *testing.T) {
	tc, inbox, uid := setupInboxTest(t, "local conv")
	defer tc.Cleanup()
	convs := []types.RemoteConversation{
		makeConvo(gregor1.Time(1), 1, 1),
		makeConvo(gregor1.Time(0), 1, 1),
	}
	err := inbox.Merge(context.TODO(), uid, 1, utils.PluckConvs(convs), nil)
	require.NoError(t, err)
	mtime1 := gregor1.Time(5)
	mtime2 := gregor1.Time(1)
	err = inbox.UpdateLocalMtime(context.TODO(), uid, []chat1.LocalMtimeUpdate{
		{
			ConvID: convs[0].GetConvID(),
			Mtime:  mtime1,
		},
		{
			ConvID: convs[1].GetConvID(),
			Mtime:  mtime2,
		},
	})
	require.NoError(t, err)

	diskIndex, err := inbox.readDiskIndex(context.TODO(), uid, true)
	require.NoError(t, err)
	convs = nil
	for _, convID := range diskIndex.ConversationIDs {
		conv, err := inbox.readConv(context.TODO(), uid, convID)
		require.NoError(t, err)
		convs = append(convs, conv)
	}

	sort.Slice(convs, func(i, j int) bool {
		return convs[i].GetMtime() > convs[j].GetMtime()
	})
	require.Equal(t, mtime1, convs[0].GetMtime())
	require.Equal(t, mtime2, convs[1].GetMtime())
}
