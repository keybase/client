package storage

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
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

	_, storage, uid := setupStorageTest(t, "delh")

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

	unsetExpected := func(name string) {
		var idx int
		for i, x := range expectedState {
			if x.Name == name {
				idx = i
				break
			}
		}
		expectedState = append(expectedState[:idx], expectedState[idx+1:]...)
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

	verifyTrackerState := func(expectedPurgeInfo *ephemeralPurgeInfo) {
		purgeInfo, err := storage.ephemeralTracker.getPurgeInfo(context.Background(), convID, uid)
		if expectedPurgeInfo == nil {
			require.Error(t, err)
			require.IsType(t, MissError{}, err, "wrong error type")
		} else {
			require.NoError(t, err)
		}
		require.Equal(t, expectedPurgeInfo, purgeInfo)
	}

	ephemeralPurgeAndVerify := func(expectedPurgeInfo *ephemeralPurgeInfo) {
		purgeInfo, _ := storage.ephemeralTracker.getPurgeInfo(context.Background(), convID, uid)
		newPurgeInfo, err := storage.EphemeralPurge(context.Background(), convID, uid, purgeInfo)
		require.NoError(t, err)
		require.Equal(t, expectedPurgeInfo, newPurgeInfo)
		verifyTrackerState(expectedPurgeInfo)
	}

	lifetime := gregor1.DurationSec(1)
	sleepLifetime := time.Second * time.Duration(lifetime)
	msgA := makeMsgWithType(1, chat1.MessageType_TLFNAME)
	msgB := makeText(2, "some text")
	msgC := makeEphemeralText(3, "some text", &chat1.MsgEphemeralMetadata{Lifetime: lifetime})
	msgD := makeHeadlineMessage(4)
	msgE := makeEphemeralEdit(5, msgC.GetMessageID(), &chat1.MsgEphemeralMetadata{Lifetime: lifetime * 3})
	msgF := makeEphemeralText(6, "some text", &chat1.MsgEphemeralMetadata{Lifetime: lifetime * 2})
	msgG := makeDelete(7, msgF.GetMessageID(), nil)
	msgH := makeEphemeralText(8, "some text", &chat1.MsgEphemeralMetadata{Lifetime: lifetime})

	t.Logf("initial merge")
	mustMerge(t, storage, convID, uid, sortMessagesDesc([]chat1.MessageUnboxed{msgA, msgB, msgC, msgD, msgE, msgF, msgG}))
	// We set the purge time on the merge since we have no tracker data, but no IDs
	verifyTrackerState(&ephemeralPurgeInfo{
		NextPurgeTime:   msgC.Valid().Etime(),
		MinUnexplodedID: 0,
	})
	// We keep the purge time since it's the minimum, but can now set the
	// minUnexplodedID
	expectedPurgeInfo := &ephemeralPurgeInfo{
		NextPurgeTime:   msgC.Valid().Etime(),
		MinUnexplodedID: msgC.GetMessageID(),
	}
	ephemeralPurgeAndVerify(expectedPurgeInfo)

	setExpected("A", msgA, false, 0) // TLFNAME messages have no body
	setExpected("B", msgB, true, 0)
	setExpected("C", msgC, true, msgE.GetMessageID())
	setExpected("D", msgD, true, 0)
	setExpected("E", msgE, true, 0)
	setExpected("F", msgF, false, msgG.GetMessageID())
	setExpected("G", msgG, true, 0)
	assertState(msgG.GetMessageID())

	t.Logf("sleep and fetch")
	// We sleep for `lifetime`, so we expect C to get purged on fetch (msg H is not get merged in)
	// The tracker will not update though until EphemeralPurge runs again
	time.Sleep(sleepLifetime)
	unsetExpected("C")
	assertState(msgG.GetMessageID())
	verifyTrackerState(expectedPurgeInfo)
	expectedPurgeInfo = &ephemeralPurgeInfo{
		NextPurgeTime:   msgF.Valid().Etime(),
		MinUnexplodedID: msgE.GetMessageID(),
	}
	ephemeralPurgeAndVerify(expectedPurgeInfo)

	t.Logf("mergeH")
	// We add msgH, which is already expired, so it should get purged on entry,
	// but our nextPurgeTime should be unchanged
	mustMerge(t, storage, convID, uid, sortMessagesDesc([]chat1.MessageUnboxed{msgH}))
	verifyTrackerState(expectedPurgeInfo)
	// We never set H in expected, since it's already gone..
	assertState(msgH.GetMessageID())
	verifyTrackerState(expectedPurgeInfo)

	// we've slept for ~ lifetime*2, F's lifetime is up
	time.Sleep(sleepLifetime)
	expectedPurgeInfo = &ephemeralPurgeInfo{
		NextPurgeTime:   msgE.Valid().Etime(),
		MinUnexplodedID: msgE.GetMessageID(),
	}
	ephemeralPurgeAndVerify(expectedPurgeInfo)
	unsetExpected("F")
	assertState(msgH.GetMessageID())

	// we've slept for ~ lifetime*3, E's lifetime is up
	time.Sleep(sleepLifetime)
	ephemeralPurgeAndVerify(nil)
	unsetExpected("E")
	assertState(msgH.GetMessageID())

	t.Logf("purge with no effect")
	ephemeralPurgeAndVerify(nil)
	assertState(msgH.GetMessageID())

	t.Logf("another purge with no effect")
	ephemeralPurgeAndVerify(nil)
	assertState(msgH.GetMessageID())
}
