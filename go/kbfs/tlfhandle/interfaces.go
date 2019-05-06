// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlfhandle

import (
	"context"

	"github.com/keybase/client/go/kbfs/tlf"
)

// IDGetter is an interface for resolving TLF handles to their TLF IDs.
type IDGetter interface {
	// GetIDForHandle returns the tlf.ID associated with the given
	// handle, if the logged-in user has read permission on the
	// folder.  It may or may not create the folder if it doesn't
	// exist yet, and it may return `tlf.NullID` with a `nil` error if
	// it doesn't create a missing folder.
	GetIDForHandle(ctx context.Context, handle *Handle) (tlf.ID, error)
	// ValidateLatestHandleForTLF returns true if the TLF ID contained
	// in `h` does not currently map to a finalized TLF.
	ValidateLatestHandleNotFinal(ctx context.Context, h *Handle) (
		bool, error)
}
