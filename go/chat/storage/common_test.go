package storage

import (
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
)

func setupCommonTest(t testing.TB, name string) kbtest.ChatTestContext {
	tc := externalstest.SetupTest(t, name, 2)

	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, libkb.ClientTriplesecVersion, warner, isProduction)
	}
	ctc := kbtest.ChatTestContext{
		TestContext: tc,
		ChatG: &globals.ChatContext{
			EphemeralPurger: types.DummyEphemeralPurger{},
			Indexer:         types.DummyIndexer{},
		},
	}
	ctc.Context().ServerCacheVersions = NewServerVersions(ctc.Context())
	return ctc
}
