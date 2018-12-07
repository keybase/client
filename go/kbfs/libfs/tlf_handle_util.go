// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/pkg/errors"
)

type noImplicitTeamKBPKI struct {
	libkbfs.KBPKI
}

// ResolveImplicitTeam implements the KBPKI interface for noImplicitTeamKBPKI.
func (nitk noImplicitTeamKBPKI) ResolveImplicitTeam(
	_ context.Context, _, _ string, _ tlf.Type) (
	libkbfs.ImplicitTeamInfo, error) {
	return libkbfs.ImplicitTeamInfo{},
		errors.New("Skipping implicit team lookup for quick handle parsing")
}

// ParseTlfHandlePreferredQuick parses a handle from a name, without
// doing this time consuming checks needed for implicit-team checking
// or TLF-ID-fetching.
func ParseTlfHandlePreferredQuick(
	ctx context.Context, kbpki libkbfs.KBPKI, name string, ty tlf.Type) (
	handle *libkbfs.TlfHandle, err error) {
	// Override the KBPKI with one that doesn't try to resolve
	// implicit teams.
	kbpki = noImplicitTeamKBPKI{kbpki}
	return libkbfs.ParseTlfHandlePreferred(ctx, kbpki, nil, name, ty)
}
