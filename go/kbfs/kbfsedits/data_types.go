// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import (
	"time"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

// NotificationVersion is the numeric version of the edit notification
// data structure.
type NotificationVersion int

const (
	// NotificationV1 is unused, but represents the original,
	// MD-ops-based edit notification list.
	NotificationV1 NotificationVersion = 1
	// NotificationV2 is the first version that stores JSON-encoded
	// notifications in chat messages.
	NotificationV2 NotificationVersion = 2
)

// NotificationOpType indicates the type of the operation that caused
// the notification.
type NotificationOpType string

const (
	// NotificationCreate is the type of an edit notification
	// representing a new file or directory creation.
	NotificationCreate NotificationOpType = "create"
	// NotificationModify is the type of an edit notification
	// representing a file modification.
	NotificationModify NotificationOpType = "modify"
	// NotificationRename is the type of an edit notification
	// representing a file or directory getting renamed.
	NotificationRename NotificationOpType = "rename"
	// NotificationDelete is the type of an edit notification
	// representing a file or directory getting deleted.
	NotificationDelete NotificationOpType = "delete"
)

// EntryType indicates the type of the file that was edited.
type EntryType string

const (
	// EntryTypeFile is for files that have been edited.  Note that
	// covers both regular files and executables.
	EntryTypeFile EntryType = "file"
	// EntryTypeDir is for directories that have been edited.
	EntryTypeDir EntryType = "dir"
	// EntryTypeSym is for symlinks that have been edited.
	EntryTypeSym EntryType = "sym"
)

// ModifyRange represents a file modification.  Length is 0 for a
// truncate.
type ModifyRange struct {
	Offset uint64
	Length uint64
}

// NotificationParams is used for op-type-specific data.
type NotificationParams struct {
	OldFilename string        `json:",omitempty"` // for renames
	Modifies    []ModifyRange `json:",omitempty"` // for modifies
}

// NotificationMessage is a summary of a single edit notification in
// KBFS.  It is meant to be encoded and decoded with JSON.
type NotificationMessage struct {
	Version  NotificationVersion
	Filename string
	Type     NotificationOpType
	Time     time.Time // server-reported time
	FileType EntryType
	Revision kbfsmd.Revision
	Device   kbfscrypto.VerifyingKey
	UID      keybase1.UID
	FolderID tlf.ID
	Params   *NotificationParams `json:",omitempty"`

	// For internal sorting, not exported.
	numWithinRevision int
}

// notificationsByRevision sorts NotificationMessages in reverse by
// revision number.
type notificationsByRevision []NotificationMessage

func (nbr notificationsByRevision) Len() int {
	return len(nbr)
}

func (nbr notificationsByRevision) Less(i, j int) bool {
	// Reverse sort, so latest revisions come first.
	if nbr[i].Revision > nbr[j].Revision {
		return true
	} else if nbr[i].Revision < nbr[j].Revision {
		return false
	}
	// If they're equal, check the number within the revision.
	return nbr[i].numWithinRevision > nbr[j].numWithinRevision
}

func (nbr notificationsByRevision) Swap(i, j int) {
	nbr[i], nbr[j] = nbr[j], nbr[i]
}

// uniquify returns a shallow copy of `nbr` with duplicate
// notifications (identified by their revision) removed.  It should
// only be called on a presorted slice, and the returned slice is
// guaranteed to remain sorted.
func (nbr notificationsByRevision) uniquify() (ret notificationsByRevision) {
	toSkip := make(map[int]bool)
	for i, n := range nbr {
		if i > 0 && n.Revision == nbr[i-1].Revision &&
			n.numWithinRevision == nbr[i-1].numWithinRevision {
			toSkip[i] = true
		}
	}

	if len(toSkip) == 0 {
		return nbr
	}

	ret = make(notificationsByRevision, 0, len(nbr)-len(toSkip))
	for i, n := range nbr {
		if !toSkip[i] {
			ret = append(ret, n)
		}
	}
	return ret
}

// SelfWriteMessage is written into a special, private channel when
// the user writes to some TLF.
type SelfWriteMessage struct {
	Version    NotificationVersion
	Folder     keybase1.Folder
	ConvID     chat1.ConversationID
	ServerTime time.Time
}
