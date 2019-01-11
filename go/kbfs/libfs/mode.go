// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"os"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
)

// IsWriter returns whether or not the currently logged-in user is a
// valid writer for the folder described by `h`.
func IsWriter(ctx context.Context, kbpki libkbfs.KBPKI,
	h *libkbfs.TlfHandle) (bool, error) {
	session, err := libkbfs.GetCurrentSessionIfPossible(
		ctx, kbpki, h.Type() == tlf.Public)
	// We are using GetCurrentUserInfoIfPossible here so err is only non-nil if
	// a real problem happened. If the user is logged out, we will get an empty
	// username and uid, with a nil error.
	if err != nil {
		return false, err
	}
	if h.TypeForKeying() == tlf.TeamKeying {
		tid, err := h.FirstResolvedWriter().AsTeam()
		if err != nil {
			return false, err
		}
		isWriter, err := kbpki.IsTeamWriter(
			ctx, tid, session.UID, session.VerifyingKey)
		if err != nil {
			return false, err
		}
		return isWriter, nil
	}
	return h.IsWriter(session.UID), nil
}

// WritePermMode fills in original based on whether or not the
// currently logged-in user is a valid writer for the folder described
// by `h`.
func WritePermMode(
	ctx context.Context, node libkbfs.Node, original os.FileMode,
	kbpki libkbfs.KBPKI, h *libkbfs.TlfHandle) (os.FileMode, error) {
	original &^= os.FileMode(0222) // clear write perm bits

	if node != nil && node.Readonly(ctx) {
		return original, nil
	}

	isWriter, err := IsWriter(ctx, kbpki, h)
	if err != nil {
		return 0, err
	}
	if isWriter {
		original |= 0200
	}

	return original, nil
}
