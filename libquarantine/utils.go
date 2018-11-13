// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libquarantine

import (
	"context"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
)

// IsOnlyWriterInNonTeamTlf returns true if and only if the TLF described by h
// is a non-team TLF, and the currently logged-in user is the only writer for
// the TLF.  In case of any error false is returned.
func IsOnlyWriterInNonTeamTlf(ctx context.Context, kbpki libkbfs.KBPKI,
	h *libkbfs.TlfHandle) bool {
	session, err := libkbfs.GetCurrentSessionIfPossible(
		ctx, kbpki, h.Type() == tlf.Public)
	if err != nil {
		return false
	}
	if h.TypeForKeying() == tlf.TeamKeying {
		return false
	}
	return tlf.UserIsOnlyWriter(session.Name, h.GetCanonicalName())
}
