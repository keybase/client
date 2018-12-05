// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// SyncAction enumerates all the possible actions to take on a
// TLF's sync state.
type SyncAction int

const (
	// SyncEnable is to enable syncing for a TLF.
	SyncEnable SyncAction = iota
	// SyncDisable is to disable syncing for a TLF.
	SyncDisable
)

func (a SyncAction) String() string {
	switch a {
	case SyncEnable:
		return "Enable syncing"
	case SyncDisable:
		return "Disable syncing"
	}
	return fmt.Sprintf("SyncAction(%d)", int(a))
}

// Execute performs the action on the given JournalServer for the
// given TLF.
func (a SyncAction) Execute(
	ctx context.Context, c libkbfs.Config, fb libkbfs.FolderBranch,
	h *libkbfs.TlfHandle) (err error) {
	if fb == (libkbfs.FolderBranch{}) {
		panic("zero fb in SyncAction.Execute")
	}

	// Ensure the TLF is initialized by getting the root node first.
	_, _, err = c.KBFSOps().GetRootNode(ctx, h, libkbfs.MasterBranch)
	if err != nil {
		return err
	}

	switch a {
	case SyncEnable:
		_, err = c.KBFSOps().SetSyncConfig(
			ctx, fb.Tlf, keybase1.FolderSyncConfig{
				Mode: keybase1.FolderSyncMode_ENABLED,
			})

	case SyncDisable:
		_, err = c.KBFSOps().SetSyncConfig(
			ctx, fb.Tlf, keybase1.FolderSyncConfig{
				Mode: keybase1.FolderSyncMode_DISABLED,
			})

	default:
		return fmt.Errorf("Unknown action %s", a)
	}
	if err != nil {
		return err
	}
	// Re-trigger prefetches.
	_, _, err = c.KBFSOps().GetRootNode(ctx, h, fb.Branch)
	return err
}
