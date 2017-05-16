// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// TlfDoesNotExist is a shortcut error for the cases a TLF does not exist and
// an early successful exit via FilterTLFEarlyExitError is wished.
type TlfDoesNotExist struct{}

// Error - implement error interface.
func (TlfDoesNotExist) Error() string { return "TLF does not exist" }

// FilterTLFEarlyExitError decides whether an error received while
// trying to create a TLF should result in showing the user an empty
// folder (exitEarly == true), or not.
func FilterTLFEarlyExitError(ctx context.Context, err error, log logger.Logger, name libkbfs.CanonicalTlfName) (
	exitEarly bool, retErr error) {
	switch err := err.(type) {
	case nil:
		// No error.
		return false, nil

	case TlfDoesNotExist:
		log.CDebugf(ctx,
			"TLF %s does not exist, so pretending it's empty",
			name)
		return true, nil

	case libkbfs.WriteAccessError:
		// No permission to create TLF, so pretend it's still
		// empty.
		//
		// In theory, we need to invalidate this once the TLF
		// is created, but in practice, the Linux kernel
		// doesn't cache readdir results, and probably not
		// OSXFUSE either.
		log.CDebugf(ctx,
			"No permission to write to %s, so pretending it's empty",
			name)
		return true, nil

	case kbfsmd.ServerErrorWriteAccess:
		// Same as above; cannot fallthrough in type switch
		log.CDebugf(ctx,
			"No permission to write to %s, so pretending it's empty",
			name)
		return true, nil

	default:
		// Some other error.
		return true, err
	}
}
