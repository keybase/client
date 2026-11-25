package stellarsvc

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/stretchr/testify/require"
)

type testUISource struct {
	secretUI libkb.SecretUI
}

func newTestUISource(secretUI libkb.SecretUI) *testUISource {
	if secretUI == nil {
		secretUI = nullSecretUI{}
	}
	return &testUISource{secretUI: secretUI}
}

func (t *testUISource) SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI {
	return t.secretUI
}

type nullSecretUI struct{}

func (nullSecretUI) GetPassphrase(keybase1.GUIEntryArg, *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("nullSecretUI.GetPassphrase")
}

type seedWalletRes struct {
	libkb.AppStatusEmbed
	AccountID stellar1.AccountID `json:"account_id"`
}

// seedWallet posts a first wallet via the devel/CI-only test/stellar_seed_wallet
// endpoint (bypasses disclaimer POST and key/multi).
func seedWallet(mctx libkb.MetaContext, clearBundle stellar1.Bundle) (accountID stellar1.AccountID, err error) {
	if err := clearBundle.CheckInvariants(); err != nil {
		return accountID, err
	}
	pukring, err := mctx.G().GetPerUserKeyring(mctx.Ctx())
	if err != nil {
		return accountID, err
	}
	if err := pukring.Sync(mctx); err != nil {
		return accountID, err
	}
	pukGen := pukring.CurrentGeneration()
	pukSeed, err := pukring.GetSeedByGeneration(mctx, pukGen)
	if err != nil {
		return accountID, err
	}
	boxed, err := bundle.BoxAndEncode(&clearBundle, pukGen, pukSeed)
	if err != nil {
		return accountID, err
	}

	payload := make(libkb.JSONPayload)
	section := make(libkb.JSONPayload)
	section["encrypted_parent"] = boxed.EncParentB64
	section["visible_parent"] = boxed.VisParentB64
	section["version_parent"] = boxed.FormatVersionParent
	section["account_bundles"] = boxed.AcctBundles
	payload["stellar"] = section

	var apiRes seedWalletRes
	err = mctx.G().API.PostDecode(mctx, libkb.APIArg{
		Endpoint:    "test/stellar_seed_wallet",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}, &apiRes)
	return apiRes.AccountID, err
}

// TestExportAgainstSeededWallet signs up a user, seeds a wallet through the
// devel-only test/stellar_seed_wallet endpoint, then checks the export RPCs
// against the real API (accounts list, balances, reveal, passphrase export).
func TestExportAgainstSeededWallet(t *testing.T) {
	tc := libkb.SetupTest(t, "wall", 1)
	defer tc.Cleanup()

	fu, err := kbtest.CreateAndSignupFakeUser("wall", tc.G)
	require.NoError(t, err)

	uiSource := newTestUISource(nullSecretUI{})
	srv := New(tc.G, uiSource)
	mctx := libkb.NewMetaContextForTest(tc)

	clearBundle, err := bundle.NewInitial("export-test")
	require.NoError(t, err)
	require.Len(t, clearBundle.Accounts, 1)
	wantAccountID := clearBundle.Accounts[0].AccountID
	wantSecret := clearBundle.AccountBundles[wantAccountID].Signers[0]

	seededID, err := seedWallet(mctx, *clearBundle)
	require.NoError(t, err)
	require.Equal(t, wantAccountID, seededID)

	accepted, err := srv.HasAcceptedDisclaimerLocal(context.Background(), 0)
	require.NoError(t, err)
	require.True(t, accepted, "seed endpoint should mark the disclaimer accepted")

	cwg, err := stellar.CreateWalletGated(mctx)
	require.NoError(t, err)
	require.True(t, cwg.HasWallet)
	require.True(t, cwg.AcceptedDisclaimer)

	accts, err := srv.GetWalletAccountsLocal(context.Background(), 0)
	require.NoError(t, err)
	require.Len(t, accts, 1)
	require.Equal(t, wantAccountID, accts[0].AccountID)
	require.True(t, accts[0].IsDefault)
	require.Equal(t, "export-test", accts[0].Name)
	require.Equal(t, "0 XLM", accts[0].BalanceDescription)

	revealed, err := srv.GetWalletAccountSecretKeyLocal(context.Background(), stellar1.GetWalletAccountSecretKeyLocalArg{
		AccountID: wantAccountID,
	})
	require.NoError(t, err)
	require.Equal(t, wantSecret, revealed)

	uiSource.secretUI = fu.NewSecretUI()
	exported, err := srv.ExportSecretKeyLocal(context.Background(), wantAccountID)
	require.NoError(t, err)
	require.Equal(t, wantSecret, exported)
}
