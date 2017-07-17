// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package externals

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/pvlsource"
)

func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	ret := libkb.SetupTest(tb, name, depth+1)
	ret.G.SetServices(GetServices())
	pvlsource.NewPvlSourceAndInstall(ret.G)
	return ret
}
