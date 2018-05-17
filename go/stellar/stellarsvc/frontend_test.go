package stellarsvc

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/stretchr/testify/require"
)

func TestGetWalletAccountsLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(tcs[0].G.Bg())
	require.NoError(t, err)

	accountID := tcs[0].Remote.AddAccount(t)

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   tcs[0].Remote.SecretKey(t, accountID),
		MakePrimary: true,
	}
	err = tcs[0].Srv.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	tcs[0].Remote.ImportAccountsForUser(t, tcs[0].G)

	accts, err := tcs[0].Srv.GetWalletAccountsLocal(context.Background(), 0)
	require.NoError(t, err)

	require.Len(t, accts, 2)
	require.Equal(t, accts[0].AccountID, accountID)
	require.True(t, accts[0].IsDefault)
	require.Equal(t, accts[0].Name, "") // TODO: once we can set the name on an account, check this
	require.Equal(t, accts[0].BalanceDescription, "10000 XLM")
	require.False(t, accts[1].IsDefault)
	require.Equal(t, accts[1].Name, "")
	require.Equal(t, accts[1].BalanceDescription, "0 XLM")
}
