// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package externalstest

import (
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/pvlsource"
	"github.com/keybase/client/go/uidmap"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
)

// SetupTest ignores the third argument.
func SetupTest(tb libkb.TestingTB, name string, depthIgnored int) (tc libkb.TestContext) {
	// libkb.SetupTest ignores the third argument (depth).
	ret := libkb.SetupTest(tb, name, depthIgnored)

	ret.G.SetServices(externals.GetServices())
	ret.G.SetUIDMapper(uidmap.NewUIDMap(10000))
	pvlsource.NewPvlSourceAndInstall(ret.G)
	return ret
}

func InstallInsecureTriplesec(g *libkb.GlobalContext) {
	g.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { g.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return g.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, warner, isProduction)
	}
}

func SetupTestWithInsecureTriplesec(tb libkb.TestingTB, name string) (tc libkb.TestContext) {
	// libkb.SetupTest ignores the depth argument, so we can safely pass 0.
	tc = SetupTest(tb, name, 0)

	// use an insecure triplesec in tests
	InstallInsecureTriplesec(tc.G)

	return tc
}
