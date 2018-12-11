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

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func checkTlfHistory(t *testing.T, th *TlfHistory, expected writersByRevision,
	loggedInUser string) {
	writersWhoNeedMore := th.Recompute(loggedInUser)
	history := th.getHistory(loggedInUser) // should use cached history.
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

func (nn *nextNotification) makeWithType(
	filename string, nt NotificationOpType, uid keybase1.UID,
	params *NotificationParams, now time.Time,
	entryType EntryType) NotificationMessage {
	n := NotificationMessage{
		Version:           NotificationV2,
		Revision:          nn.nextRevision,
		Filename:          filename,
		Type:              nt,
		FolderID:          nn.tlfID,
		UID:               uid,
		Params:            params,
		FileType:          entryType,
		Time:              now,
		numWithinRevision: nn.numWithin,
	}
	nn.numWithin++
	nn.nextEvents = append(nn.nextEvents, n)
	return n
}

func (nn *nextNotification) make(
	filename string, nt NotificationOpType, uid keybase1.UID,
	params *NotificationParams, now time.Time) NotificationMessage {
	return nn.makeWithType(filename, nt, uid, params, now, EntryTypeFile)
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
	checkTlfHistory(t, th, expected, aliceName)

	// Bob, then Alice.
	th = NewTlfHistory()
	err = th.AddNotifications(bobName, []string{string(bobMessage)})
	require.NoError(t, err)
	err = th.AddNotifications(aliceName, []string{string(aliceMessage)})
	require.NoError(t, err)
	checkTlfHistory(t, th, expected, aliceName)

	// Add a duplicate notification.
	err = th.AddNotifications(bobName, []string{string(bobMessage)})
	require.NoError(t, err)
	checkTlfHistory(t, th, expected, aliceName)
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

	// Alice writes to "._c", which should be ignored.
	_ = nn.make("._c", NotificationModify, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))

	// Alice writes to ".DS_Store (conflicted copy)", which should be ignored.
	_ = nn.make(
		".DS_Store (conflicted copy)", NotificationModify, aliceUID, nil,
		time.Time{})
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
	checkTlfHistory(t, th, expected, aliceName)

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
	checkTlfHistory(t, th, expected, aliceName)
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
	checkTlfHistory(t, th, expected, aliceName)
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
	err = th.AddNotifications(
		aliceName, aliceMessages[maxEditsPerWriter/2:])
	require.NoError(t, err)
	checkTlfHistory(t, th, expected, aliceName)

	// Then input the rest, and we'll have a complete set.
	err = th.AddNotifications(
		aliceName, aliceMessages[:maxEditsPerWriter/2])
	require.NoError(t, err)
	expected = writersByRevision{
		{aliceName, allExpected},
	}
	checkTlfHistory(t, th, expected, aliceName)
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

	// Input the max+1.
	expected := writersByRevision{
		{aliceName, allExpected[1 : maxEditsPerWriter+1]},
	}
	th := NewTlfHistory()
	err = th.AddNotifications(
		aliceName, aliceMessages[:maxEditsPerWriter+1])
	require.NoError(t, err)
	checkTlfHistory(t, th, expected, aliceName)

	// Then input the last one, and make sure the correct item was trimmed.
	err = th.AddNotifications(
		aliceName, aliceMessages[maxEditsPerWriter+1:])
	require.NoError(t, err)
	expected = writersByRevision{
		{aliceName, allExpected[:maxEditsPerWriter]},
	}
	checkTlfHistory(t, th, expected, aliceName)
}

func TestTlfHistoryWithUnflushed(t *testing.T) {
	aliceName, bobName := "alice", "bob"
	aliceUID, bobUID := keybase1.MakeTestUID(1), keybase1.MakeTestUID(2)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)
	nn := nextNotification{1, 0, tlfID, nil}

	aliceWrite1 := nn.make("a", NotificationCreate, aliceUID, nil, time.Time{})
	aliceMessage1 := nn.encode(t)
	bobWrite2 := nn.make("b", NotificationCreate, bobUID, nil, time.Time{})
	bobMessage2 := nn.encode(t)

	th := NewTlfHistory()
	err = th.AddNotifications(aliceName, []string{string(aliceMessage1)})
	require.NoError(t, err)
	err = th.AddNotifications(bobName, []string{string(bobMessage2)})
	require.NoError(t, err)

	// Alice takes over revision 2 with a few more unflushed writes.
	nn.nextRevision--
	aliceWrite2 := nn.make("c", NotificationCreate, aliceUID, nil, time.Time{})
	_ = nn.encode(t)
	aliceWrite3 := nn.make("d", NotificationCreate, aliceUID, nil, time.Time{})
	_ = nn.encode(t)
	th.AddUnflushedNotifications(
		aliceName, []NotificationMessage{aliceWrite2, aliceWrite3})

	expected := writersByRevision{
		{aliceName, []NotificationMessage{
			aliceWrite3,
			aliceWrite2,
			aliceWrite1},
		},
	}
	checkTlfHistory(t, th, expected, aliceName)

	th.FlushRevision(2)
	expected = writersByRevision{
		{aliceName, []NotificationMessage{
			aliceWrite3,
			aliceWrite1},
		},
		{bobName, []NotificationMessage{bobWrite2}},
	}
	checkTlfHistory(t, th, expected, aliceName)

	th.ClearAllUnflushed()
	expected = writersByRevision{
		{bobName, []NotificationMessage{bobWrite2}},
		{aliceName, []NotificationMessage{aliceWrite1}},
	}
	checkTlfHistory(t, th, expected, aliceName)
}

func TestTlfHistoryRenameParentSimple(t *testing.T) {
	aliceName, bobName := "alice", "bob"
	aliceUID, bobUID := keybase1.MakeTestUID(1), keybase1.MakeTestUID(2)
	tlfID, err := tlf.MakeRandomID(tlf.Private)
	require.NoError(t, err)

	var aliceMessages, bobMessages []string
	nn := nextNotification{1, 0, tlfID, nil}

	// Alice creates modifies "a/b".  (Use truncated Keybase canonical
	// paths because renames only matter beyond the TLF name.)
	aliceModifyB := nn.make(
		"/k/p/a,b/a/b", NotificationModify, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))

	// Bob renames "a" to "c".
	_ = nn.makeWithType(
		"/k/p/a,b/c", NotificationRename, bobUID, &NotificationParams{
			OldFilename: "/k/p/a,b/a",
		}, time.Time{}, EntryTypeDir)
	bobMessages = append(bobMessages, nn.encode(t))
	aliceModifyB.Filename = "/k/p/a,b/c/b"

	expected := writersByRevision{
		{aliceName, []NotificationMessage{aliceModifyB}},
	}

	// Alice, then Bob.
	th := NewTlfHistory()
	err = th.AddNotifications(aliceName, aliceMessages)
	require.NoError(t, err)
	err = th.AddNotifications(bobName, bobMessages)
	require.NoError(t, err)
	checkTlfHistory(t, th, expected, aliceName)

	_ = nn.make("/k/p/a,b/c/b", NotificationDelete, aliceUID, nil, time.Time{})
	aliceMessages = append(aliceMessages, nn.encode(t))
	err = th.AddNotifications(aliceName, aliceMessages)
	require.NoError(t, err)
	checkTlfHistory(t, th, writersByRevision{}, aliceName)
}
