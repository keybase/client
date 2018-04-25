package storage

import (
	"testing"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest/insecure"
	"github.com/keybase/client/go/libkb"
)

func setupCommonTest(t testing.TB, name string) libkb.TestContext {
	tc := externalstest.SetupTest(t, name, 2)

	insecure.InstallInsecureTriplesec(tc.G)
	return tc
}
