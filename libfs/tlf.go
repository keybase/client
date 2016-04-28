package libfs

import (
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// FilterTLFEarlyExitError decides whether an error received while
// trying to create a TLF should result in showing the user an empty
// folder (exitEarly == true), or not.
func FilterTLFEarlyExitError(ctx context.Context, err error, log logger.Logger, name libkbfs.CanonicalTlfName) (
	exitEarly bool, retErr error) {
	switch err := err.(type) {
	case nil:
		// No error.
		return false, nil

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

	case libkbfs.MDServerErrorWriteAccess:
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
