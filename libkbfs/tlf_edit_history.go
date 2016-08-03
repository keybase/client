// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// TlfEditNotificationType indicates what type of edit happened to a
// file.
type TlfEditNotificationType int

const (
	// FileCreated indicates a new file.
	FileCreated TlfEditNotificationType = iota
	// FileModified indicates an existing file that was written to.
	FileModified
	// FileDeleted indicates an existing file that was deleted.  It
	// doesn't appear in the edit history, only in individual edit
	// updates.
	FileDeleted
)

// TlfEdit represents an individual update about a file edit within a
// TLF.
type TlfEdit struct {
	Filepath  string // relative to the TLF root
	Type      TlfEditNotificationType
	LocalTime time.Time // reflects difference between server and local clock
}

const (
	// How many edits per writer we want to return in the complete history?
	desiredEditsPerWriter = 20

	// How far back we're willing to go to get the complete history.
	maxMDsToInspect = 1000
)

// TlfEditList is a list of edits by a particular user, that can be
// sort by increasing timestamp.
type TlfEditList []TlfEdit

// Len implements sort.Interface for TlfEditList
func (tel TlfEditList) Len() int {
	return len(tel)
}

// Less implements sort.Interface for TlfEditList
func (tel TlfEditList) Less(i, j int) bool {
	return tel[i].LocalTime.Before(tel[j].LocalTime)
}

// Swap implements sort.Interface for TlfEditList
func (tel TlfEditList) Swap(i, j int) {
	tel[j], tel[i] = tel[i], tel[j]
}

// TlfWriterEdits is a map of a writer name to the most recent file
// edits in a given folder by that writer.
type TlfWriterEdits map[keybase1.UID]TlfEditList

func (we TlfWriterEdits) isComplete() bool {
	for _, edits := range we {
		if len(edits) < desiredEditsPerWriter {
			return false
		}
	}
	return true
}

type writerEditEstimates map[keybase1.UID]int

func (wee writerEditEstimates) isComplete() bool {
	for _, count := range wee {
		if count < desiredEditsPerWriter {
			return false
		}
	}
	return true
}

func (wee *writerEditEstimates) update(rmds []ImmutableRootMetadata) {
	for _, rmd := range rmds {
		if rmd.IsWriterMetadataCopiedSet() {
			continue
		}
		writer := rmd.LastModifyingWriter
		for _, op := range rmd.data.Changes.Ops {
			// Estimate the number of writes just based on operations
			// (without yet taking into account whether the same file
			// is being edited more than once).
			switch realOp := op.(type) {
			case *createOp:
				if realOp.Type == Dir || realOp.Type == Sym {
					continue
				}
				(*wee)[writer]++
			case *syncOp:
				(*wee)[writer]++
			}
		}
	}
}

func (wee *writerEditEstimates) reset(edits TlfWriterEdits) {
	for writer := range *wee {
		(*wee)[writer] = len(edits[writer])
	}
}

// TlfEditHistory allows you to get the update history about a
// particular TLF.
type TlfEditHistory struct {
	config Config
	fbo    *folderBranchOps
	log    logger.Logger

	lock  sync.Mutex
	edits TlfWriterEdits
}

func (teh *TlfEditHistory) getEditsCopyLocked() TlfWriterEdits {
	if teh.edits == nil {
		return nil
	}
	edits := make(TlfWriterEdits)
	for user, userEdits := range teh.edits {
		userEditsCopy := make([]TlfEdit, len(userEdits))
		copy(userEditsCopy, userEdits)
		edits[user] = userEditsCopy
	}
	return edits
}

func (teh *TlfEditHistory) getEditsCopy() TlfWriterEdits {
	teh.lock.Lock()
	defer teh.lock.Unlock()
	return teh.getEditsCopyLocked()
}

func (teh *TlfEditHistory) updateRmds(rmds []ImmutableRootMetadata,
	olderRmds []ImmutableRootMetadata) []ImmutableRootMetadata {
	// Avoid hidden sharing with olderRmds by making a copy.
	newRmds := make([]ImmutableRootMetadata, len(olderRmds)+len(rmds))
	copy(newRmds[:len(olderRmds)], olderRmds)
	copy(newRmds[len(olderRmds):], rmds)
	return newRmds
}

func (teh *TlfEditHistory) calculateEditCounts(ctx context.Context,
	rmds []ImmutableRootMetadata) (TlfWriterEdits, error) {
	chains, err := newCRChains(ctx, teh.config, rmds, &teh.fbo.blocks, false)
	if err != nil {
		return nil, err
	}

	// Set the paths on all the ops
	_, err = chains.getPaths(ctx, &teh.fbo.blocks, teh.log, teh.fbo.nodeCache,
		true)
	if err != nil {
		return nil, err
	}

	edits := make(TlfWriterEdits)
	for _, writer := range rmds[len(rmds)-1].GetTlfHandle().ResolvedWriters() {
		edits[writer] = nil
	}

outer:
	for ptr, chain := range chains.byOriginal {
		if chains.isDeleted(ptr) {
			continue
		}

		for i, op := range chain.ops {
			// Count only creates and syncs.
			switch realOp := op.(type) {
			case *createOp:
				if realOp.renamed {
					// Ignore renames for now.  TODO: notify about renames?
					continue
				}
				if realOp.Type == Dir || realOp.Type == Sym {
					// Ignore directories and symlinks. Because who
					// wants notifications for those?
					continue
				}

				// The pointer is actually the newly-referenced Block
				for _, ref := range op.Refs() {
					ptr = ref
					break
				}

				// If a chain exists for the file, ignore this create.
				if _, ok := chains.byOriginal[ptr]; ok {
					continue
				}

				writer := op.getWriterInfo().uid
				createdPath := op.getFinalPath().ChildPathNoPtr(realOp.NewName)
				edits[writer] = append(edits[writer], TlfEdit{
					Filepath:  createdPath.String(),
					Type:      FileCreated,
					LocalTime: op.getLocalTimestamp(),
				})
			case *syncOp:
				lastOp := op
				// Only the final writer matters, so find the last
				// syncOp in this chain.
				for j := len(chain.ops) - 1; j > i; j-- {
					if syncOp, ok := chain.ops[j].(*syncOp); ok {
						lastOp = syncOp
						break
					}
				}

				writer := lastOp.getWriterInfo().uid
				t := FileModified
				if chains.isCreated(ptr) {
					t = FileCreated
				}
				edits[writer] = append(edits[writer], TlfEdit{
					Filepath:  lastOp.getFinalPath().String(),
					Type:      t,
					LocalTime: lastOp.getLocalTimestamp(),
				})
				// We know there will be no creates in this chain
				// since it's a file, so it's safe to skip to the next
				// chain.
				continue outer
			default:
				continue
			}
		}
	}

	return edits, nil
}

// GetComplete returns the most recently known set of clustered edit
// history for this TLF.
func (teh *TlfEditHistory) GetComplete(ctx context.Context,
	head ImmutableRootMetadata) (TlfWriterEdits, error) {
	var currEdits TlfWriterEdits
	/**
	* Once we update currEdits based on notifications, we can uncomment this.
		currEdits := teh.getEditsCopy()
		if currEdits != nil {
			return currEdits, nil
		}
	*/

	// We have no history -- fetch from the server until we have a
	// complete history.

	estimates := make(writerEditEstimates)
	for _, writer := range head.GetTlfHandle().ResolvedWriters() {
		estimates[writer] = 0
	}
	rmds := []ImmutableRootMetadata{head}
	estimates.update(rmds)

	// If unmerged, get all the unmerged updates.
	if head.MergedStatus() == Unmerged {
		_, unmergedRmds, err := getUnmergedMDUpdates(ctx, teh.config, head.ID,
			head.BID, head.Revision-1)
		if err != nil {
			return nil, err
		}
		estimates.update(unmergedRmds)
		rmds = teh.updateRmds(rmds, unmergedRmds)
	}

	for (currEdits == nil || !currEdits.isComplete()) &&
		len(rmds) < maxMDsToInspect &&
		rmds[0].Revision > MetadataRevisionInitial {
		teh.log.CDebugf(ctx, "Edits not complete after %d revisions", len(rmds))
		if estimates.isComplete() {
			// Once the estimate hits the threshold for each writer,
			// calculate the chains using all those MDs, and build the
			// real edit map (discounting deleted files, etc).
			var err error
			currEdits, err = teh.calculateEditCounts(ctx, rmds)
			if err != nil {
				return nil, err
			}
			if currEdits.isComplete() {
				break
			}

			// Set the estimates to their exact known values
			estimates.reset(currEdits)
		}

		for !estimates.isComplete() && len(rmds) < maxMDsToInspect &&
			rmds[0].Revision > MetadataRevisionInitial {
			// Starting from the head/branchpoint, work backwards
			// mdMax revisions at a time.
			endRev := rmds[0].Revision - 1
			startRev := endRev - maxMDsAtATime + 1
			if startRev < MetadataRevisionInitial {
				startRev = MetadataRevisionInitial
			}
			// Don't fetch more MDs than we want to include in our
			// estimates.
			if int64(len(rmds))+int64(endRev-startRev)+1 > maxMDsToInspect {
				startRev = MetadataRevision(
					int64(len(rmds)) + (int64(endRev) - maxMDsToInspect) + 1)
			}

			olderRmds, err := getMDRange(ctx, teh.config, head.ID, NullBranchID,
				startRev, endRev, Merged)
			if err != nil {
				return nil, err
			}

			// Estimate the number of per-writer file operations by
			// keeping a count of the createOps and syncOps found.
			estimates.update(olderRmds)
			rmds = teh.updateRmds(rmds, olderRmds)
		}
	}

	if currEdits == nil {
		// We broke out of the loop early.
		var err error
		currEdits, err = teh.calculateEditCounts(ctx, rmds)
		if err != nil {
			return nil, err
		}
	}

	// Sort each of the edit lists by timestamp
	for w, list := range currEdits {
		sort.Sort(list)
		if len(list) > desiredEditsPerWriter {
			list = list[len(list)-desiredEditsPerWriter:]
		}
		currEdits[w] = list
	}
	teh.log.CDebugf(ctx, "Edits complete: %d revisions, starting from "+
		"revision %d", len(rmds), rmds[0].Revision)

	teh.lock.Lock()
	defer teh.lock.Unlock()
	teh.edits = currEdits
	return teh.getEditsCopyLocked(), nil
}
