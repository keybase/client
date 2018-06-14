// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import (
	"encoding/json"
	"sort"
	"strconv"
	"testing"

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
	tlfID        tlf.ID
}

func (nn *nextNotification) make(
	t *testing.T, filename string, nt NotificationOpType, uid keybase1.UID,
	params *NotificationParams) (
	NotificationMessage, string) {
	next := NotificationMessage{
		Revision: nn.nextRevision,
		Filename: filename,
		Type:     nt,
		FolderID: nn.tlfID,
		UID:      uid,
		Params:   params,
		FileType: EntryTypeFile,
	}
	nn.nextRevision++
	msg, err := json.Marshal(next)
	require.NoError(t, err)
	return next, string(msg)
}

func TestTlfHistorySimple(t *testing.T) {
	aliceName, bobName := "alice", "bob"
	aliceUID, bobUID := keybase1.MakeTestUID(1), keybase1.MakeTestUID(2)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)

	nn := nextNotification{1, tlfID}
	aliceWrite, aliceMessage := nn.make(
		t, "a", NotificationCreate, aliceUID, nil)
	bobWrite, bobMessage := nn.make(t, "b", NotificationCreate, bobUID, nil)

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
	nn := nextNotification{1, tlfID}

	// Alice creates and writes to "a".
	_, msg := nn.make(t, "a", NotificationCreate, aliceUID, nil)
	aliceMessages = append(aliceMessages, msg)
	aliceModA, msg := nn.make(t, "a", NotificationModify, aliceUID, nil)
	aliceMessages = append(aliceMessages, msg)

	// Bob creates "b", writes to existing file "c", and writes to "a".
	bobCreateB, msg := nn.make(t, "b", NotificationCreate, bobUID, nil)
	bobMessages = append(bobMessages, msg)
	bobModC, msg := nn.make(t, "c", NotificationModify, bobUID, nil)
	bobMessages = append(bobMessages, msg)
	bobModA, msg := nn.make(t, "a", NotificationModify, bobUID, nil)
	bobMessages = append(bobMessages, msg)

	// Alice writes to "c".
	aliceModC, msg := nn.make(t, "c", NotificationModify, aliceUID, nil)
	aliceMessages = append(aliceMessages, msg)

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
		err = th.AddNotifications(bobName, []string{bobMessages[i]})
		require.NoError(t, err)
	}
	checkTlfHistory(t, th, expected)
}

func TestTlfHistoryRenamesAndDeletes(t *testing.T) {
	aliceName, bobName := "alice", "bob"
	aliceUID, bobUID := keybase1.MakeTestUID(1), keybase1.MakeTestUID(2)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)

	var aliceMessages, bobMessages []string
	nn := nextNotification{1, tlfID}

	// Alice creates modifies "c" (later overwritten).
	_, msg := nn.make(t, "c", NotificationCreate, aliceUID, nil)
	aliceMessages = append(aliceMessages, msg)

	// Bob modifies "c" (later overwritten).
	_, msg = nn.make(t, "c", NotificationModify, bobUID, nil)
	bobMessages = append(bobMessages, msg)

	// Alice creates "b".
	aliceCreateB, msg := nn.make(t, "b", NotificationCreate, aliceUID, nil)
	aliceMessages = append(aliceMessages, msg)

	// Bob moves "b" to "c".
	_, msg = nn.make(t, "c", NotificationRename, bobUID, &NotificationParams{
		OldFilename: "b",
	})
	bobMessages = append(bobMessages, msg)
	aliceCreateB.Filename = "c"

	// Alice creates "a".
	_, msg = nn.make(t, "a", NotificationCreate, aliceUID, nil)
	aliceMessages = append(aliceMessages, msg)

	// Bob modifies "a".
	_, msg = nn.make(t, "a", NotificationModify, aliceUID, nil)
	bobMessages = append(bobMessages, msg)

	// Alice moves "a" to "b".
	_, msg = nn.make(t, "b", NotificationRename, aliceUID, &NotificationParams{
		OldFilename: "a",
	})
	bobMessages = append(bobMessages, msg)

	// Bob creates "a".
	_, msg = nn.make(t, "a", NotificationCreate, bobUID, nil)
	bobMessages = append(bobMessages, msg)

	// Alice deletes "b".
	_, msg = nn.make(t, "b", NotificationDelete, aliceUID, nil)
	aliceMessages = append(aliceMessages, msg)

	// Bob modifies "a".
	bobModA, msg := nn.make(t, "a", NotificationModify, bobUID, nil)
	bobMessages = append(bobMessages, msg)

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
	nn := nextNotification{1, tlfID}
	for i := 0; i < maxEditsPerWriter; i++ {
		event, msg := nn.make(
			t, strconv.Itoa(i), NotificationCreate, aliceUID, nil)
		allExpected = append(allExpected, event)
		aliceMessages = append(aliceMessages, msg)
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
