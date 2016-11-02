// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

// GetJournalServer returns the JournalServer tied to a particular
// config.
func GetJournalServer(config Config) (*JournalServer, error) {
	bserver := config.BlockServer()
	jbserver, ok := bserver.(journalBlockServer)
	if !ok {
		return nil, errors.New("Write journal not enabled")
	}
	return jbserver.jServer, nil
}

// TLFJournalEnabled returns true if journaling is enabled for the
// given TLF.
func TLFJournalEnabled(config Config, tlfID tlf.ID) bool {
	if jServer, err := GetJournalServer(config); err == nil {
		_, err := jServer.JournalStatus(tlfID)
		return err == nil
	}
	return false
}

// WaitForTLFJournal waits for the corresponding journal to flush, if
// one exists.
func WaitForTLFJournal(ctx context.Context, config Config, tlfID tlf.ID,
	log logger.Logger) error {
	if jServer, err := GetJournalServer(config); err == nil {
		log.CDebugf(ctx, "Waiting for journal to flush")
		if err := jServer.Wait(ctx, tlfID); err != nil {
			return err
		}
	}
	return nil
}

func fillInJournalStatusUnflushedPaths(ctx context.Context, config Config,
	jStatus *JournalServerStatus, tlfIDs []tlf.ID) error {
	if len(tlfIDs) == 0 {
		// Nothing to do.
		return nil
	}

	// Get the folder statuses in parallel.
	eg, groupCtx := errgroup.WithContext(ctx)
	statusesToFetch := make(chan tlf.ID, len(tlfIDs))
	unflushedPaths := make(chan []string, len(tlfIDs))
	unflushedBytes := make(chan int64, len(tlfIDs))
	errIncomplete := errors.New("Incomplete status")
	statusFn := func() error {
		for tlfID := range statusesToFetch {
			select {
			case <-groupCtx.Done():
				return groupCtx.Err()
			default:
			}

			status, _, err := config.KBFSOps().FolderStatus(
				groupCtx, FolderBranch{Tlf: tlfID, Branch: MasterBranch})
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
			unflushedBytes <- status.Journal.UnflushedBytes
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
	close(unflushedBytes)

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
		// Replace the existing unflushed byte count with one that's
		// guaranteed consistent with the unflushed paths.
		jStatus.UnflushedBytes = 0
		for ub := range unflushedBytes {
			jStatus.UnflushedBytes += ub
		}
	}
	return nil
}
