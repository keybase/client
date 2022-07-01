package stellarsvc

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestIdentifyWithStellarAccount(t *testing.T) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingFull, usettingFull})
	defer cleanup()

	// Create wallet as user 0. User 0 will be the one being identified.
	acceptDisclaimer(tcs[0])
	accountID := getPrimaryAccountID(tcs[0])

	idUI := &kbtest.FakeIdentifyUI{}
	arg := keybase1.Identify2Arg{
		UserAssertion:    tcs[0].Fu.Username,
		AlwaysBlock:      true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
	}

	// Run identify as user 1.
	tc := tcs[1]

	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
	}

	eng := engine.NewResolveThenIdentify2(tc.G, &arg)
	m := libkb.NewMetaContextForTest(tc.TestContext).WithUIs(uis)
	err := engine.RunEngine2(m, eng)
	require.NoError(t, err)
	res, err := eng.Result(m)
	require.NoError(t, err)

	// Check if Stellar account ID ended up in UPK
	require.NotNil(t, res.Upk.Current.StellarAccountID)
	require.Equal(t, accountID.String(), *res.Upk.Current.StellarAccountID)

	// Check that it went through identify UI.
	require.Len(t, idUI.StellarAccounts, 1)
	acc0 := idUI.StellarAccounts[0]
	t.Logf("Got StellarAccount in identify ui: %+v", acc0)
	require.Equal(t, accountID.String(), acc0.AccountID)
	require.Equal(t, fmt.Sprintf("%s*keybase.io", tcs[0].Fu.Username), acc0.FederationAddress)
	require.NotEmpty(t, acc0.SigID)
}
