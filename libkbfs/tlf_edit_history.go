// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/kbfssync"
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
)

// TlfEdit represents an individual update about a file edit within a
// TLF.
type TlfEdit struct {
	Filepath  string // relative to the TLF root
	Type      TlfEditNotificationType
	LocalTime time.Time // reflects difference between server and local clock
	cachedOp  op
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

// updateOldEdits removes edits from `we` belonging to files that have
// been removed, and renames ones that have been renamed.
func (we TlfWriterEdits) updateOldEdits(removed map[string]bool,
	renamed map[string]string) {
	if len(removed) == 0 && len(renamed) == 0 {
		return
	}
	for writer, edits := range we {
		var newEdits TlfEditList
		for _, edit := range edits {
			if removed[edit.Filepath] {
				continue
			}
			if newName, ok := renamed[edit.Filepath]; ok {
				edit.Filepath = newName
			}
			newEdits = append(newEdits, edit)
		}
		we[writer] = newEdits
	}
}

// addNewEdits simply adds in edits from the new list to `we`.
func (we TlfWriterEdits) addNewEdits(newEdits TlfWriterEdits) {
	for w, edits := range newEdits {
		for _, edit := range edits {
			we[w] = append(we[w], edit)
		}
	}
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
		writer := rmd.LastModifyingWriter()
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

	rmdsChan chan []ImmutableRootMetadata
	wg       kbfssync.RepeatedWaitGroup
	cancel   context.CancelFunc

	lock     sync.Mutex
	edits    TlfWriterEdits
	shutdown bool
	sends    sync.WaitGroup
}

// NewTlfEditHistory makes a new TLF edit history.
func NewTlfEditHistory(config Config, fbo *folderBranchOps,
	log logger.Logger) *TlfEditHistory {
	processCtx, cancel := context.WithCancel(context.Background())
	teh := &TlfEditHistory{
		config:   config,
		fbo:      fbo,
		log:      log,
		rmdsChan: make(chan []ImmutableRootMetadata, 100),
		cancel:   cancel,
	}
	if config.Mode() == InitMinimal {
		// No need to process updates in minimal mode. TODO: avoid
		// rmdsChan memory overhead?
	} else {
		go teh.process(processCtx)
	}
	return teh
}

// Shutdown shuts down all background processing.
func (teh *TlfEditHistory) Shutdown() {
	teh.lock.Lock()
	teh.shutdown = true
	teh.lock.Unlock()
	teh.cancel()

	// Wait until we're sure all sends have finished before we close
	// the channel.
	teh.sends.Wait()
	close(teh.rmdsChan)
}

// Wait returns nil once all outstanding processing is complete.
func (teh *TlfEditHistory) Wait(ctx context.Context) error {
	if err := teh.wg.Wait(ctx); err != nil {
		return err
	}
	return nil
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
	rmds []ImmutableRootMetadata) (TlfWriterEdits, *crChains, error) {
	chains, err := newCRChainsForIRMDs(
		ctx, teh.config.Codec(), rmds, &teh.fbo.blocks, false)
	if err != nil {
		return nil, nil, err
	}

	// Set the paths on all the ops
	_, err = chains.getPaths(ctx, &teh.fbo.blocks, teh.log, teh.fbo.nodeCache,
		true)
	if err != nil {
		return nil, nil, err
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

				// If a chain exists with sync ops for the file,
				// ignore this create.
				if fileChain, ok := chains.byOriginal[ptr]; ok {
					syncOpFound := false
					for _, fileOp := range fileChain.ops {
						if _, ok := fileOp.(*syncOp); ok {
							syncOpFound = true
							break
						}
					}
					if syncOpFound {
						continue
					}
				}

				writer := op.getWriterInfo().uid
				createdPath := op.getFinalPath().ChildPathNoPtr(realOp.NewName)
				edits[writer] = append(edits[writer], TlfEdit{
					Filepath:  createdPath.String(),
					Type:      FileCreated,
					LocalTime: op.getLocalTimestamp(),
					cachedOp:  op,
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
					cachedOp:  op,
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

	return edits, chains, nil
}

func (teh *TlfEditHistory) setEdits(ctx context.Context,
	currEdits TlfWriterEdits, rmds []ImmutableRootMetadata) {
	// Sort each of the edit lists by timestamp
	for w, list := range currEdits {
		sort.Sort(list)
		if len(list) > desiredEditsPerWriter {
			list = list[len(list)-desiredEditsPerWriter:]
		}
		// Don't copy the ops, we don't need them anymore and we don't
		// want shallow copies of them getting out.
		for i := range list {
			list[i].cachedOp = nil
		}
		currEdits[w] = list
	}
	teh.log.CDebugf(ctx, "Edits complete: %d revisions, starting from "+
		"revision %d", len(rmds), rmds[0].Revision)

	teh.lock.Lock()
	defer teh.lock.Unlock()
	teh.edits = currEdits
}

// GetComplete returns the most recently known set of clustered edit
// history for this TLF.
func (teh *TlfEditHistory) GetComplete(ctx context.Context,
	head ImmutableRootMetadata) (TlfWriterEdits, error) {
	currEdits := teh.getEditsCopy()
	if currEdits != nil {
		return currEdits, nil
	}

	// We have no history -- fetch from the server until we have a
	// complete history.  TODO: make sure only one goroutine tries to
	// calculate the edit history at a time?

	estimates := make(writerEditEstimates)
	for _, writer := range head.GetTlfHandle().ResolvedWriters() {
		estimates[writer] = 0
	}
	rmds := []ImmutableRootMetadata{head}
	estimates.update(rmds)

	// If unmerged, get all the unmerged updates.
	if head.MergedStatus() == Unmerged {
		_, unmergedRmds, err := getUnmergedMDUpdates(ctx, teh.config, head.TlfID(),
			head.BID(), head.Revision()-1)
		if err != nil {
			return nil, err
		}
		estimates.update(unmergedRmds)
		rmds = teh.updateRmds(rmds, unmergedRmds)
	}

	for (currEdits == nil || !currEdits.isComplete()) &&
		len(rmds) < maxMDsToInspect &&
		rmds[0].Revision() > kbfsmd.RevisionInitial {
		teh.log.CDebugf(ctx, "Edits not complete after %d revisions", len(rmds))
		if estimates.isComplete() {
			// Once the estimate hits the threshold for each writer,
			// calculate the chains using all those MDs, and build the
			// real edit map (discounting deleted files, etc).
			var err error
			currEdits, _, err = teh.calculateEditCounts(ctx, rmds)
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
			rmds[0].Revision() > kbfsmd.RevisionInitial {
			// Starting from the head/branchpoint, work backwards
			// mdMax revisions at a time.
			endRev := rmds[0].Revision() - 1
			startRev := endRev - maxMDsAtATime + 1
			if startRev < kbfsmd.RevisionInitial {
				startRev = kbfsmd.RevisionInitial
			}
			// Don't fetch more MDs than we want to include in our
			// estimates.
			if int64(len(rmds))+int64(endRev-startRev)+1 > maxMDsToInspect {
				startRev = kbfsmd.Revision(
					int64(len(rmds)) + (int64(endRev) - maxMDsToInspect) + 1)
			}

			olderRmds, err := getMDRange(ctx, teh.config, head.TlfID(), NullBranchID,
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
		currEdits, _, err = teh.calculateEditCounts(ctx, rmds)
		if err != nil {
			return nil, err
		}
	}

	teh.setEdits(ctx, currEdits, rmds)
	return teh.getEditsCopyLocked(), nil
}

func (teh *TlfEditHistory) updateHistory(ctx context.Context,
	rmds []ImmutableRootMetadata) error {
	defer teh.wg.Done()
	if len(rmds) == 0 {
		return nil
	}
	teh.log.CDebugf(ctx, "Processing %d MDs for notifications "+
		"(most recent revision: %d)", len(rmds), rmds[len(rmds)-1].Revision())

	currEdits := teh.getEditsCopy()
	if currEdits == nil {
		teh.log.CDebugf(ctx, "No history to update; ignoring")
		return nil
	}

	wasComplete := currEdits.isComplete()

	newEdits, chains, err := teh.calculateEditCounts(ctx, rmds)
	if err != nil {
		return err
	}

	// Which paths have been removed?
	removed := make(map[string]bool)
	removeNotifications := make(map[string]*keybase1.FSNotification)
	// TODO: can I used chains.deletedOriginals instead?  It's hard to
	// get the full path that way.
	for _, chain := range chains.byOriginal {
		for _, op := range chain.ops {
			rop, ok := op.(*rmOp)
			if !ok {
				continue
			}
			path := rop.getFinalPath().ChildPathNoPtr(rop.OldName)
			// A rename op might show later that this was only renamed.
			removed[path.String()] = true
			// Add notification.
			removeNotifications[path.String()] = fileDeleteNotification(
				path, rop.getWriterInfo().uid, rop.getLocalTimestamp())
		}
	}

	// Which paths have been renamed?
	renamed := make(map[string]string)
	var notifications []*keybase1.FSNotification
	for original, ri := range chains.renamedOriginals {
		// Find both the old path and the new path using the old and
		// new parents (which are each guaranteed to have at least one
		// op, since the rename operation is split up into two ops).
		oldParentChain, ok := chains.byOriginal[ri.originalOldParent]
		if !ok || len(oldParentChain.ops) == 0 {
			teh.log.CDebugf(ctx, "Couldn't find old parent to a rename "+
				"op for original ptr %v", original)
		}
		oldPath := oldParentChain.ops[0].getFinalPath().
			ChildPathNoPtr(ri.oldName)

		newParentChain, ok := chains.byOriginal[ri.originalNewParent]
		if !ok || len(newParentChain.ops) == 0 {
			teh.log.CDebugf(ctx, "Couldn't find new parent to a rename "+
				"op for original ptr %v", original)
		}

		var renameCreate *createOp
		for _, op := range newParentChain.ops {
			if cop, ok := op.(*createOp); ok && cop.renamed &&
				cop.NewName == ri.newName {
				renameCreate = cop
				break
			}
		}
		if renameCreate == nil {
			return fmt.Errorf("Couldn't find the create op for the %s->%s "+
				"rename", ri.oldName, ri.newName)
		}

		newPath := renameCreate.getFinalPath().ChildPathNoPtr(ri.newName)

		// Ignore any previous rmOps.
		delete(removed, oldPath.String())
		delete(removeNotifications, oldPath.String())
		// If a file was overwritten, ignore all the old edits.
		removed[newPath.String()] = true
		// Rename the file.
		renamed[oldPath.String()] = newPath.String()
		// Add notification.
		notifications = append(notifications, fileRenameNotification(
			oldPath, newPath, renameCreate.getWriterInfo().uid,
			renameCreate.getLocalTimestamp()))
	}

	// Also, remove old edits for new file paths, because the newer
	// edits take precedence.
	for _, edits := range newEdits {
		for _, edit := range edits {
			removed[edit.Filepath] = true
			delete(renamed, edit.Filepath)
		}
	}

	// Remove and rename old edits as needed.
	if len(removed)+len(renamed) > 0 {
		teh.log.CDebugf(ctx, "Removed paths: %v, renamed paths: %v",
			removed, renamed)
		currEdits.updateOldEdits(removed, renamed)
	}

	currEdits.addNewEdits(newEdits)
	// Send the notifications.
	for writer, edits := range newEdits {
		for _, edit := range edits {
			var n *keybase1.FSNotification
			switch edit.Type {
			case FileCreated:
				cop, ok := edit.cachedOp.(*createOp)
				if !ok {
					teh.log.CWarningf(ctx, "No create op for create "+
						"notification, path %s", edit.Filepath)
					continue
				}
				n = fileCreateNotification(
					cop.getFinalPath().ChildPathNoPtr(cop.NewName), writer,
					edit.LocalTime)
			case FileModified:
				n = fileModifyNotification(
					edit.cachedOp.getFinalPath(), writer, edit.LocalTime)
			default:
				teh.log.CWarningf(ctx, "Unrecognized edit type: %v", edit.Type)
				continue
			}
			notifications = append(notifications, n)
		}
	}
	for _, rn := range removeNotifications {
		teh.config.Reporter().Notify(ctx, rn)
	}
	for _, n := range notifications {
		teh.config.Reporter().Notify(ctx, n)
	}

	// If we have a net negative removed, we have to search back
	// farther in time to become complete again.
	if !currEdits.isComplete() && wasComplete {
		teh.log.CDebugf(ctx, "Too many removals; re-calculating edit history")
		func() {
			teh.lock.Lock()
			defer teh.lock.Unlock()
			teh.edits = nil
		}()
		_, err := teh.GetComplete(ctx, rmds[len(rmds)-1])
		return err
	}

	teh.setEdits(ctx, currEdits, rmds)
	return nil
}

func (teh *TlfEditHistory) process(ctx context.Context) {
	for rmds := range teh.rmdsChan {
		ctx := ctxWithRandomIDReplayable(ctx, CtxFBOIDKey, CtxFBOOpID, teh.log)
		err := teh.updateHistory(ctx, rmds)
		if err != nil {
			teh.log.CWarningf(ctx,
				"Error while processing edit notifications: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		default:
		}
	}
}

// UpdateHistory updates the cached edit history, and sends FS
// notifications about the changes.  This assumes the last
// ImmutableRootMetadata in rmds is the current head.
func (teh *TlfEditHistory) UpdateHistory(ctx context.Context,
	rmds []ImmutableRootMetadata) error {
	if teh.config.Mode() == InitMinimal {
		// Minimal mode doesn't have a processor.
		return nil
	}

	// If a shutdown hasn't happened yet, mark ourselves as sending to
	// force the shutdown to wait.
	err := func() error {
		teh.lock.Lock()
		defer teh.lock.Unlock()
		if teh.shutdown {
			return ShutdownHappenedError{}
		}
		teh.sends.Add(1)
		return nil
	}()
	if err != nil {
		return err
	}
	defer teh.sends.Done()

	teh.wg.Add(1)
	select {
	case teh.rmdsChan <- rmds:
	case <-ctx.Done():
		teh.wg.Done()
		return ctx.Err()
	}
	return nil
}
