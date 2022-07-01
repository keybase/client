// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"golang.org/x/net/context"
)

// JournalAction enumerates all the possible actions to take on a
// TLF's journal.
type JournalAction int

const (
	// JournalEnable is to turn the journal on.
	JournalEnable JournalAction = iota
	// JournalFlush is to flush the journal.
	JournalFlush
	// JournalPauseBackgroundWork is to pause journal background
	// work.
	JournalPauseBackgroundWork
	// JournalResumeBackgroundWork is to resume journal background
	// work.
	JournalResumeBackgroundWork
	// JournalDisable is to disable the journal.
	JournalDisable
	// JournalEnableAuto is to turn on journals for all TLFs, persistently.
	JournalEnableAuto
	// JournalDisableAuto is to turn off automatic journaling for new TLFs.
	JournalDisableAuto
)

func (a JournalAction) String() string {
	switch a {
	case JournalEnable:
		return "Enable journal"
	case JournalFlush:
		return "Flush journal"
	case JournalPauseBackgroundWork:
		return "Pause journal background work"
	case JournalResumeBackgroundWork:
		return "Resume journal background work"
	case JournalDisable:
		return "Disable journal"
	case JournalEnableAuto:
		return "Enable auto-journals"
	case JournalDisableAuto:
		return "Disable auto-journals"
	}
	return fmt.Sprintf("JournalAction(%d)", int(a))
}

// Execute performs the action on the given JournalManager for the
// given TLF.
func (a JournalAction) Execute(
	ctx context.Context, jManager *libkbfs.JournalManager,
	tlfID tlf.ID, h *tlfhandle.Handle) error {
	// These actions don't require TLF IDs.
	switch a {
	case JournalEnableAuto:
		return jManager.EnableAuto(ctx)

	case JournalDisableAuto:
		return jManager.DisableAuto(ctx)
	}

	if tlfID == (tlf.ID{}) {
		panic("zero TlfID in JournalAction.Execute")
	}

	switch a {
	case JournalEnable:
		err := jManager.Enable(
			ctx, tlfID, h, libkbfs.TLFJournalBackgroundWorkEnabled)
		if err != nil {
			return err
		}

	case JournalFlush:
		err := jManager.Flush(ctx, tlfID)
		if err != nil {
			return err
		}

	case JournalPauseBackgroundWork:
		jManager.PauseBackgroundWork(ctx, tlfID)

	case JournalResumeBackgroundWork:
		jManager.ResumeBackgroundWork(ctx, tlfID)

	case JournalDisable:
		_, err := jManager.Disable(ctx, tlfID)
		if err != nil {
			return err
		}

	default:
		return fmt.Errorf("Unknown action %s", a)
	}

	return nil
}
