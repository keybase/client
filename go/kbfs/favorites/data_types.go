// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package favorites

import (
	"strings"

	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Folder is a top-level favorited folder name.
type Folder struct {
	Name string
	Type tlf.Type
}

// NewFolderFromProtocol creates a Folder from a
// keybase1.Folder.
func NewFolderFromProtocol(folder keybase1.Folder) *Folder {
	name := folder.Name
	if !folder.Private {
		// Old versions of the client still use an outdated "#public"
		// suffix for favorited public folders. TODO: remove this once
		// those old versions of the client are retired.
		const oldPublicSuffix = tlf.ReaderSep + "public"
		name = strings.TrimSuffix(folder.Name, oldPublicSuffix)
	}

	var t tlf.Type
	if folder.FolderType == keybase1.FolderType_UNKNOWN {
		// Use deprecated boolean
		if folder.Private {
			t = tlf.Private
		} else {
			t = tlf.Public
		}
	} else {
		switch folder.FolderType {
		case keybase1.FolderType_PRIVATE:
			t = tlf.Private
		case keybase1.FolderType_PUBLIC:
			t = tlf.Public
		case keybase1.FolderType_TEAM:
			// TODO: if we ever support something other than single
			// teams in the favorites list, we'll have to figure out
			// which type the favorite is from its name.
			t = tlf.SingleTeam
		default:
			// This shouldn't happen, but just in case the service
			// sends us bad info....
			t = tlf.Private
		}
	}

	return &Folder{
		Name: name,
		Type: t,
	}
}

// ToKBFolderHandle creates a keybase1.FolderHandle from a Folder.
func (f Folder) ToKBFolderHandle(created bool) keybase1.FolderHandle {
	return keybase1.FolderHandle{
		Name:       f.Name,
		FolderType: f.Type.FolderType(),
		Created:    created,
	}
}

// Data represents the auxiliary data belonging to a KBFS favorite.
type Data struct {
	Name         string
	FolderType   keybase1.FolderType
	Private      bool
	TeamID       *keybase1.TeamID
	ResetMembers []keybase1.User
	// Mtime is the TLF mtime (i.e. not favorite change time) stored in the
	// core db. It's based on notifications from the mdserver.
	TlfMtime *keybase1.Time
}

// DataFrom returns auxiliary data from a folder sent via the
// keybase1 protocol.
func DataFrom(folder keybase1.Folder) Data {
	return Data{
		Name:         folder.Name,
		FolderType:   folder.FolderType,
		Private:      folder.Private,
		TeamID:       folder.TeamID,
		ResetMembers: folder.ResetMembers,
		TlfMtime:     folder.Mtime,
	}
}

// ToAdd contains the data needed to add a new favorite to the
// favorites list.
type ToAdd struct {
	Folder Folder
	Data   Data

	// Created, if set to true, indicates that this is the first time
	// the TLF has ever existed. It is only used when adding the TLF
	// to favorites
	Created bool
}

// ToKBFolderHandle converts this data into an object suitable for the
// keybase1 protocol.
func (ta ToAdd) ToKBFolderHandle() keybase1.FolderHandle {
	return ta.Folder.ToKBFolderHandle(ta.Created)
}
