// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import (
	"container/heap"
	"encoding/json"
	"fmt"
	"path"
	"sort"
	"strings"
	"sync"

	"github.com/keybase/client/go/kbfs/kbfsmd"
)

const (
	// The max number of edits needed for each writer.
	maxEditsPerWriter = 10
	// The max number of deletes needed for each writer.
	maxDeletesPerWriter  = 10
	maxWritersPerHistory = 10
)

type writerNotifications struct {
	writerName    string
	notifications notificationsByRevision
	deletes       notificationsByRevision
}

// writersByRevision sorts sets of per-writer notifications in reverse
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
		if iHasZero {
			// If neither has any notifications, sort by the latest
			// delete.
			iHasZeroDeletes := len(wbr[i].deletes) == 0
			jHasZeroDeletes := len(wbr[j].deletes) == 0
			if jHasZeroDeletes {
				return iHasZeroDeletes
			} else if iHasZeroDeletes {
				return false
			}

			// Reverse sort, so latest deletes come first.
			return wbr[i].deletes[0].Revision > wbr[j].deletes[0].Revision
		}
		return false
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
	lock               sync.RWMutex
	byWriter           map[string]*writerNotifications
	unflushed          *writerNotifications
	computed           bool
	cachedHistory      writersByRevision
	cachedLoggedInUser string
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
// should be added for any particular writer.  It returns the maximum
// known revision including an update from this writer.
func (th *TlfHistory) AddNotifications(
	writerName string, messages []string) (maxRev kbfsmd.Revision, err error) {
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

	th.lock.Lock()
	defer th.lock.Unlock()
	wn, existed := th.byWriter[writerName]
	if !existed {
		wn = &writerNotifications{writerName, nil, nil}
	}
	oldLen := len(wn.notifications)
	newEdits = append(newEdits, wn.notifications...)
	sort.Sort(newEdits)
	if len(newEdits) > 0 {
		maxRev = newEdits[0].Revision
	}

	wn.notifications = newEdits.uniquify()
	if len(wn.notifications) == oldLen {
		// No new messages.
		return maxRev, nil
	}
	if !existed {
		th.byWriter[writerName] = wn
	}
	// Invalidate the cached results.
	th.computed = false
	th.cachedLoggedInUser = ""
	return maxRev, nil
}

// AddUnflushedNotifications adds notifications to a special
// "unflushed" list that takes precedences over the regular
// notifications with revision numbers equal or greater to the minimum
// unflushed revision.
func (th *TlfHistory) AddUnflushedNotifications(
	loggedInUser string, msgs []NotificationMessage) {
	th.lock.Lock()
	defer th.lock.Unlock()
	if th.unflushed == nil {
		th.unflushed = &writerNotifications{loggedInUser, nil, nil}
	}
	if th.unflushed.writerName != loggedInUser {
		panic(fmt.Sprintf("Logged-in user %s doesn't match unflushed user %s",
			loggedInUser, th.unflushed.writerName))
	}
	newEdits := append(
		notificationsByRevision(msgs), th.unflushed.notifications...)
	sort.Sort(newEdits)
	th.unflushed.notifications = newEdits.uniquify()
	// Invalidate the cached results.
	th.computed = false
	th.cachedLoggedInUser = ""
}

// FlushRevision clears all any unflushed notifications with a
// revision equal or less than `rev`.
func (th *TlfHistory) FlushRevision(rev kbfsmd.Revision) {
	th.lock.Lock()
	defer th.lock.Unlock()
	if th.unflushed == nil {
		return
	}
	lastToKeep := len(th.unflushed.notifications) - 1
	for ; lastToKeep >= 0; lastToKeep-- {
		if th.unflushed.notifications[lastToKeep].Revision > rev {
			break
		}
	}
	if lastToKeep < len(th.unflushed.notifications)-1 {
		th.unflushed.notifications = th.unflushed.notifications[:lastToKeep+1]
		// Invalidate the cached results.
		th.computed = false
		th.cachedLoggedInUser = ""
	}
}

// ClearAllUnflushed clears all unflushed notifications.
func (th *TlfHistory) ClearAllUnflushed() {
	th.lock.Lock()
	defer th.lock.Unlock()
	if th.unflushed != nil {
		// Invalidate the cached results.
		th.computed = false
		th.cachedLoggedInUser = ""
	}
	th.unflushed = nil
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
	minUnflushed  kbfsmd.Revision
}

func newRecomputer() *recomputer {
	return &recomputer{
		byWriter:      make(map[string]*writerNotifications),
		modifiedFiles: make(map[string]map[string]bool),
		fileEvents:    make(map[string]fileEvent),
		numProcessed:  make(map[string]int),
		minUnflushed:  kbfsmd.RevisionUninitialized,
	}
}

var filesToIgnore = map[string]bool{
	".Trashes":   true,
	".fseventsd": true,
	".DS_Store":  true,
}

func ignoreFile(filename string) bool {
	_, base := path.Split(filename)
	if filesToIgnore[base] || strings.HasPrefix(base, "._") {
		return true
	}
	// Treat the files to ignore as prefixes, since if they ever
	// conflict they'll have the conflict suffix.
	for prefix := range filesToIgnore {
		if strings.HasPrefix(base, prefix) {
			return true
		}
	}
	return false
}

// processNotification adds the notification to the recomputer's
// history if it is a create/modify for a file that hasn't yet been
// deleted.  If the file is renamed in a future revision, the added
// notification has the new name of the file.  processNotification
// should be called with notifications in reverse order of their
// revision number.
//
// It returns true if it has added enough notifications for the given
// writer, and the caller should not send any more for that writer.
func (r *recomputer) processNotification(
	writer string, notification NotificationMessage) (doTrim bool) {
	// Ignore notifications that come after any present unflushed
	// notifications, as the local client won't be able to see them.
	if r.minUnflushed != kbfsmd.RevisionUninitialized &&
		notification.Revision >= r.minUnflushed {
		return false
	}

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

		// Ignore macOS dotfiles.
		if ignoreFile(filename) {
			return false
		}

		wn, ok := r.byWriter[writer]
		if !ok {
			wn = &writerNotifications{writer, nil, nil}
			r.byWriter[writer] = wn
		}

		if len(wn.notifications) == maxEditsPerWriter {
			// We don't need any more edit notifications, but we
			// should continue looking for more deletes.
			return false
		}

		// See if any of the parent directories were renamed, checking
		// backwards until we get to the TLF name.
		prefix := filename
		suffix := ""
		for strings.Count(prefix, "/") > 4 {
			var finalElem string
			prefix, finalElem = path.Split(prefix)
			prefix = strings.TrimSuffix(prefix, "/")
			suffix = path.Clean(path.Join(finalElem, suffix))
			event, hasEvent := r.fileEvents[prefix]
			if hasEvent && event.newName != "" {
				prefix = event.newName
			}
		}
		filename = path.Clean(path.Join(prefix, suffix))
		notification.Filename = filename

		// We only need one modify message per writer per file.
		if r.modifiedFiles[writer][filename] {
			return false
		}

		wn.notifications = append(wn.notifications, notification)

		modified, ok := r.modifiedFiles[writer]
		if !ok {
			modified = make(map[string]bool)
			r.modifiedFiles[writer] = modified
		}
		modified[filename] = true

		if len(wn.notifications) == maxEditsPerWriter &&
			len(wn.deletes) == maxDeletesPerWriter {
			// We have enough edits and deletes for this user.
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

		// If renaming a directory, check whether there are any events
		// for children of the directory, and rename them
		// accordingly. TODO: there's probably a better data structure
		// for doing this when storing events, maybe a multi-layer map
		// structured like a file system.
		if notification.FileType == EntryTypeDir {
			for f, event := range r.fileEvents {
				if strings.HasPrefix(f, eventFilename) {
					oldF := strings.Replace(
						f, eventFilename, notification.Params.OldFilename, -1)
					r.fileEvents[oldF] = event
					delete(r.fileEvents, f)
				}
			}
		}

		// The renamed file overwrote any existing file with the new
		// name.
		r.fileEvents[eventFilename] = fileEvent{delete: true}
	case NotificationDelete:
		r.fileEvents[eventFilename] = fileEvent{delete: true}

		// We only care about files, so skip dir and sym creates.
		if notification.FileType != EntryTypeFile {
			return false
		}

		// Ignore macOS dotfiles.
		if ignoreFile(filename) {
			return false
		}

		wn, ok := r.byWriter[writer]
		if !ok {
			wn = &writerNotifications{writer, nil, nil}
			r.byWriter[writer] = wn
		}

		if len(wn.deletes) == maxDeletesPerWriter {
			// We don't need any more deletes, but we
			// should continue looking for more edit notifications.
			return false
		}

		if hasEvent && event.delete {
			// It's already been deleted, no need to track it further.
			return false
		}

		// If there are no future modifications of this file, then
		// this delete should be included in the history.
		for _, files := range r.modifiedFiles {
			for f := range files {
				if f == eventFilename {
					return false
				}
			}
		}

		wn.deletes = append(wn.deletes, notification)

		if len(wn.notifications) == maxEditsPerWriter &&
			len(wn.deletes) == maxDeletesPerWriter {
			// We have enough edits and deletes for this user.
			return true
		}

		// TODO: limit the number (or time span) of notifications we
		// process to find the list of deleted files?  Or maybe we
		// stop processing after we hit the last GC'd revision, since
		// deleted files after that point can't be recovered anyway.
	}
	return false
}

func (th *TlfHistory) recomputeLocked(loggedInUser string) (
	history writersByRevision, writersWhoNeedMore map[string]bool) {
	writersWhoNeedMore = make(map[string]bool)

	r := newRecomputer()

	// First add all of the unflushed notifications for the logged-in
	// writer.
	skipLoggedIn := false
	loggedInProcessed := 0
	if th.unflushed != nil {
		if th.unflushed.writerName != loggedInUser {
			panic(fmt.Sprintf(
				"Logged-in user %s doesn't match unflushed user %s",
				loggedInUser, th.unflushed.writerName))
		}
		for _, n := range th.unflushed.notifications {
			doTrim := r.processNotification(th.unflushed.writerName, n)
			if doTrim {
				skipLoggedIn = true
				break
			}
		}
		if ln := len(th.unflushed.notifications); ln > 0 {
			r.minUnflushed = th.unflushed.notifications[ln-1].Revision
		}
		loggedInProcessed = r.numProcessed[th.unflushed.writerName]
	}

	// Copy the writer notifications into a heap.
	var writersHeap writersByRevision
	for _, wn := range th.byWriter {
		if skipLoggedIn && wn.writerName == loggedInUser {
			// There are enough unflushed notifications already, so
			// skip the logged-in user.
			continue
		}
		wnCopy := writerNotifications{
			writerName:    wn.writerName,
			notifications: make(notificationsByRevision, len(wn.notifications)),
			deletes:       make(notificationsByRevision, len(wn.deletes)),
		}
		copy(wnCopy.notifications, wn.notifications)
		copy(wnCopy.deletes, wn.deletes)
		writersHeap = append(writersHeap, &wnCopy)
	}
	heap.Init(&writersHeap)

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
			if loggedInUser == nextWriter {
				numProcessed -= loggedInProcessed
			}
			th.byWriter[nextWriter].notifications =
				th.byWriter[nextWriter].notifications[:numProcessed]
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
		if wn != nil && (len(wn.notifications) > 0 || len(wn.deletes) > 0) {
			history = append(history, wn)
		}
		if wn == nil || len(wn.notifications) < maxEditsPerWriter ||
			len(wn.notifications) < maxDeletesPerWriter {
			writersWhoNeedMore[writerName] = true
		}
	}
	if _, ok := th.byWriter[loggedInUser]; !ok {
		// The logged-in user only has unflushed edits.
		wn := r.byWriter[loggedInUser]
		if wn != nil && (len(wn.notifications) > 0 || len(wn.deletes) > 0) {
			history = append(history, wn)
		}
	}
	sort.Sort(history)
	if len(history) > maxWritersPerHistory {
		// Garbage-collect any writers that don't appear in the history.
		loggedInIndex := -1
		for i := maxWritersPerHistory; i < len(history); i++ {
			if history[i].writerName == loggedInUser {
				// Don't purge the logged-in user.
				loggedInIndex = i
				continue
			}
			delete(th.byWriter, history[i].writerName)
			delete(writersWhoNeedMore, history[i].writerName)
		}
		if loggedInIndex > 0 {
			// Keep the logged-in user as the last entry.  Note that
			// `loggedInIndex` is guaranteed to be greater or equal to
			// `maxWritersPerHistory`, so this logic swaps in the
			// loggedIn entry (and doesn't duplicate it).
			history = append(
				history[:maxWritersPerHistory-1], history[loggedInIndex])
		} else {
			history = history[:maxWritersPerHistory]
		}
	}
	th.computed = true
	th.cachedHistory = history
	th.cachedLoggedInUser = loggedInUser
	return history, writersWhoNeedMore
}

func (th *TlfHistory) getHistoryIfCached() (
	cached bool, history writersByRevision, loggedInUser string) {
	th.lock.RLock()
	defer th.lock.RUnlock()
	if th.computed {
		return true, th.cachedHistory, th.cachedLoggedInUser
	}
	return false, nil, ""
}

func (th *TlfHistory) getHistory(loggedInUser string) writersByRevision {
	cached, history, cachedLoggedInUser := th.getHistoryIfCached()
	if cached && loggedInUser == cachedLoggedInUser {
		return history
	}

	th.lock.Lock()
	defer th.lock.Unlock()
	if th.computed {
		// Maybe another goroutine got the lock and recomuted the
		// history since we checked above.
		return th.cachedHistory
	}
	history, _ = th.recomputeLocked(loggedInUser)
	return history
}

// Recompute processes (and caches) the history so that it reflects
// all recently-added notifications, and returns the names of writers
// which don't yet have the maximum number of edits in the history.
func (th *TlfHistory) Recompute(loggedInUser string) (
	writersWhoNeedMore map[string]bool) {
	th.lock.Lock()
	defer th.lock.Unlock()
	_, writersWhoNeedMore = th.recomputeLocked(loggedInUser)
	return writersWhoNeedMore
}
