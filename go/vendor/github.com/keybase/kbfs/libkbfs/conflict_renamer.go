// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"golang.org/x/net/context"
)

// WriterDeviceDateConflictRenamer renames a file using
// a username, device name, and date.
type WriterDeviceDateConflictRenamer struct {
	config Config
}

// ConflictRename implements the ConflictRename interface for
// TimeAndWriterConflictRenamer.
func (cr WriterDeviceDateConflictRenamer) ConflictRename(
	ctx context.Context, op op, original string) (string, error) {
	now := cr.config.Clock().Now()
	winfo := op.getWriterInfo()
	ui, err := cr.config.KeybaseService().LoadUserPlusKeys(ctx, winfo.uid, "")
	if err != nil {
		return "", err
	}
	deviceName := ui.KIDNames[winfo.key.KID()]
	return cr.ConflictRenameHelper(
		now, string(ui.Name), deviceName, original), nil
}

// ConflictRenameHelper is a helper for ConflictRename especially useful from
// tests.
func (WriterDeviceDateConflictRenamer) ConflictRenameHelper(t time.Time, user, device, original string) string {
	if device == "" {
		device = "unknown"
	}
	base, ext := splitExtension(original)
	date := t.Format("2006-01-02")
	return fmt.Sprintf("%s.conflicted (%s's %s copy %s)%s",
		base, user, device, date, ext)
}

// splitExtension splits filename into a base name and the extension.
func splitExtension(path string) (string, string) {
	for i := len(path) - 1; i > 0; i-- {
		switch path[i] {
		case '.':
			// Handle some multipart extensions
			if i >= 4 && path[i-4:i] == ".tar" {
				i -= 4
			}
			// A leading dot is not an extension
			if i == 0 || path[i-1] == '/' || path[i-1] == '\\' {
				return path, ""
			}
			return path[:i], path[i:]
		case '/', '\\', ' ':
			return path, ""
		}
	}
	return path, ""
}

func newWriterInfo(uid keybase1.UID, key kbfscrypto.VerifyingKey,
	revision kbfsmd.Revision) writerInfo {
	return writerInfo{
		uid:      uid,
		key:      key,
		revision: revision,
	}
}
