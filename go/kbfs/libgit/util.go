// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"os"
	"time"

	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
)

const (
	workTimeLimit = 1 * time.Hour
)

// commonTime computes the current time according to our estimate of
// the mdserver's time.  It's a very crude way of normalizing the
// local clock.
func commonTime(
	ctx context.Context, mdserver libkbfs.MDServer, clock libkbfs.Clock,
	log logger.Logger) time.Time {
	offset, haveOffset := mdserver.OffsetFromServerTime()
	if !haveOffset {
		log.CDebugf(ctx, "No offset, cannot use common time; "+
			"falling back to local time")
		return clock.Now()
	}
	return clock.Now().Add(-offset)
}

// canDoWork creates a file that marks the start of some long-term
// work by this node.  It should be called while a lock is taken on
// the server.  It returns true if the caller should start doing the
// work.
func canDoWork(
	ctx context.Context, mdserver libkbfs.MDServer, clock libkbfs.Clock,
	fs *libfs.FS, workingFileName string, workLimit time.Duration,
	log logger.Logger) (bool, error) {
	fi, err := fs.Stat(workingFileName)
	currCommonTime := commonTime(ctx, mdserver, clock, log)
	switch {
	case os.IsNotExist(err):
		log.CDebugf(ctx, "Creating new working file %s", workingFileName)
		f, err := fs.Create(workingFileName)
		if err != nil {
			return false, err
		}
		err = f.Close()
		if err != nil {
			return false, err
		}
	case err != nil:
		return false, err
	default: // err == nil
		modCommonTime := fi.ModTime()
		if modCommonTime.Add(workTimeLimit).After(currCommonTime) {
			log.CDebugf(ctx, "Other worker is still working; "+
				"modCommonTime=%s, currCommonTime=%s, workTimeLimit=%s",
				modCommonTime, currCommonTime, workTimeLimit)
			// The other GC is still running within the time
			// limit.
			return false, nil
		}
		log.CDebugf(ctx, "Other GC expired; "+
			"modCommonTime=%s, currCommonTime=%s, workTimeLimit=%s",
			modCommonTime, currCommonTime, workTimeLimit)
	}

	log.CDebugf(ctx, "Setting work common time to %s", currCommonTime)
	err = fs.Chtimes(workingFileName, time.Time{}, currCommonTime)
	if err != nil {
		return false, err
	}
	return true, nil
}
