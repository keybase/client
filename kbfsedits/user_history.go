// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import (
	"fmt"
	"sort"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/tlf"
)

const (
	// The max number of TLFs to return in a user history
	maxTlfs = 10
)

type tlfKey struct {
	tlfName tlf.CanonicalName
	tlfType tlf.Type
}

type tlfWithHistory struct {
	key     tlfKey
	history writersByRevision
}

type tlfByTime struct {
	histories []tlfWithHistory
	indices   map[tlfKey]int
}

func (tbm tlfByTime) Len() int {
	return len(tbm.histories)
}

func (tbm tlfByTime) Less(i, j int) bool {
	iHistory := tbm.histories[i].history
	jHistory := tbm.histories[j].history

	if len(iHistory) == 0 || len(iHistory[0].notifications) == 0 {
		return false
	} else if len(jHistory) == 0 || len(jHistory[0].notifications) == 0 {
		return true
	}

	iTime := iHistory[0].notifications[0].Time
	jTime := jHistory[0].notifications[0].Time

	return iTime.After(jTime)
}

func (tbm tlfByTime) Swap(i, j int) {
	tbm.histories[i], tbm.histories[j] = tbm.histories[j], tbm.histories[i]
	tbm.indices[tbm.histories[i].key] = i
	tbm.indices[tbm.histories[j].key] = j
}

// UserHistory keeps a sorted list of the top known TLF edit
// histories, and can convert those histories into keybase1 protocol
// structs.  TLF histories must be updated by an external caller
// whenever they change.
type UserHistory struct {
	lock sync.RWMutex
	tlfs tlfByTime
}

// NewUserHistory constructs a UserHistory instance.
func NewUserHistory() *UserHistory {
	return &UserHistory{
		tlfs: tlfByTime{
			indices: make(map[tlfKey]int),
		},
	}
}

// UpdateHistory should be called whenever the edit history for a
// given TLF gets new information.
func (uh *UserHistory) UpdateHistory(
	tlfName tlf.CanonicalName, tlfType tlf.Type, tlfHistory *TlfHistory) {
	history := tlfHistory.getHistory()
	key := tlfKey{tlfName, tlfType}

	uh.lock.Lock()
	defer uh.lock.Unlock()
	if currIndex, ok := uh.tlfs.indices[key]; ok {
		uh.tlfs.histories[currIndex].history = history
	} else {
		uh.tlfs.indices[key] = len(uh.tlfs.indices)
		uh.tlfs.histories = append(
			uh.tlfs.histories, tlfWithHistory{key, history})
	}
	sort.Sort(uh.tlfs)
}

func (uh *UserHistory) getTlfHistoryLocked(
	tlfName tlf.CanonicalName, tlfType tlf.Type) (
	history keybase1.FSFolderEditHistory) {
	key := tlfKey{tlfName, tlfType}
	currIndex, ok := uh.tlfs.indices[key]
	if !ok {
		return keybase1.FSFolderEditHistory{}
	}
	tlfHistory := uh.tlfs.histories[currIndex].history

	folder := keybase1.Folder{
		Name:       string(tlfName),
		FolderType: tlfType.FolderType(),
		Private:    tlfType == tlf.Private,
	}
	history.Folder = folder
	if len(tlfHistory) == 0 {
		return history
	}
	if len(tlfHistory[0].notifications) > 0 {
		history.ServerTime = keybase1.ToTime(
			tlfHistory[0].notifications[0].Time)
	}
	history.History = make(
		[]keybase1.FSFolderWriterEditHistory, len(tlfHistory))
	for i, wn := range tlfHistory {
		history.History[i].WriterName = wn.writerName
		history.History[i].Edits = make(
			[]keybase1.FSFolderWriterEdit, len(wn.notifications))
		for j, n := range wn.notifications {
			history.History[i].Edits[j].Filename = n.Filename
			history.History[i].Edits[j].ServerTime = keybase1.ToTime(n.Time)
			switch n.Type {
			case NotificationCreate:
				history.History[i].Edits[j].NotificationType =
					keybase1.FSNotificationType_FILE_CREATED
			case NotificationModify:
				history.History[i].Edits[j].NotificationType =
					keybase1.FSNotificationType_FILE_MODIFIED
			default:
				panic(fmt.Sprintf("Unknown notification type %s", n.Type))
			}
		}
	}
	return history
}

// GetTlfHistory returns the edit history of a given TLF, converted to
// keybase1 protocol structs.
func (uh *UserHistory) GetTlfHistory(
	tlfName tlf.CanonicalName, tlfType tlf.Type) (
	history keybase1.FSFolderEditHistory) {
	uh.lock.RLock()
	defer uh.lock.RUnlock()
	return uh.getTlfHistoryLocked(tlfName, tlfType)
}

// Get returns the full edit history for the user, converted to
// keybase1 protocol structs.
func (uh *UserHistory) Get() (history []keybase1.FSFolderEditHistory) {
	uh.lock.RLock()
	defer uh.lock.RUnlock()
	for _, h := range uh.tlfs.histories {
		history = append(history, uh.getTlfHistoryLocked(
			h.key.tlfName, h.key.tlfType))
		if len(history) == maxTlfs {
			break
		}
	}
	return history
}

// Clear erases all saved histories; TLFs must be re-added.
func (uh *UserHistory) Clear() {
	uh.lock.Lock()
	defer uh.lock.Unlock()
	uh.tlfs = tlfByTime{
		indices: make(map[tlfKey]int),
	}
}
