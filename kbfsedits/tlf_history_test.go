// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import (
	"encoding/json"
	"sort"
	"strconv"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func checkTlfHistory(t *testing.T, th *TlfHistory, expected writersByRevision) {
	writersWhoNeedMore := th.Recompute()
	history := th.getHistory() // should use cached history.
	require.Len(t, history, len(expected))

	for i, e := range expected {
		require.Equal(t, e.writerName, history[i].writerName)
		require.Len(t, history[i].notifications, len(e.notifications))
		for j, n := range e.notifications {
			require.Equal(t, n, history[i].notifications[j])
		}
		if len(e.notifications) < maxEditsPerWriter {
			require.Contains(t, writersWhoNeedMore, e.writerName)
		}
	}
}

type nextNotification struct {
	nextRevision kbfsmd.Revision
	numWithin    int
	tlfID        tlf.ID
	nextEvents   []NotificationMessage
}

func (nn *nextNotification) make(
	filename string, nt NotificationOpType, uid keybase1.UID,
	params *NotificationParams, now time.Time) NotificationMessage {
	n := NotificationMessage{
		Version:           NotificationV2,
		Revision:          nn.nextRevision,
		Filename:          filename,
		Type:              nt,
		FolderID:          nn.tlfID,
		UID:               uid,
		Params:            params,
		FileType:          EntryTypeFile,
		Time:              now,
		numWithinRevision: nn.numWithin,
	}
	nn.numWithin++
	nn.nextEvents = append(nn.nextEvents, n)
	return n
}

func (nn *nextNotification) encode(t *testing.T) string {
	nn.nextRevision++
	msg, err := json.Marshal(nn.nextEvents)
	require.NoError(t, err)
	nn.nextEvents = nil
	nn.numWithin = 0
	return string(msg)
}

func TestTlfHistorySimple(t *testing.T) {
	aliceName, bobName := "alice", "bob"
	aliceUID, bobUID := keybase1.MakeTestUID(1), keybase1.MakeTestUID(2)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)

	nn := nextNotification{1, 0, tlfID, nil}
	aliceWrite := nn.make("a", NotificationCreate, aliceUID, nil, time.Time{})
	aliceMessage := nn.encode(t)
	bobWrite := nn.make("b", NotificationCreate, bobUID, nil, time.Time{})
	bobMessage := nn.encode(t)

	expected := writersByRevision{
		{bobName, []NotificationMessage{bobWrite}},
		{aliceName, []NotificationMessage{aliceWrite}},
	}

	// Alice, then Bob.
	th := NewTlfHistory()
	err = th.AddNotifications(aliceName, []string{string(aliceMessage)})
	require.NoError(t, err)
	err = th.AddNotifications(bobName, []string{string(bobMessage)})
	require.NoError(t, err)
	checkTlfHistory(t, th, expected)

	// Bob, then Alice.
	th = NewTlfHistory()
	err = th.AddNotifications(bobName, []string{string(bobMessage)})
	require.NoError(t, err)
	err = th.AddNotifications(aliceName, []string{string(aliceMessage)})
	require.NoError(t, err)
	checkTlfHistory(t, th, expected)

	// Add a duplicate notification.
	err = th.AddNotifications(bobName, []string{string(bobMessage)})
	require.NoError(t, err)
	checkTlfHistory(t, th, expected)
}

func TestTlfHistoryMultipleWrites(t *testing.T) {
	aliceName, bobName := "alice", "bob"
	aliceUID, bobUID := keybase1.MakeTestUID(1), keybase1.MakeTestUID(2)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)

	var aliceMessages, bobMessages []string
	nn := nextNotification{1, 0, tlfID, nil}

	// Alice creates and writes to "a".
	_ = nn.make("a", NotificationCreate, aliceUID, nil, time.Time{})
	aliceModA := nn.make("a", NotificationModify, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))

	// Bob creates "b", writes to existing file "c", and writes to "a".
	bobCreateB := nn.make("b", NotificationCreate, bobUID, nil, time.Time{})
	bobModC := nn.make("c", NotificationModify, bobUID, nil, time.Time{})
	bobModA := nn.make("a", NotificationModify, bobUID, nil, time.Time{})
	bobMessages = append(bobMessages, nn.encode(t))

	// Alice writes to "c".
	aliceModC := nn.make("c", NotificationModify, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))

	expected := writersByRevision{
		{aliceName, []NotificationMessage{aliceModC, aliceModA}},
		{bobName, []NotificationMessage{bobModA, bobModC, bobCreateB}},
	}

	// Alice, then Bob.
	th := NewTlfHistory()
	err = th.AddNotifications(aliceName, aliceMessages)
	require.NoError(t, err)
	err = th.AddNotifications(bobName, bobMessages)
	require.NoError(t, err)
	checkTlfHistory(t, th, expected)

	// Add each message one at a time, alternating users.
	th = NewTlfHistory()
	for i := 0; i < len(aliceMessages); i++ {
		err = th.AddNotifications(aliceName, []string{aliceMessages[i]})
		require.NoError(t, err)
		if i < len(bobMessages) {
			err = th.AddNotifications(bobName, []string{bobMessages[i]})
			require.NoError(t, err)
		}
	}
	checkTlfHistory(t, th, expected)
}

func TestTlfHistoryRenamesAndDeletes(t *testing.T) {
	aliceName, bobName := "alice", "bob"
	aliceUID, bobUID := keybase1.MakeTestUID(1), keybase1.MakeTestUID(2)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)

	var aliceMessages, bobMessages []string
	nn := nextNotification{1, 0, tlfID, nil}

	// Alice creates modifies "c" (later overwritten).
	_ = nn.make("c", NotificationCreate, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))

	// Bob modifies "c" (later overwritten).
	_ = nn.make("c", NotificationModify, bobUID, nil, time.Time{})
	bobMessages = append(bobMessages, nn.encode(t))

	// Alice creates "b".
	aliceCreateB := nn.make("b", NotificationCreate, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))

	// Bob moves "b" to "c".
	_ = nn.make("c", NotificationRename, bobUID, &NotificationParams{
		OldFilename: "b",
	}, time.Time{})
	bobMessages = append(bobMessages, nn.encode(t))
	aliceCreateB.Filename = "c"

	// Alice creates "a".
	_ = nn.make("a", NotificationCreate, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))

	// Bob modifies "a".
	_ = nn.make("a", NotificationModify, aliceUID, nil, time.Time{})
	bobMessages = append(bobMessages, nn.encode(t))

	// Alice moves "a" to "b".
	_ = nn.make("b", NotificationRename, aliceUID, &NotificationParams{
		OldFilename: "a",
	}, time.Time{})
	bobMessages = append(bobMessages, nn.encode(t))

	// Bob creates "a".
	_ = nn.make("a", NotificationCreate, bobUID, nil, time.Time{})
	bobMessages = append(bobMessages, nn.encode(t))

	// Alice deletes "b".
	_ = nn.make("b", NotificationDelete, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))

	// Bob modifies "a".
	bobModA := nn.make("a", NotificationModify, bobUID, nil, time.Time{})
	bobMessages = append(bobMessages, nn.encode(t))

	expected := writersByRevision{
		{bobName, []NotificationMessage{bobModA}},
		{aliceName, []NotificationMessage{aliceCreateB}},
	}

	// Alice, then Bob.
	th := NewTlfHistory()
	err = th.AddNotifications(aliceName, aliceMessages)
	require.NoError(t, err)
	err = th.AddNotifications(bobName, bobMessages)
	require.NoError(t, err)
	checkTlfHistory(t, th, expected)
}

func TestTlfHistoryNeedsMoreThenComplete(t *testing.T) {
	aliceName := "alice"
	aliceUID := keybase1.MakeTestUID(1)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)

	var allExpected notificationsByRevision

	var aliceMessages []string
	nn := nextNotification{1, 0, tlfID, nil}
	for i := 0; i < maxEditsPerWriter; i++ {
		event := nn.make(
			strconv.Itoa(i), NotificationCreate, aliceUID, nil, time.Time{})
		allExpected = append(allExpected, event)
		aliceMessages = append(aliceMessages, nn.encode(t))
	}
	sort.Sort(allExpected)

	// Input most recent half of messages first.
	expected := writersByRevision{
		{aliceName, allExpected[:maxEditsPerWriter/2]},
	}
	th := NewTlfHistory()
	err = th.AddNotifications(aliceName, aliceMessages[maxEditsPerWriter/2:])
	require.NoError(t, err)
	checkTlfHistory(t, th, expected)

	// Then input the rest, and we'll have a complete set.
	err = th.AddNotifications(aliceName, aliceMessages[:maxEditsPerWriter/2])
	require.NoError(t, err)
	expected = writersByRevision{
		{aliceName, allExpected},
	}
	checkTlfHistory(t, th, expected)
}

func TestTlfHistoryTrimming(t *testing.T) {
	aliceName := "alice"
	aliceUID := keybase1.MakeTestUID(1)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)

	var allExpected notificationsByRevision

	var aliceMessages []string
	nn := nextNotification{1, 0, tlfID, nil}
	for i := 0; i < maxEditsPerWriter+2; i++ {
		event := nn.make(strconv.Itoa(i), NotificationCreate, aliceUID, nil,
			time.Time{})
		allExpected = append(allExpected, event)
		aliceMessages = append(aliceMessages, nn.encode(t))
	}
	sort.Sort(allExpected)
	t.Logf("%#v\n", allExpected)

	// Input the max+1.
	expected := writersByRevision{
		{aliceName, allExpected[1 : maxEditsPerWriter+1]},
	}
	th := NewTlfHistory()
	err = th.AddNotifications(aliceName, aliceMessages[:maxEditsPerWriter+1])
	require.NoError(t, err)
	checkTlfHistory(t, th, expected)

	// Then input the last one, and make sure the correct item was trimmed.
	err = th.AddNotifications(aliceName, aliceMessages[maxEditsPerWriter+1:])
	require.NoError(t, err)
	expected = writersByRevision{
		{aliceName, allExpected[:maxEditsPerWriter]},
	}
	checkTlfHistory(t, th, expected)
}
