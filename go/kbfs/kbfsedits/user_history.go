// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/tlf"
)

const (
	// MaxClusters is the max number of TLF writer clusters to return
	// in a user history.
	MaxClusters = 10

	// The minimum number of self-clusters that should appear in the
	// history for the logged-in user.
	minNumSelfClusters = 3
)

type tlfKey struct {
	tlfName tlf.CanonicalName
	tlfType tlf.Type
}

// UserHistory keeps a sorted list of the top known TLF edit
// histories, and can convert those histories into keybase1 protocol
// structs.  TLF histories must be updated by an external caller
// whenever they change.
type UserHistory struct {
	lock      sync.RWMutex
	histories map[tlfKey]writersByRevision
}

// NewUserHistory constructs a UserHistory instance.
func NewUserHistory() *UserHistory {
	return &UserHistory{
		histories: make(map[tlfKey]writersByRevision),
	}
}

// UpdateHistory should be called whenever the edit history for a
// given TLF gets new information.
func (uh *UserHistory) UpdateHistory(
	tlfName tlf.CanonicalName, tlfType tlf.Type, tlfHistory *TlfHistory,
	loggedInUser string) {
	history := tlfHistory.getHistory(loggedInUser)
	key := tlfKey{tlfName, tlfType}

	uh.lock.Lock()
	defer uh.lock.Unlock()
	uh.histories[key] = history
}

func (uh *UserHistory) getTlfHistoryLocked(
	tlfName tlf.CanonicalName, tlfType tlf.Type) (
	history keybase1.FSFolderEditHistory) {
	key := tlfKey{tlfName, tlfType}
	tlfHistory, ok := uh.histories[key]
	if !ok {
		return keybase1.FSFolderEditHistory{}
	}

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

type historyClusters []keybase1.FSFolderEditHistory

func (hc historyClusters) Len() int {
	return len(hc)
}

func (hc historyClusters) Less(i, j int) bool {
	return hc[i].ServerTime > hc[j].ServerTime
}

func (hc historyClusters) Swap(i, j int) {
	hc[i], hc[j] = hc[j], hc[i]
}

// Get returns the full edit history for the user, converted to
// keybase1 protocol structs.
func (uh *UserHistory) Get(loggedInUser string) (
	history []keybase1.FSFolderEditHistory) {
	uh.lock.RLock()
	defer uh.lock.RUnlock()

	var clusters historyClusters
	for key := range uh.histories {
		history := uh.getTlfHistoryLocked(key.tlfName, key.tlfType)

		// Only include public TLFs if they match the logged-in user.
		if history.Folder.FolderType == keybase1.FolderType_PUBLIC {
			names := strings.Split(history.Folder.Name, ",")
			match := false
			for _, name := range names {
				if name == loggedInUser {
					match = true
					break
				}
			}
			if !match {
				continue
			}
		}

		// Break it up into individual clusters
		for _, wh := range history.History {
			if len(wh.Edits) > 0 {
				clusters = append(clusters, keybase1.FSFolderEditHistory{
					Folder:     history.Folder,
					ServerTime: wh.Edits[0].ServerTime,
					History:    []keybase1.FSFolderWriterEditHistory{wh},
				})
			}
		}
	}

	// We need to sort these by clusters, not by the full TLF time.
	sort.Sort(clusters)

	// TODO: consolidate neighboring clusters that share the same folder?
	if len(clusters) > MaxClusters {
		// Find the top self-clusters.
		loggedInIndices := make([]int, 0, minNumSelfClusters)
		for i, c := range clusters {
			if c.History[0].WriterName == loggedInUser {
				loggedInIndices = append(loggedInIndices, i)
			}
			if len(loggedInIndices) == minNumSelfClusters {
				break
			}
		}

		// Move each self-cluster into its rightful spot at the end of
		// the slice, unless it's already at a lower index.
		for i, loggedInIndex := range loggedInIndices {
			newLoggedInIndex := MaxClusters - (len(loggedInIndices) - i)
			if loggedInIndex < newLoggedInIndex {
				continue
			}
			clusters[newLoggedInIndex] = clusters[loggedInIndex]
		}

		return clusters[:MaxClusters]
	}
	return clusters
}

// Clear erases all saved histories; TLFs must be re-added.
func (uh *UserHistory) Clear() {
	uh.lock.Lock()
	defer uh.lock.Unlock()
	uh.histories = make(map[tlfKey]writersByRevision)
}

// ClearTLF removes a TLF from this UserHistory.
func (uh *UserHistory) ClearTLF(tlfName tlf.CanonicalName, tlfType tlf.Type) {
	key := tlfKey{tlfName, tlfType}
	uh.lock.Lock()
	defer uh.lock.Unlock()
	delete(uh.histories, key)
}
