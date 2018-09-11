package storage

import (
	"context"
	"fmt"
	"runtime"
	"sort"
	"strings"
	"testing"

	"encoding/hex"

	"github.com/keybase/client/go/chat/globals"
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
	ltc := setupCommonTest(t, name)

	tc := kbtest.ChatTestContext{
		TestContext: ltc,
		ChatG:       &globals.ChatContext{},
	}
	tc.Context().ServerCacheVersions = NewServerVersions(tc.Context())
	u, err := kbtest.CreateAndSignupFakeUser("ib", ltc.G)
	require.NoError(t, err)
	uid := gregor1.UID(u.User.GetUID().ToBytes())
	return tc, NewInbox(tc.Context(), uid), uid
}

func makeTlfID() chat1.TLFID {
	return randBytes(8)
}

func makeConvo(mtime gregor1.Time, rmsg chat1.MessageID, mmsg chat1.MessageID) types.RemoteConversation {
	c := types.RemoteConversation{
		Conv: chat1.Conversation{
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
			MaxMsgSummaries: []chat1.MessageSummary{{MessageType: chat1.MessageType_TEXT}},
		},
	}
	return c
}

func makeInboxMsg(id chat1.MessageID, typ chat1.MessageType) chat1.MessageBoxed {
	return chat1.MessageBoxed{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: typ,
		},
		ServerHeader: &chat1.MessageServerHeader{
			MessageID: id,
		},
	}
}

func convListCompare(t *testing.T, l []types.RemoteConversation, r []types.RemoteConversation, name string) {
	require.Equal(t, len(l), len(r), name+" size mismatch")
	for i := 0; i < len(l); i++ {
		t.Logf("convListCompare: l: %s(%d) r: %s(%d)", l[i].GetConvID(), l[i].GetMtime(),
			r[i].GetConvID(), r[i].GetMtime())
		require.Equal(t, l[i], r[i], name+" mismatch")
	}
}

func TestInboxBasic(t *testing.T) {

	tc, inbox, _ := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	// Fetch with no query parameter
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	vers, res, _, err := inbox.Read(context.TODO(), nil, nil)

	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(1), vers, "version mismatch")
	convListCompare(t, convs, res, "basic")
	require.Equal(t, gregor1.Time(numConvs-1), res[0].GetMtime(), "order wrong")

	// Fetch half of the messages (expect miss on first try)
	_, _, _, err = inbox.Read(context.TODO(), nil, &chat1.Pagination{
		Num: numConvs / 2,
	})
	require.IsType(t, MissError{}, err, "expected miss error")
	require.NoError(t, inbox.Merge(context.TODO(), 2, utils.PluckConvs(convs), nil, &chat1.Pagination{
		Num: numConvs / 2,
	}))
	vers, res, _, err = inbox.Read(context.TODO(), nil, &chat1.Pagination{
		Num: numConvs / 2,
	})
	require.NoError(t, err)
	// Merge in of 2 doesn't do anything, we still think we are at version 1 of the whole box
	require.Equal(t, chat1.InboxVers(1), vers, "version mismatch")
	convListCompare(t, convs[:numConvs/2], res, "half")
}

func TestInboxSummarize(t *testing.T) {
	tc, inbox, _ := setupInboxTest(t, "summarize")
	defer tc.Cleanup()

	conv := makeConvo(gregor1.Time(1), 1, 1)
	maxMsgID := chat1.MessageID(6)
	conv.Conv.MaxMsgs = []chat1.MessageBoxed{chat1.MessageBoxed{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: chat1.MessageType_TEXT,
		},
		ServerHeader: &chat1.MessageServerHeader{
			MessageID: maxMsgID,
		},
	}}

	require.NoError(t, inbox.Merge(context.TODO(), 1, []chat1.Conversation{conv.Conv}, nil, nil))
	_, res, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Zero(t, len(res[0].Conv.MaxMsgs))
	require.Equal(t, 1, len(res[0].Conv.MaxMsgSummaries))
	require.Equal(t, maxMsgID, res[0].Conv.MaxMsgSummaries[0].GetMessageID())
}

func TestInboxQueries(t *testing.T) {
	tc, inbox, _ := setupInboxTest(t, "queries")
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
		ri.MaxMsgid = 5
		ri.ReadMsgid = 3
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

	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))

	// Merge in queries and try to read them back out
	var q *chat1.GetInboxQuery
	mergeReadAndCheck := func(t *testing.T, ref []types.RemoteConversation, name string) {
		require.NoError(t, inbox.Merge(context.TODO(), 1, []chat1.Conversation{}, q, nil))
		_, res, _, err := inbox.Read(context.TODO(), q, nil)
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
	_, cres, _, err := inbox.Read(context.TODO(), q, nil)
	require.NoError(t, err)
	require.Equal(t, before, cres)
}

func TestInboxEmptySuperseder(t *testing.T) {
	tc, inbox, _ := setupInboxTest(t, "queries")
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

	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))

	// Merge in queries and try to read them back out
	var q *chat1.GetInboxQuery
	mergeReadAndCheck := func(t *testing.T, ref []types.RemoteConversation, name string) {
		require.NoError(t, inbox.Merge(context.TODO(), 1, []chat1.Conversation{}, q, nil))
		_, res, _, err := inbox.Read(context.TODO(), q, nil)
		require.NoError(t, err)
		convListCompare(t, ref, res, name)
	}
	t.Logf("merging all convs with nil query")
	q = nil
	mergeReadAndCheck(t, full, "all")

	t.Logf("merging empty superseder query")
	// Don't skip the superseded one, since it's not supposed to be filtered out
	// by an empty superseder
	for _, conv := range full {
		superseded = append(superseded, conv)
	}
	q = &chat1.GetInboxQuery{}
	// OneChatTypePerTLF
	t.Logf("full has %d, superseded has %d", len(full), len(superseded))

	mergeReadAndCheck(t, superseded, "superseded")

	// Now test OneChatTypePerTLF
	tc, inbox, _ = setupInboxTest(t, "queries2")
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
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(full), nil, nil))
	for _, conv := range full {
		superseded = append(superseded, conv)
	}
	oneChatTypePerTLF := false
	q = &chat1.GetInboxQuery{OneChatTypePerTLF: &oneChatTypePerTLF}
	mergeReadAndCheck(t, superseded, "superseded")

}

func TestInboxPagination(t *testing.T) {

	tc, inbox, _ := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 50
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}
	firstPage := convs[:10]
	secondPage := convs[10:20]
	thirdPage := convs[20:35]

	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))

	// Get first page
	t.Logf("first page")
	require.NoError(t, inbox.Merge(context.TODO(), 1, []chat1.Conversation{}, nil, &chat1.Pagination{
		Num: 10,
	}))
	_, res, p, err := inbox.Read(context.TODO(), nil, &chat1.Pagination{
		Num: 10,
	})
	require.NoError(t, err)
	require.Equal(t, 10, p.Num, "wrong pagination number")
	convListCompare(t, firstPage, res, "first page")

	// Get the second page
	t.Logf("second page")
	require.NoError(t, inbox.Merge(context.TODO(), 1, []chat1.Conversation{}, nil, &chat1.Pagination{
		Num:  10,
		Next: p.Next,
	}))
	_, res, p, err = inbox.Read(context.TODO(), nil, &chat1.Pagination{
		Num:  10,
		Next: p.Next,
	})
	require.NoError(t, err)
	require.Equal(t, 10, p.Num, "wrong pagination number")
	convListCompare(t, secondPage, res, "second page")

	// Get the third page
	t.Logf("third page")
	require.NoError(t, inbox.Merge(context.TODO(), 1, []chat1.Conversation{}, nil, &chat1.Pagination{
		Num:  15,
		Next: p.Next,
	}))
	_, res, p, err = inbox.Read(context.TODO(), nil, &chat1.Pagination{
		Num:  15,
		Next: p.Next,
	})
	require.NoError(t, err)
	require.Equal(t, 15, p.Num, "wrong pagination number")
	convListCompare(t, thirdPage, res, "third page")

	// Get the second page (through prev)
	t.Logf("second page (redux)")
	require.NoError(t, inbox.Merge(context.TODO(), 1, []chat1.Conversation{}, nil, &chat1.Pagination{
		Num:      10,
		Previous: p.Previous,
	}))
	_, res, p, err = inbox.Read(context.TODO(), nil, &chat1.Pagination{
		Num:      10,
		Previous: p.Previous,
	})
	require.NoError(t, err)
	require.Equal(t, 10, p.Num, "wrong pagination number")
	convListCompare(t, secondPage, res, "second page (redux)")

}

func validateBadUpdate(t *testing.T, inbox *Inbox, f func() error) {
	require.IsType(t, VersionMismatchError{}, f())
	_, _, _, err := inbox.Read(context.TODO(), nil, nil)
	require.IsType(t, MissError{}, err)
}

func TestInboxNewConversation(t *testing.T) {
	tc, inbox, _ := setupInboxTest(t, "basic")
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
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	newConv := makeConvo(gregor1.Time(11), 1, 1)
	require.NoError(t, inbox.NewConversation(context.TODO(), 2, newConv.Conv))
	_, res, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	convs = append([]types.RemoteConversation{newConv}, convs...)
	convListCompare(t, convs, res, "newconv")

	t.Logf("repeat conv")
	require.NoError(t, inbox.NewConversation(context.TODO(), 3, newConv.Conv))
	_, res, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	convListCompare(t, convs, res, "repeatconv")

	t.Logf("supersede newconv")
	newConv = makeConvo(gregor1.Time(12), 1, 1)
	newConv.Conv.Metadata.Supersedes = append(newConv.Conv.Metadata.Supersedes, convs[6].Conv.Metadata)
	require.NoError(t, inbox.NewConversation(context.TODO(), 4, newConv.Conv))
	_, res, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	convs = append([]types.RemoteConversation{newConv}, convs...)
	convListCompare(t, append(convs[:7], convs[8:]...), res, "newconv finalized")

	require.Equal(t, numConvs+2, len(convs), "n convs")

	err = inbox.NewConversation(context.TODO(), 10, newConv.Conv)
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
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	_, res, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, convs[0].GetConvID(), res[0].GetConvID(), "conv not promoted")
	require.NoError(t, inbox.NewMessage(context.TODO(), 2, conv.GetConvID(), msg, nil))
	_, res, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, conv.GetConvID(), res[0].GetConvID(), "conv not promoted")
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.MaxMsgid, "wrong max msgid")
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.ReadMsgid, "wrong read msgid")
	require.Equal(t, []gregor1.UID{uid1, uid2, uid3}, res[0].Conv.Metadata.ActiveList, "active list")
	maxMsg, err := res[0].Conv.GetMaxMessage(chat1.MessageType_TEXT)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(2), maxMsg.GetMessageID(), "max msg not updated")

	// Test incomplete active list
	conv = convs[6]
	require.NoError(t, inbox.NewMessage(context.TODO(), 3, conv.GetConvID(), msg, nil))
	_, res, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, []gregor1.UID{uid1, uid2, uid3}, res[0].Conv.Metadata.ActiveList, "active list")

	// Send another one from a diff User
	msg = makeInboxMsg(3, chat1.MessageType_TEXT)
	msg.ClientHeader.Sender = uid2
	require.NoError(t, inbox.NewMessage(context.TODO(), 4, conv.GetConvID(), msg, nil))
	_, res, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(3), res[0].Conv.ReaderInfo.MaxMsgid, "wrong max msgid")
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.ReadMsgid, "wrong read msgid")
	require.Equal(t, []gregor1.UID{uid2, uid1, uid3}, res[0].Conv.Metadata.ActiveList, "active list")
	maxMsg, err = res[0].Conv.GetMaxMessage(chat1.MessageType_TEXT)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(3), maxMsg.GetMessageID())

	// Test delete mechanics
	delMsg := makeInboxMsg(4, chat1.MessageType_TEXT)
	require.NoError(t, inbox.NewMessage(context.TODO(), 5, conv.GetConvID(), delMsg, nil))
	_, res, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	maxMsg, err = res[0].Conv.GetMaxMessage(chat1.MessageType_TEXT)
	require.NoError(t, err)
	require.Equal(t, delMsg.GetMessageID(), maxMsg.GetMessageID())
	delete := makeInboxMsg(5, chat1.MessageType_DELETE)
	require.NoError(t, inbox.NewMessage(context.TODO(), 0, conv.GetConvID(), delete, nil))
	require.NoError(t, inbox.NewMessage(context.TODO(), 6, conv.GetConvID(), delete,
		[]chat1.MessageSummary{msg.Summary()}))
	_, res, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	maxMsg, err = res[0].Conv.GetMaxMessage(chat1.MessageType_TEXT)
	require.NoError(t, err)
	require.Equal(t, msg.GetMessageID(), maxMsg.GetMessageID())
	delete = makeInboxMsg(6, chat1.MessageType_DELETE)
	err = inbox.NewMessage(context.TODO(), 7, conv.GetConvID(), delete, nil)
	require.Error(t, err)
	require.IsType(t, VersionMismatchError{}, err)

	err = inbox.NewMessage(context.TODO(), 10, conv.GetConvID(), msg, nil)
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxReadMessage(t *testing.T) {

	tc, inbox, _ := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	uid2, err := hex.DecodeString("22")
	require.NoError(t, err)

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	_, _, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)

	conv := convs[5]
	msg := makeInboxMsg(2, chat1.MessageType_TEXT)
	msg.ClientHeader.Sender = uid2
	require.NoError(t, inbox.NewMessage(context.TODO(), 2, conv.GetConvID(), msg, nil))
	_, res, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.MaxMsgid, "wrong max msgid")
	require.Equal(t, chat1.MessageID(1), res[0].Conv.ReaderInfo.ReadMsgid, "wrong read msgid")
	require.NoError(t, inbox.ReadMessage(context.TODO(), 3, conv.GetConvID(), 2))
	_, res, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.MaxMsgid, "wrong max msgid")
	require.Equal(t, chat1.MessageID(2), res[0].Conv.ReaderInfo.ReadMsgid, "wrong read msgid")

	err = inbox.ReadMessage(context.TODO(), 10, conv.GetConvID(), 3)
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
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	require.NoError(t, inbox.SetStatus(context.TODO(), 2, conv.GetConvID(),
		chat1.ConversationStatus_IGNORED))

	q := chat1.GetInboxQuery{
		Status: []chat1.ConversationStatus{chat1.ConversationStatus_IGNORED},
	}
	require.NoError(t, inbox.Merge(context.TODO(), 2, []chat1.Conversation{}, &q, nil))
	_, res, _, err := inbox.Read(context.TODO(), &q, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "length")
	require.Equal(t, conv.GetConvID(), res[0].GetConvID(), "id")

	t.Logf("sending new message to wake up conv")
	msg := makeInboxMsg(3, chat1.MessageType_TEXT)
	msg.ClientHeader.Sender = uid
	require.NoError(t, inbox.NewMessage(context.TODO(), 3, conv.GetConvID(), msg, nil))
	_, res, _, err = inbox.Read(context.TODO(), &q, nil)
	require.NoError(t, err)
	require.Equal(t, 0, len(res), "ignore not unset")

	err = inbox.SetStatus(context.TODO(), 10, conv.GetConvID(), chat1.ConversationStatus_BLOCKED)
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
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	require.NoError(t, inbox.SetStatus(context.TODO(), 2, conv.GetConvID(),
		chat1.ConversationStatus_MUTED))

	q := chat1.GetInboxQuery{
		Status: []chat1.ConversationStatus{chat1.ConversationStatus_MUTED},
	}
	require.NoError(t, inbox.Merge(context.TODO(), 2, []chat1.Conversation{}, &q, nil))
	_, res, _, err := inbox.Read(context.TODO(), &q, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "length")
	require.Equal(t, conv.GetConvID(), res[0].GetConvID(), "id")

	t.Logf("sending new message to wake up conv")
	msg := makeInboxMsg(3, chat1.MessageType_TEXT)
	msg.ClientHeader.Sender = uid
	require.NoError(t, inbox.NewMessage(context.TODO(), 3, conv.GetConvID(), msg, nil))
	_, res, _, err = inbox.Read(context.TODO(), &q, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "muted wrongly unset")

	err = inbox.SetStatus(context.TODO(), 10, conv.GetConvID(), chat1.ConversationStatus_BLOCKED)
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxTlfFinalize(t *testing.T) {

	tc, inbox, _ := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	conv := convs[5]
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	require.NoError(t, inbox.TlfFinalize(context.TODO(), 2, []chat1.ConversationID{conv.GetConvID()},
		chat1.ConversationFinalizeInfo{ResetFull: "reset"}))
	_, res, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(convs), len(res), "length")
	require.Equal(t, conv.GetConvID(), res[5].GetConvID(), "id")
	require.NotNil(t, res[5].Conv.Metadata.FinalizeInfo, "finalize info")

	err = inbox.TlfFinalize(context.TODO(), 10, []chat1.ConversationID{conv.GetConvID()},
		chat1.ConversationFinalizeInfo{ResetFull: "reset"})
	require.IsType(t, VersionMismatchError{}, err)
}

func TestInboxSync(t *testing.T) {
	tc, inbox, _ := setupInboxTest(t, "basic")
	defer tc.Cleanup()

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	_, res, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)

	var syncConvs []chat1.Conversation
	convs[0].Conv.Metadata.Status = chat1.ConversationStatus_MUTED
	convs[6].Conv.Metadata.Status = chat1.ConversationStatus_MUTED
	syncConvs = append(syncConvs, convs[0].Conv)
	syncConvs = append(syncConvs, convs[6].Conv)
	newConv := makeConvo(gregor1.Time(60), 1, 1)
	syncConvs = append(syncConvs, newConv.Conv)

	vers, err := inbox.Version(context.TODO())
	require.NoError(t, err)
	syncRes, err := inbox.Sync(context.TODO(), vers+1, syncConvs)
	require.NoError(t, err)
	newVers, newRes, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, vers+1, newVers)
	require.Equal(t, len(res)+1, len(newRes))
	require.Equal(t, newConv.GetConvID(), newRes[0].GetConvID())
	require.Equal(t, chat1.ConversationStatus_MUTED, newRes[1].Conv.Metadata.Status)
	require.Equal(t, chat1.ConversationStatus_MUTED, newRes[7].Conv.Metadata.Status)
	require.Equal(t, chat1.ConversationStatus_UNFILED, newRes[4].Conv.Metadata.Status)
	require.False(t, syncRes.TeamTypeChanged)
	require.Len(t, syncRes.Expunges, 0)

	syncConvs = nil
	vers, err = inbox.Version(context.TODO())
	require.NoError(t, err)
	convs[8].Conv.Metadata.TeamType = chat1.TeamType_COMPLEX
	syncConvs = append(syncConvs, convs[8].Conv)
	convs[9].Conv.Expunge = chat1.Expunge{Upto: 3}
	syncConvs = append(syncConvs, convs[9].Conv)
	syncRes, err = inbox.Sync(context.TODO(), vers+1, syncConvs)
	require.NoError(t, err)
	newVers, newRes, _, err = inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, vers+1, newVers)
	require.Equal(t, chat1.TeamType_COMPLEX, newRes[9].Conv.Metadata.TeamType)
	require.True(t, syncRes.TeamTypeChanged)
	require.Len(t, syncRes.Expunges, 1)
	require.True(t, convs[9].Conv.GetConvID().Eq(syncRes.Expunges[0].ConvID))
	require.Equal(t, convs[9].Conv.Expunge, syncRes.Expunges[0].Expunge)
}

func TestInboxServerVersion(t *testing.T) {
	tc, inbox, _ := setupInboxTest(t, "basic")

	// Create an inbox with a bunch of convos, merge it and read it back out
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}

	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	_, res, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, numConvs, len(res))

	// Increase server version
	cerr := tc.Context().ServerCacheVersions.Set(context.TODO(), chat1.ServerCacheVers{
		InboxVers: 5,
	})
	require.NoError(t, cerr)

	_, _, _, err = inbox.Read(context.TODO(), nil, nil)
	require.Error(t, err)
	require.IsType(t, MissError{}, err)

	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	idata, err := inbox.readDiskInbox(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 5, idata.ServerVersion)
}

func TestInboxKBFSUpgrade(t *testing.T) {
	tc, inbox, _ := setupInboxTest(t, "kbfs")
	defer tc.Cleanup()
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		convs = append(convs, makeConvo(gregor1.Time(i), 1, 1))
	}
	conv := convs[5]
	require.Equal(t, chat1.ConversationMembersType_KBFS, conv.Conv.GetMembersType())
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	require.NoError(t, inbox.UpgradeKBFSToImpteam(context.TODO(), 2, conv.GetConvID()))
	_, res, _, err := inbox.Read(context.TODO(), nil, nil)
	require.NoError(t, err)
	require.Equal(t, len(convs), len(res), "length")
	require.Equal(t, conv.GetConvID(), res[5].GetConvID(), "id")
	require.Equal(t, chat1.ConversationMembersType_IMPTEAMUPGRADE, res[5].Conv.Metadata.MembersType)
}

func TestMobileSharedInbox(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip()
	}
	tc, inbox, _ := setupInboxTest(t, "shared")
	defer tc.Cleanup()
	tc.G.Env = libkb.NewEnv(libkb.AppConfig{
		HomeDir:             tc.Context().GetEnv().GetHome(),
		MobileSharedHomeDir: "x",
	}, nil, tc.Context().GetLog)
	numConvs := 10
	var convs []types.RemoteConversation
	for i := numConvs - 1; i >= 0; i-- {
		conv := makeConvo(gregor1.Time(i), 1, 1)
		if i == 5 {
			conv.Conv.Metadata.TeamType = chat1.TeamType_COMPLEX
			conv.Conv.MaxMsgSummaries[0].TlfName = "team"
		} else {
			conv.Conv.MaxMsgSummaries[0].TlfName = fmt.Sprintf("msg:%d", i)
		}
		convs = append(convs, conv)
	}
	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	diskIbox, err := inbox.readDiskInbox(context.TODO())
	require.NoError(t, err)
	diskIbox.Conversations[4].LocalMetadata = &types.RemoteConversationMetadata{
		TopicName: "mike",
	}
	require.NoError(t, inbox.writeDiskInbox(context.TODO(), diskIbox))
	sharedInbox, err := inbox.ReadShared(context.TODO())
	require.NoError(t, err)
	require.Equal(t, numConvs, len(sharedInbox))
	convs = diskIbox.Conversations
	for i := 0; i < numConvs; i++ {
		require.Equal(t, convs[i].GetConvID().String(), sharedInbox[i].ConvID)
		require.Equal(t, convs[i].GetName(), sharedInbox[i].Name)
		if i == 4 {
			require.True(t, strings.Contains(sharedInbox[i].Name, "#"))
		}
	}
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
	for i := numConvs - 1; i >= 0; i-- {
		conv := makeConvo(gregor1.Time(i), 1, 1)
		conv.Conv.Metadata.AllList = []gregor1.UID{uid, uid3, uid4}
		convs = append(convs, conv)
	}

	require.NoError(t, inbox.Merge(context.TODO(), 1, utils.PluckConvs(convs), nil, nil))
	var joinedConvs []types.RemoteConversation
	numJoinedConvs := 5
	for i := 0; i < numJoinedConvs; i++ {
		conv := makeConvo(gregor1.Time(i), 1, 1)
		conv.Conv.Metadata.AllList = []gregor1.UID{uid, uid3, uid4}
		joinedConvs = append(joinedConvs, conv)
	}

	otherJoinConvID := convs[0].GetConvID()
	otherJoinedConvs := []chat1.ConversationMember{chat1.ConversationMember{
		Uid:    uid2,
		ConvID: otherJoinConvID,
	}}
	otherRemovedConvID := convs[1].GetConvID()
	otherRemovedConvs := []chat1.ConversationMember{chat1.ConversationMember{
		Uid:    uid3,
		ConvID: otherRemovedConvID,
	}}
	otherResetConvID := convs[2].GetConvID()
	otherResetConvs := []chat1.ConversationMember{chat1.ConversationMember{
		Uid:    uid4,
		ConvID: otherResetConvID,
	}}
	userRemovedConvs := []chat1.ConversationMember{chat1.ConversationMember{
		Uid:    uid,
		ConvID: convs[5].GetConvID(),
	}}
	userResetConvs := []chat1.ConversationMember{chat1.ConversationMember{
		Uid:    uid,
		ConvID: convs[6].GetConvID(),
	}}
	require.NoError(t, inbox.MembershipUpdate(context.TODO(), 2, utils.PluckConvs(joinedConvs),
		userRemovedConvs, otherJoinedConvs, otherRemovedConvs,
		userResetConvs, otherResetConvs))

	vers, res, err := inbox.ReadAll(context.TODO())
	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(2), vers)
	for _, c := range res {
		if c.GetConvID().Eq(convs[5].GetConvID()) {
			require.Equal(t, chat1.ConversationMemberStatus_LEFT, c.Conv.ReaderInfo.Status)
			convs[5].Conv.ReaderInfo.Status = chat1.ConversationMemberStatus_LEFT
			convs[5].Conv.Metadata.Version = chat1.ConversationVers(2)
		}
		if c.GetConvID().Eq(convs[6].GetConvID()) {
			require.Equal(t, chat1.ConversationMemberStatus_RESET, c.Conv.ReaderInfo.Status)
			convs[6].Conv.ReaderInfo.Status = chat1.ConversationMemberStatus_RESET
			convs[6].Conv.Metadata.Version = chat1.ConversationVers(2)
		}
	}
	expected := append(convs, joinedConvs...)
	sort.Sort(utils.RemoteConvByConvID(expected))
	sort.Sort(utils.RemoteConvByConvID(res))
	require.Equal(t, len(expected), len(res))
	for i := 0; i < len(res); i++ {
		sort.Sort(chat1.ByUID(res[i].Conv.Metadata.AllList))
		sort.Sort(chat1.ByUID(expected[i].Conv.Metadata.AllList))
		if res[i].GetConvID().Eq(otherJoinConvID) {
			allUsers := []gregor1.UID{uid, uid2, uid3, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
		} else if res[i].GetConvID().Eq(otherRemovedConvID) {
			allUsers := []gregor1.UID{uid, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
		} else if res[i].GetConvID().Eq(otherResetConvID) {
			allUsers := []gregor1.UID{uid, uid3, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			resetUsers := []gregor1.UID{uid4}
			require.Len(t, res[i].Conv.Metadata.AllList, len(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
			require.Equal(t, resetUsers, res[i].Conv.Metadata.ResetList)
		} else {
			allUsers := []gregor1.UID{uid, uid3, uid4}
			sort.Sort(chat1.ByUID(allUsers))
			require.Equal(t, allUsers, res[i].Conv.Metadata.AllList)
			require.Equal(t, expected[i], res[i])
		}
	}
}

// TestInboxCacheOnLogout checks that calling OnLogout() clears the cache.
func TestInboxCacheOnLogout(t *testing.T) {
	uid := keybase1.MakeTestUID(3)
	inboxMemCache.Put(gregor1.UID(uid), &inboxDiskData{})
	require.NotEmpty(t, len(inboxMemCache.datMap))
	err := inboxMemCache.OnLogout()
	require.NoError(t, err)
	require.Nil(t, inboxMemCache.Get(gregor1.UID(uid)))
	require.Empty(t, len(inboxMemCache.datMap))
}
