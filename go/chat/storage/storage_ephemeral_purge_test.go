package storage

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestStorageEphemeralPurge(t *testing.T) {
	// Uses this conversation:
	// A start                            <not deletable>
	// B text                             <not ephemeral>
	// C text <----\        edited by E   <ephemeral with 1 "lifetime">
	// D headline  |                      <not deletable>
	// E edit -----^        edits C       <ephemeral with 3 "lifetime"s>
	// F text <---\         deleted by G  <ephemeral with 2 "lifetime"s>
	// G delete --^    ___  deletes F     <not deletable>
	// H text           |                 <ephemeral with 1 "lifetime">

	_, storage, uid := setupStorageTest(t, "ephemeral purge")

	clock := clockwork.NewFakeClockAt(time.Now())
	storage.SetClock(clock)
	convID := makeConvID()

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
		fetchRes, err := storage.Fetch(context.Background(), makeConversationAt(convID, maxMsgID), uid, rc,
			nil, nil)
		res := fetchRes.Thread
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

	verifyTrackerState := func(expectedPurgeInfo *chat1.EphemeralPurgeInfo) {
		purgeInfo, err := storage.ephemeralTracker.getPurgeInfo(context.Background(), convID, uid)
		if expectedPurgeInfo == nil {
			require.Error(t, err)
			require.IsType(t, MissError{}, err, "wrong error type")
		} else {
			require.NoError(t, err)
		}
		require.Equal(t, expectedPurgeInfo, purgeInfo)
	}

	ephemeralPurgeAndVerify := func(expectedPurgeInfo *chat1.EphemeralPurgeInfo, msgIDs []chat1.MessageID) {
		purgeInfo, _ := storage.ephemeralTracker.getPurgeInfo(context.Background(), convID, uid)
		newPurgeInfo, purgedMsgs, err := storage.EphemeralPurge(context.Background(), convID, uid, purgeInfo)
		require.NoError(t, err)
		if msgIDs == nil {
			require.Nil(t, purgedMsgs)
		} else {
			purgedIDs := []chat1.MessageID{}
			for _, purgedMsg := range purgedMsgs {
				purgedIDs = append(purgedIDs, purgedMsg.GetMessageID())
			}
			require.Equal(t, msgIDs, purgedIDs)
		}
		require.Equal(t, expectedPurgeInfo, newPurgeInfo)
		verifyTrackerState(expectedPurgeInfo)
	}

	lifetime := gregor1.DurationSec(1)
	sleepLifetime := lifetime.ToDuration()
	now := gregor1.ToTime(clock.Now())
	msgA := makeMsgWithType(1, chat1.MessageType_TLFNAME)
	msgB := makeText(2, "some text")
	msgC := makeEphemeralText(3, "some text", &chat1.MsgEphemeralMetadata{Lifetime: lifetime}, now)
	msgD := makeHeadlineMessage(4)
	msgE := makeEphemeralEdit(5, msgC.GetMessageID(), &chat1.MsgEphemeralMetadata{Lifetime: lifetime * 3}, now)
	msgF := makeEphemeralText(6, "some text", &chat1.MsgEphemeralMetadata{Lifetime: lifetime * 2}, now)
	msgG := makeDelete(7, msgF.GetMessageID(), nil)
	msgH := makeEphemeralText(8, "some text", &chat1.MsgEphemeralMetadata{Lifetime: lifetime}, now)

	t.Logf("initial merge")
	mustMerge(t, storage, convID, uid, sortMessagesDesc([]chat1.MessageUnboxed{msgA, msgB, msgC, msgD, msgE, msgF, msgG}))

	// We set the initial tracker info when we merge in
	expectedPurgeInfo := &chat1.EphemeralPurgeInfo{
		ConvID:          convID,
		NextPurgeTime:   msgC.Valid().Etime(),
		MinUnexplodedID: msgC.GetMessageID(),
		IsActive:        true,
	}
	verifyTrackerState(expectedPurgeInfo)
	// Running purge has no effect since nothing is expired
	ephemeralPurgeAndVerify(expectedPurgeInfo, nil)

	setExpected("A", msgA, false, 0) // TLFNAME messages have no body
	setExpected("B", msgB, true, 0)
	setExpected("C", msgC, true, msgE.GetMessageID())
	setExpected("D", msgD, true, 0)
	setExpected("E", msgE, true, 0)
	setExpected("F", msgF, false, msgG.GetMessageID())
	setExpected("G", msgG, true, 0)
	assertState(msgG.GetMessageID())
	// After fetching messages tracker state is unchanged since nothing is
	// expired.
	verifyTrackerState(expectedPurgeInfo)

	t.Logf("sleep and fetch")
	// We sleep for `lifetime`, so we expect C to get purged on fetch (msg H is
	// not yet merged in)
	clock.Advance(sleepLifetime)
	setExpected("C", msgC, false, dontCare)
	assertState(msgG.GetMessageID())
	// We don't update the  tracker state is updated from a fetch
	verifyTrackerState(expectedPurgeInfo)
	// Once we run EphemeralPurge and sweep all messages, we update our tracker
	// state
	expectedPurgeInfo = &chat1.EphemeralPurgeInfo{
		ConvID:          convID,
		NextPurgeTime:   msgE.Valid().Etime(),
		MinUnexplodedID: msgE.GetMessageID(),
		IsActive:        true,
	}
	// msgIDs is nil since assertState pulled the conversation and exploded msgC on load.
	ephemeralPurgeAndVerify(expectedPurgeInfo, nil)

	t.Logf("mergeH")
	// We add msgH, which is already expired, so it should get purged on entry,
	// but our nextPurgeTime should be unchanged, since msgE's etime is still
	// the min.
	mustMerge(t, storage, convID, uid, sortMessagesDesc([]chat1.MessageUnboxed{msgH}))
	verifyTrackerState(expectedPurgeInfo)
	// H should have it's body nuked off the bat.
	setExpected("H", msgH, false, dontCare)
	assertState(msgH.GetMessageID())
	verifyTrackerState(expectedPurgeInfo)

	// we've slept for ~ lifetime*2, F's lifetime is up
	clock.Advance(sleepLifetime)
	expectedPurgeInfo = &chat1.EphemeralPurgeInfo{
		ConvID:          convID,
		NextPurgeTime:   msgE.Valid().Etime(),
		MinUnexplodedID: msgE.GetMessageID(),
		IsActive:        true,
	}
	ephemeralPurgeAndVerify(expectedPurgeInfo, nil)
	setExpected("F", msgF, false, dontCare)
	assertState(msgH.GetMessageID())

	// we've slept for ~ lifetime*3, E's lifetime is up
	clock.Advance(sleepLifetime)
	expectedPurgeInfo = &chat1.EphemeralPurgeInfo{
		ConvID:          convID,
		NextPurgeTime:   0,
		MinUnexplodedID: msgH.GetMessageID(),
		IsActive:        false,
	}
	ephemeralPurgeAndVerify(expectedPurgeInfo, []chat1.MessageID{msgE.GetMessageID()})
	setExpected("E", msgE, false, dontCare)
	assertState(msgH.GetMessageID())

	t.Logf("purge with no effect")
	ephemeralPurgeAndVerify(expectedPurgeInfo, nil)
	assertState(msgH.GetMessageID())

	t.Logf("another purge with no effect")
	ephemeralPurgeAndVerify(expectedPurgeInfo, nil)
	assertState(msgH.GetMessageID())

	// Force a purge with 0 messages, and make sure we process it correctly.
	newPurgeInfo, purgedMsgs, err := storage.EphemeralPurge(context.Background(), convID, uid,
		&chat1.EphemeralPurgeInfo{
			ConvID:          convID,
			NextPurgeTime:   0,
			MinUnexplodedID: msgH.GetMessageID() + 1,
			IsActive:        false,
		})
	require.NoError(t, err)
	require.Nil(t, newPurgeInfo)
	require.EqualValues(t, []chat1.MessageUnboxed(nil), purgedMsgs)
	verifyTrackerState(expectedPurgeInfo)
}
