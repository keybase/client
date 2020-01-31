// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
)

// RevisionGCdError indicates that a revision has been
// garbage-collected and cannot be indexed.
type RevisionGCdError struct {
	TlfID     tlf.ID
	Rev       kbfsmd.Revision
	LastGCRev kbfsmd.Revision
}

func (e RevisionGCdError) Error() string {
	return fmt.Sprintf(
		"Revision %d for TLF %s is too old to index (last gc rev=%d)",
		e.Rev, e.TlfID, e.LastGCRev)
}

// OldPtrNotFound indicates that the old pointer for a given file
// couldn't be found in the index.
type OldPtrNotFound struct {
	OldPtr data.BlockPointer
}

func (e OldPtrNotFound) Error() string {
	return fmt.Sprintf("Old pointer %s not found in the index", e.OldPtr)
}
