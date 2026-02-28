// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"context"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/protocol/keybase1"
)

// TeamMembershipChecker is an interface for objects that can check
// the writer/reader membership of teams.
type TeamMembershipChecker interface {
	// IsTeamWriter checks whether the given user (with the given
	// verifying key) is a writer of the given team right now.
	IsTeamWriter(ctx context.Context, tid keybase1.TeamID, uid keybase1.UID,
		verifyingKey kbfscrypto.VerifyingKey,
		offline keybase1.OfflineAvailability) (bool, error)
	// IsTeamReader checks whether the given user is a reader of the
	// given team right now.
	IsTeamReader(
		ctx context.Context, tid keybase1.TeamID, uid keybase1.UID,
		offline keybase1.OfflineAvailability) (bool, error)
	// TODO: add Was* method for figuring out whether the user was a
	// writer/reader at a particular Merkle root.  Not sure whether
	// these calls should also verify that sequence number corresponds
	// to a given TLF revision, or leave that work to another
	// component.
}
