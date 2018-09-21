// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package externalstest

import (
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/pvl"
	"github.com/keybase/client/go/uidmap"
)

// SetupTest ignores the third argument.
func SetupTest(tb libkb.TestingTB, name string, depthIgnored int) (tc libkb.TestContext) {
	// libkb.SetupTest ignores the third argument (depth).
	tc = libkb.SetupTest(tb, name, depthIgnored)

	tc.G.SetProofServices(externals.NewProofServices(tc.G))
	tc.G.SetUIDMapper(uidmap.NewUIDMap(10000))
	pvl.NewPvlSourceAndInstall(tc.G)
	externals.NewParamProofStoreAndInstall(tc.G)
	return tc
}
