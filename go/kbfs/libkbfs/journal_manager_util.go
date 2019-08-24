// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

// GetJournalManager returns the JournalManager tied to a particular
// config.
func GetJournalManager(config Config) (*JournalManager, error) {
	bserver := config.BlockServer()
	jbserver, ok := bserver.(journalBlockServer)
	if !ok {
		return nil, errors.New("Write journal not enabled")
	}
	return jbserver.jManager, nil
}

// TLFJournalEnabled returns true if journaling is enabled for the
// given TLF.
func TLFJournalEnabled(config Config, tlfID tlf.ID) bool {
	if jManager, err := GetJournalManager(config); err == nil {
		return jManager.JournalEnabled(tlfID)
	}
	return false
}

// WaitForTLFJournal waits for the corresponding journal to flush, if
// one exists.
func WaitForTLFJournal(ctx context.Context, config Config, tlfID tlf.ID,
	log logger.Logger) error {
	if jManager, err := GetJournalManager(config); err == nil {
		log.CDebugf(ctx, "Waiting for journal to flush")
		if err := jManager.Wait(ctx, tlfID); err != nil {
			return err
		}
	}
	return nil
}

// FillInJournalStatusUnflushedPaths adds the unflushed paths to the
// given journal status.
func FillInJournalStatusUnflushedPaths(ctx context.Context, config Config,
	jStatus *JournalManagerStatus, tlfIDs []tlf.ID) error {
	if len(tlfIDs) == 0 {
		// Nothing to do.
		return nil
	}

	// Get the folder statuses in parallel.
	eg, groupCtx := errgroup.WithContext(ctx)
	statusesToFetch := make(chan tlf.ID, len(tlfIDs))
	unflushedPaths := make(chan []string, len(tlfIDs))
	storedBytes := make(chan int64, len(tlfIDs))
	unflushedBytes := make(chan int64, len(tlfIDs))
	endEstimates := make(chan *time.Time, len(tlfIDs))
	errIncomplete := errors.New("Incomplete status")
	statusFn := func() error {
		for tlfID := range statusesToFetch {
			select {
			case <-groupCtx.Done():
				return groupCtx.Err()
			default:
			}

			status, _, err := config.KBFSOps().FolderStatus(
				groupCtx, data.FolderBranch{Tlf: tlfID, Branch: data.MasterBranch})
			if err != nil {
				return err
			}
			if status.Journal == nil {
				continue
			}
			up := status.Journal.UnflushedPaths
			unflushedPaths <- up
			if len(up) > 0 && up[len(up)-1] == incompleteUnflushedPathsMarker {
				// There were too many paths to process.  Return an
				// error to stop the other statuses since we have
				// enough to return now.
				return errIncomplete
			}
			storedBytes <- status.Journal.StoredBytes
			unflushedBytes <- status.Journal.UnflushedBytes
			endEstimates <- status.Journal.EndEstimate
		}
		return nil
	}

	// Do up to 10 statuses at a time.
	numWorkers := len(tlfIDs)
	if numWorkers > 10 {
		numWorkers = 10
	}
	for i := 0; i < numWorkers; i++ {
		eg.Go(statusFn)
	}
	for _, tlfID := range tlfIDs {
		statusesToFetch <- tlfID
	}
	close(statusesToFetch)
	if err := eg.Wait(); err != nil && err != errIncomplete {
		return err
	}
	close(unflushedPaths)
	close(storedBytes)
	close(unflushedBytes)
	close(endEstimates)

	// Aggregate all the paths together, but only allow one incomplete
	// marker, at the very end.
	incomplete := false
	for up := range unflushedPaths {
		for _, p := range up {
			if p == incompleteUnflushedPathsMarker {
				incomplete = true
				continue
			}
			jStatus.UnflushedPaths = append(jStatus.UnflushedPaths, p)
		}
	}
	if incomplete {
		jStatus.UnflushedPaths = append(jStatus.UnflushedPaths,
			incompleteUnflushedPathsMarker)
	} else {
		// Replace the existing unflushed byte count with one
		// that's guaranteed consistent with the unflushed
		// paths, and also replace the existing stored byte
		// count with one that's guaranteed consistent with
		// the new unflushed byte count.
		jStatus.StoredBytes = 0
		for sb := range storedBytes {
			jStatus.StoredBytes += sb
		}
		jStatus.UnflushedBytes = 0
		for ub := range unflushedBytes {
			jStatus.UnflushedBytes += ub
		}
		// Pick the latest end estimate.
		for e := range endEstimates {
			if e != nil &&
				(jStatus.EndEstimate == nil || jStatus.EndEstimate.Before(*e)) {
				jStatus.EndEstimate = e
			}
		}
	}
	return nil
}
