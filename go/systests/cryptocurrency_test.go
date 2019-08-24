package systests

import (
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestBech32FeatureFlag(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()
	jan := tt.addUser("abc")
	runEngine := func() error {
		eng := engine.NewCryptocurrencyEngine(jan.MetaContext().G(), keybase1.RegisterAddressArg{
			Address: "bc1qcerjvfmt8qr8xlp6pv4htjhwlj2wgdjnayc3cc",
			Force:   true,
		})
		err := engine.RunEngine2(jan.MetaContext().WithUIs(libkb.UIs{
			LogUI:    jan.MetaContext().G().Log,
			SecretUI: jan.newSecretUI(),
		}), eng)
		return err
	}
	err := runEngine()
	require.NoError(t, err)
}

func TestProveCapitalizedBech32Address(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()
	alice := tt.addUser("abc")

	bech32Test := []struct {
		address string
		valid   bool
	}{
		{"bc1qcerjvfmt8qr8xlp6pv4htjhwlj2wgdjnayc3cc", true},
		{"BC1QCERJVFMT8QR8XLP6PV4HTJHWLJ2WGDJNAYC3CC", true},  // uppercase is accepted
		{"BC1qcerJVFMt8qr8XLP6PV4HTJHWLJ2WGDJNAYC3CC", false}, // mixed case is not
		{"zs1x2q4pej08shm9pd5fx8jvl97f8f7t8sej8lsgp08jsczxsucr5gkff0yasc0gc43dtv3wczerv5", true},
		{"ZS1X2Q4PEJ08SHM9PD5FX8JVL97F8F7T8SEJ8LSGP08JSCZXSUCR5GKFF0YASC0GC43DTV3WCZERV5", true},
		{"zs1X2Q4PEJ08SHM9Pd5fx8JVL97F8F7T8SEJ8LSGP08JSCZXSUCR5GKFF0YASC0GC43DTV3wczerv5", false},
	}
	for _, testAddr := range bech32Test {
		eng := engine.NewCryptocurrencyEngine(alice.MetaContext().G(), keybase1.RegisterAddressArg{
			Address: testAddr.address,
			Force:   true,
		})
		err := engine.RunEngine2(alice.MetaContext().WithUIs(libkb.UIs{
			LogUI:    alice.MetaContext().G().Log,
			SecretUI: alice.newSecretUI(),
		}), eng)
		if testAddr.valid {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
		}
	}
}
