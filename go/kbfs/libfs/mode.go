// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"os"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
)

// IsWriter returns whether or not the currently logged-in user is a
// valid writer for the folder described by `h`.
func IsWriter(ctx context.Context, kbpki libkbfs.KBPKI,
	osg idutil.OfflineStatusGetter, h *tlfhandle.Handle) (bool, error) {
	session, err := idutil.GetCurrentSessionIfPossible(
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
		offline := keybase1.OfflineAvailability_NONE
		if osg != nil {
			offline = osg.OfflineAvailabilityForID(h.TlfID())
		}
		isWriter, err := kbpki.IsTeamWriter(
			ctx, tid, session.UID, session.VerifyingKey, offline)
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
	kbpki libkbfs.KBPKI, osg idutil.OfflineStatusGetter,
	h *tlfhandle.Handle) (os.FileMode, error) {
	original &^= os.FileMode(0222) // clear write perm bits

	if node != nil && node.Readonly(ctx) {
		return original, nil
	}

	isWriter, err := IsWriter(ctx, kbpki, osg, h)
	if err != nil {
		return 0, err
	}
	if isWriter {
		original |= 0200
	}

	return original, nil
}
