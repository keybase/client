// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import (
	"container/heap"
	"encoding/json"
	"sort"
	"sync"
)

const (
	// The max number of edits needed for each writer.
	maxEditsPerWriter    = 10
	maxWritersPerHistory = 10
)

type writerNotifications struct {
	writerName    string
	notifications notificationsByRevision
}

// writersByRevision sort sets of per-writer notifications in reverse
// order by the revision of the latest notification for each writer.
type writersByRevision []*writerNotifications

func (wbr writersByRevision) Len() int {
	return len(wbr)
}

func (wbr writersByRevision) Less(i, j int) bool {
	// Some revisions come before no revisions.
	iHasZero := len(wbr[i].notifications) == 0
	jHasZero := len(wbr[j].notifications) == 0
	if jHasZero {
		return iHasZero
	} else if iHasZero {
		return false
	}

	// Reverse sort, so latest revisions come first.
	return wbr[i].notifications[0].Revision > wbr[j].notifications[0].Revision
}

func (wbr writersByRevision) Swap(i, j int) {
	wbr[i], wbr[j] = wbr[j], wbr[i]
}

func (wbr *writersByRevision) Push(x interface{}) {
	wn := x.(*writerNotifications)
	*wbr = append(*wbr, wn)
}

func (wbr *writersByRevision) Pop() interface{} {
	// The item to remove is the last item; heap has already swapped
	// it to the end.
	old := *wbr
	n := len(old)
	item := old[n-1]
	*wbr = old[0 : n-1]
	return item
}

// TlfHistory maintains a history of the last N file edits from each
// writer in the TLF.
//
// There will be two users of a TlfHistory instance:
//
//   * One user (likely something outside of the kbfsedits package,
//     e.g. libkbfs.folderBranchOps) will read notifications from the
//     corresponding TLF and add them to this history.  After adding a
//     batch or several batches of messages, it should call
//     `Recompute()`, and if some writers need more, earlier revisions,
//     it should fetch more notifications for the indicated writer and
//     repeat.
//
//   * The other user (within the kbfsedits package) will collate the
//     histories from multiple TlfHistory instances together using
//     `getHistory()` from each one.  It may also construct pretty
//     versions of individual edit histories for a particular TLF.
type TlfHistory struct {
	lock          sync.RWMutex
	byWriter      map[string]*writerNotifications
	computed      bool
	cachedHistory writersByRevision
}

// NewTlfHistory constructs a new TlfHistory instance.
func NewTlfHistory() *TlfHistory {
	return &TlfHistory{
		byWriter: make(map[string]*writerNotifications),
	}
}

// AddNotifications takes in a set of messages in this TLF by
// `writer`, and adds them to the history.  Once done adding messages,
// the caller should call `Recompute` to find out if more messages
// should be added for any particular writer.
func (th *TlfHistory) AddNotifications(
	writerName string, messages []string) (err error) {
	newEdits := make(notificationsByRevision, 0, len(messages))

	// Unmarshal and sort the new messages.
	for _, msg := range messages {
		var revList []NotificationMessage
		err := json.Unmarshal([]byte(msg), &revList)
		if err != nil {
			// The messages might be from a new version we don't
			// understand, so swallow the error.
			continue
		}

		for j := len(revList) - 1; j >= 0; j-- {
			revMsg := revList[j]
			if revMsg.Version != NotificationV2 {
				// Ignore messages that are too new for us to understand.
				continue
			}
			revMsg.numWithinRevision = j
			newEdits = append(newEdits, revMsg)
		}
	}
	sort.Sort(newEdits)
	newEdits = newEdits.uniquify()

	th.lock.Lock()
	defer th.lock.Unlock()
	wn, existed := th.byWriter[writerName]
	if !existed {
		wn = &writerNotifications{writerName, nil}
	}
	oldLen := len(wn.notifications)
	newEdits = append(newEdits, wn.notifications...)
	sort.Sort(newEdits)
	wn.notifications = newEdits.uniquify()
	if len(wn.notifications) == oldLen {
		// No new messages.
		return nil
	}
	if !existed {
		wn.writerName = writerName
		th.byWriter[writerName] = wn
	}
	// Invalidate the cached results.
	th.computed = false
	return nil
}

type fileEvent struct {
	delete  bool
	newName string
}

type recomputer struct {
	byWriter      map[string]*writerNotifications
	modifiedFiles map[string]map[string]bool // writer -> file -> bool
	fileEvents    map[string]fileEvent       // currentName -> ultimate fate
	numProcessed  map[string]int             // writer name -> num
}

func newRecomputer() recomputer {
	return recomputer{
		byWriter:      make(map[string]*writerNotifications),
		modifiedFiles: make(map[string]map[string]bool),
		fileEvents:    make(map[string]fileEvent),
		numProcessed:  make(map[string]int),
	}
}

// processNotification add the notification to the recomputer's
// history if it is a create/modify for a file that hasn't yet been
// deleted.  If the file is renamed in a future revision, the added
// notification has the new name of the file.  processNotification
// should be called with notifications in reverse order of their
// revision number.
//
// It returns true if it has added enough notifications for the given
// writer, and the caller should not send any more for that writer.
func (r recomputer) processNotification(
	writer string, notification NotificationMessage) (doTrim bool) {
	filename := notification.Filename
	r.numProcessed[writer]++

	// If the file is renamed in a future revision, rename it in the
	// notification.
	eventFilename := filename
	event, hasEvent := r.fileEvents[filename]
	if hasEvent && event.newName != "" {
		notification.Filename = event.newName
		filename = event.newName
	}

	// Keep only the creates and modifies for non-deleted files,
	// but remember the renames and deletes.
	switch notification.Type {
	case NotificationCreate, NotificationModify:
		// Disregard any file that's already been deleted.
		if hasEvent && event.delete {
			return false
		}

		// We only care about files, so skip dir and sym creates.
		if notification.FileType != EntryTypeFile {
			return false
		}

		// We only need one modify message per writer per file.
		if r.modifiedFiles[writer][filename] {
			return false
		}

		wn, ok := r.byWriter[writer]
		if !ok {
			wn = &writerNotifications{writer, nil}
			r.byWriter[writer] = wn
		}
		wn.writerName = writer
		wn.notifications = append(wn.notifications, notification)

		modified, ok := r.modifiedFiles[writer]
		if !ok {
			modified = make(map[string]bool)
			r.modifiedFiles[writer] = modified
		}
		modified[filename] = true

		if len(wn.notifications) == maxEditsPerWriter {
			// We have enough edits for this user.
			return true
		}
	case NotificationRename:
		// If the file already has a final event, move that to the old
		// filename.  Otherwise, this is the final event.
		if hasEvent {
			r.fileEvents[notification.Params.OldFilename] = event
			delete(r.fileEvents, eventFilename)
		} else {
			r.fileEvents[notification.Params.OldFilename] =
				fileEvent{newName: eventFilename}
		}

		// The renamed file overwrote any existing file with the new
		// name.
		r.fileEvents[eventFilename] = fileEvent{delete: true}
	case NotificationDelete:
		r.fileEvents[eventFilename] = fileEvent{delete: true}
	}
	return false
}

func (th *TlfHistory) recomputeLocked() (
	history writersByRevision, writersWhoNeedMore map[string]bool) {
	writersWhoNeedMore = make(map[string]bool)

	// Copy the writer notifications into a heap.
	var writersHeap writersByRevision
	for _, wn := range th.byWriter {
		wnCopy := writerNotifications{
			writerName:    wn.writerName,
			notifications: make(notificationsByRevision, len(wn.notifications)),
		}
		copy(wnCopy.notifications, wn.notifications)
		writersHeap = append(writersHeap, &wnCopy)
	}
	heap.Init(&writersHeap)

	r := newRecomputer()

	// Iterate through the heap.  The writer with the next highest
	// revision will always be at index 0.  Process that writer's
	// first notification, then remove it and fix the heap so that the
	// next highest revision is at index 0.  That way events that
	// happen more recently (like deletes and renames) can be taken
	// into account when looking at older events.
	for writersHeap.Len() > 0 {
		nextWriter := writersHeap[0].writerName
		nextNotification := writersHeap[0].notifications[0]
		doTrim := r.processNotification(nextWriter, nextNotification)

		// Remove that notification, and fix the heap because this
		// writer has a different newest revision.
		if doTrim {
			// Trim all earlier revisions because they won't be needed
			// for the cached history.
			numProcessed := r.numProcessed[nextWriter]
			th.byWriter[nextWriter].notifications =
				th.byWriter[nextWriter].notifications[numProcessed:]
		} else {
			writersHeap[0].notifications = writersHeap[0].notifications[1:]
		}
		if len(writersHeap[0].notifications) == 0 || doTrim {
			heap.Pop(&writersHeap)
		} else {
			heap.Fix(&writersHeap, 0)
		}
	}

	history = make(writersByRevision, 0, len(r.byWriter))
	for writerName := range th.byWriter {
		wn := r.byWriter[writerName]
		if wn != nil && len(wn.notifications) > 0 {
			history = append(history, wn)
		}
		if wn == nil || len(wn.notifications) < maxEditsPerWriter {
			writersWhoNeedMore[writerName] = true
		}
	}
	sort.Sort(history)
	// Garbage-collect any writers that don't appear in the history.
	for i := maxWritersPerHistory; i < len(history); i++ {
		delete(th.byWriter, history[i].writerName)
		delete(writersWhoNeedMore, history[i].writerName)
	}
	if len(history) > maxWritersPerHistory {
		history = history[:maxWritersPerHistory]
	}
	th.computed = true
	th.cachedHistory = history
	return history, writersWhoNeedMore
}

func (th *TlfHistory) getHistoryIfCached() (
	cached bool, history writersByRevision) {
	th.lock.RLock()
	defer th.lock.RUnlock()
	return th.computed, th.cachedHistory
}

func (th *TlfHistory) getHistory() writersByRevision {
	cached, history := th.getHistoryIfCached()
	if cached {
		return history
	}

	th.lock.Lock()
	defer th.lock.Unlock()
	if th.computed {
		// Maybe another goroutine got the lock and recomuted the
		// history since we checked above.
		return th.cachedHistory
	}
	history, _ = th.recomputeLocked()
	return history
}

// Recompute processes (and caches) the history so that it reflects
// all recently-added notifications, and returns the names of writers
// which don't yet have the maximum number of edits in the history.
func (th *TlfHistory) Recompute() (writersWhoNeedMore map[string]bool) {
	th.lock.Lock()
	defer th.lock.Unlock()
	_, writersWhoNeedMore = th.recomputeLocked()
	return writersWhoNeedMore
}
