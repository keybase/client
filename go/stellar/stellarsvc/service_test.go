package stellarsvc

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/acctbundle"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/client/go/teams"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
	"github.com/stellar/go/keypair"
	"github.com/stretchr/testify/require"
)

func SetupTest(t *testing.T, name string, depth int) (tc libkb.TestContext) {
	tc = externalstest.SetupTest(t, name, depth+1)
	stellar.ServiceInit(tc.G, nil, nil)
	teams.ServiceInit(tc.G)
	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, libkb.ClientTriplesecVersion, warner, isProduction)
	}

	tc.G.SetService()

	tc.G.ChatHelper = kbtest.NewMockChatHelper()

	return tc
}

func TestCreateWallet(t *testing.T) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingFull, usettingFull})
	defer cleanup()

	t.Logf("Lookup for a bogus address")
	uv, _, err := stellar.LookupUserByAccountID(tcs[0].MetaContext(), "GCCJJFCRCQAWDWRAZ3R6235KCQ4PQYE5KEWHGE5ICVTZLTMRKVWAWP7N")
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)

	t.Logf("Create an initial wallet")
	acceptDisclaimer(tcs[0])

	created, err := stellar.CreateWallet(tcs[0].MetaContext(), true)
	require.NoError(t, err)
	require.False(t, created)

	mctx := libkb.NewMetaContextBackground(tcs[0].G)

	t.Logf("Fetch the bundle")
	bundle, _, _, err := remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.Equal(t, stellar1.BundleRevision(1), bundle.Revision)
	require.Nil(t, bundle.Prev)
	require.NotNil(t, bundle.OwnHash)
	require.Len(t, bundle.Accounts, 1)
	require.True(t, len(bundle.Accounts[0].AccountID) > 0)
	require.Equal(t, stellar1.AccountMode_USER, bundle.Accounts[0].Mode)
	require.True(t, bundle.Accounts[0].IsPrimary)
	require.Equal(t, firstAccountName(t, tcs[0]), bundle.Accounts[0].Name)
	accountID := bundle.Accounts[0].AccountID
	require.Len(t, bundle.AccountBundles[accountID].Signers, 0)
	bundle, _, _, err = remote.FetchAccountBundle(context.Background(), tcs[0].G, accountID)
	require.NoError(t, err)
	require.Len(t, bundle.AccountBundles[accountID].Signers, 1)

	t.Logf("Lookup the user by public address as another user")
	a1 := bundle.Accounts[0].AccountID
	uv, username, err := stellar.LookupUserByAccountID(tcs[1].MetaContext(), a1)
	require.NoError(t, err)
	require.Equal(t, tcs[0].Fu.GetUserVersion(), uv)
	require.Equal(t, tcs[0].Fu.Username, username.String())
	t.Logf("and as self")
	uv, _, err = stellar.LookupUserByAccountID(tcs[0].MetaContext(), a1)
	require.NoError(t, err)
	require.Equal(t, tcs[0].Fu.GetUserVersion(), uv)

	t.Logf("Lookup the address by user as another user")
	u0, err := tcs[1].G.LoadUserByUID(tcs[0].G.ActiveDevice.UID())
	require.NoError(t, err)
	addr := u0.StellarAccountID()
	t.Logf("Found account: %v", addr)
	require.NotNil(t, addr)
	_, err = libkb.MakeNaclSigningKeyPairFromStellarAccountID(*addr)
	require.NoError(t, err, "stellar key should be nacl pubable")
	require.Equal(t, bundle.Accounts[0].AccountID.String(), addr.String(), "addr looked up should match secret bundle")

	t.Logf("Change primary accounts")
	a2, s2 := randomStellarKeypair()
	err = tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s2,
		MakePrimary: true,
		Name:        "uu",
	})
	require.NoError(t, err)

	t.Logf("Lookup by the new primary")
	uv, _, err = stellar.LookupUserByAccountID(tcs[1].MetaContext(), a2)
	require.NoError(t, err)
	require.Equal(t, tcs[0].Fu.GetUserVersion(), uv)

	t.Logf("Looking up by the old address no longer works")
	uv, _, err = stellar.LookupUserByAccountID(tcs[1].MetaContext(), a1)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)
}

func TestV1Upkeep(t *testing.T) {
	// TODO: delete this test after the migration from v1 to v2 account bundles
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	acceptDisclaimer(tcs[0])

	mctx := tcs[0].MetaContext()
	bundle, _, pukGen, err := remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	originalID := bundle.OwnHash
	require.NotNil(t, originalID)
	originalPukGen := pukGen

	err = stellar.Upkeep(mctx)
	require.NoError(t, err)

	bundle, _, pukGen, err = remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.Equal(t, bundle.OwnHash, originalID, "bundle should be unchanged by no-op upkeep")
	require.Equal(t, originalPukGen, pukGen)

	t.Logf("rotate puk")
	engArg := &engine.PerUserKeyRollArgs{}
	eng := engine.NewPerUserKeyRoll(tcs[0].G, engArg)
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)
	require.True(t, eng.DidNewKey)

	err = stellar.Upkeep(mctx)
	require.NoError(t, err)

	bundle, _, pukGen, err = remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.NotEqual(t, bundle.OwnHash, originalID, "bundle should be new")
	require.NotEqual(t, originalPukGen, pukGen, "bundle should be for new puk")
	require.Equal(t, 2, int(bundle.Revision))
}

func setupWithNewBundle(t *testing.T, tc *TestContext) {
	ctx := context.Background()
	g := tc.G
	err := remote.SetAcceptedDisclaimer(ctx, g)
	require.NoError(t, err)
	err = stellar.SetMigrationFeatureFlag(tc.MetaContext(), true)
	require.NoError(t, err)
	_, err = stellar.CreateWallet(tc.MetaContext(), true)
	require.NoError(t, err)
}

func TestUpkeep(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()
	g := tcs[0].G
	setupWithNewBundle(t, tcs[0])

	mctx := tcs[0].MetaContext()
	bundle, _, pukGen, err := remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	originalID := bundle.OwnHash
	require.NotNil(t, originalID)
	originalPukGen := pukGen

	err = stellar.Upkeep(mctx)
	require.NoError(t, err)

	bundle, _, pukGen, err = remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.Equal(t, bundle.OwnHash, originalID, "bundle should be unchanged by no-op upkeep")
	require.Equal(t, originalPukGen, pukGen)

	t.Logf("rotate puk")
	engArg := &engine.PerUserKeyRollArgs{}
	eng := engine.NewPerUserKeyRoll(g, engArg)
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)
	require.True(t, eng.DidNewKey)

	err = stellar.Upkeep(mctx)
	require.NoError(t, err)

	bundle, _, pukGen, err = remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.NotEqual(t, bundle.OwnHash, originalID, "bundle should be new")
	require.NotEqual(t, originalPukGen, pukGen, "bundle should be for new puk")
	require.Equal(t, 2, int(bundle.Revision))
}

func TestImportExport(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	srv := tcs[0].Srv

	acceptDisclaimer(tcs[0])

	mustAskForPassphrase := func(f func()) {
		ui := tcs[0].Fu.NewSecretUI()
		tcs[0].Srv.uiSource.(*testUISource).secretUI = ui
		f()
		require.True(t, ui.CalledGetPassphrase, "operation should ask for passphrase")
		tcs[0].Srv.uiSource.(*testUISource).secretUI = nullSecretUI{}
	}

	mustAskForPassphrase(func() {
		_, err := srv.ExportSecretKeyLocal(context.Background(), stellar1.AccountID(""))
		require.Error(t, err, "export empty specifier")
	})

	bundle, _, _, err := remote.FetchWholeBundle(context.Background(), tcs[0].G)
	require.NoError(t, err)

	mustAskForPassphrase(func() {
		accountID := bundle.Accounts[0].AccountID
		exported, err := srv.ExportSecretKeyLocal(context.Background(), accountID)
		require.NoError(t, err)
		require.Equal(t, bundle.AccountBundles[accountID].Signers[0], exported)
	})

	a1, s1 := randomStellarKeypair()
	argS1 := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s1,
		MakePrimary: false,
		Name:        "qq",
	}
	err = srv.ImportSecretKeyLocal(context.Background(), argS1)
	require.NoError(t, err)

	mustAskForPassphrase(func() {
		accountID := bundle.Accounts[0].AccountID
		exported, err := srv.ExportSecretKeyLocal(context.Background(), accountID)
		require.NoError(t, err)
		require.Equal(t, bundle.AccountBundles[accountID].Signers[0], exported)
	})

	mustAskForPassphrase(func() {
		exported, err := srv.ExportSecretKeyLocal(context.Background(), a1)
		require.NoError(t, err)
		require.Equal(t, s1, exported)
	})

	withWrongPassphrase := func(f func()) {
		ui := &libkb.TestSecretUI{Passphrase: "notquite" + tcs[0].Fu.Passphrase}
		tcs[0].Srv.uiSource.(*testUISource).secretUI = ui
		f()
		require.True(t, ui.CalledGetPassphrase, "operation should ask for passphrase")
		tcs[0].Srv.uiSource.(*testUISource).secretUI = nullSecretUI{}
	}

	withWrongPassphrase(func() {
		_, err := srv.ExportSecretKeyLocal(context.Background(), a1)
		require.Error(t, err)
		require.IsType(t, libkb.PassphraseError{}, err)
	})

	_, err = srv.ExportSecretKeyLocal(context.Background(), stellar1.AccountID(s1))
	require.Error(t, err, "export confusing secret and public")

	err = srv.ImportSecretKeyLocal(context.Background(), argS1)
	require.Error(t, err)

	u0, err := tcs[1].G.LoadUserByUID(tcs[0].G.ActiveDevice.UID())
	require.NoError(t, err)
	addr := u0.StellarAccountID()
	require.False(t, a1.Eq(*addr))

	a2, s2 := randomStellarKeypair()
	own, err := srv.OwnAccountLocal(context.Background(), a2)
	require.NoError(t, err)
	require.False(t, own)

	argS2 := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s2,
		MakePrimary: true,
		Name:        "uu",
	}
	err = srv.ImportSecretKeyLocal(context.Background(), argS2)
	require.NoError(t, err)

	u0, err = tcs[1].G.LoadUserByUID(tcs[0].G.ActiveDevice.UID())
	require.NoError(t, err)
	addr = u0.StellarAccountID()
	require.False(t, a1.Eq(*addr))

	err = srv.ImportSecretKeyLocal(context.Background(), argS2)
	require.Error(t, err)

	own, err = srv.OwnAccountLocal(context.Background(), a1)
	require.NoError(t, err)
	require.True(t, own)
	own, err = srv.OwnAccountLocal(context.Background(), a2)
	require.NoError(t, err)
	require.True(t, own)

	mctx := libkb.NewMetaContextBackground(tcs[0].G)
	bundle, _, _, err = remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.Len(t, bundle.Accounts, 3)
}

func TestBalances(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	accountID := tcs[0].Backend.AddAccount()

	balances, err := tcs[0].Srv.BalancesLocal(context.Background(), accountID)
	if err != nil {
		t.Fatal(err)
	}

	require.Len(t, balances, 1)
	require.Equal(t, balances[0].Asset.Type, "native")
	require.Equal(t, balances[0].Amount, "10000")
}

func TestGetWalletAccountsCLILocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	acceptDisclaimer(tcs[0])

	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	accs, err := tcs[0].Srv.WalletGetAccountsCLILocal(context.Background())
	require.NoError(t, err)

	require.Len(t, accs, 1)
	account := accs[0]
	require.Len(t, account.Balance, 1)
	require.Equal(t, account.Balance[0].Asset.Type, "native")
	require.Equal(t, account.Balance[0].Amount, "0")
	require.True(t, account.IsPrimary)
	require.NotNil(t, account.ExchangeRate)
	require.EqualValues(t, stellar.DefaultCurrencySetting, account.ExchangeRate.Currency)
}

func TestSendLocalStellarAddress(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	acceptDisclaimer(tcs[0])

	srv := tcs[0].Srv
	rm := tcs[0].Backend
	accountIDSender := rm.AddAccount()
	accountIDRecip := rm.AddAccount()

	err := srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDSender),
		MakePrimary: true,
		Name:        "uu",
	})
	require.NoError(t, err)

	arg := stellar1.SendCLILocalArg{
		Recipient: accountIDRecip.String(),
		Amount:    "100",
		Asset:     stellar1.Asset{Type: "native"},
	}
	_, err = srv.SendCLILocal(context.Background(), arg)
	require.NoError(t, err)

	balances, err := srv.BalancesLocal(context.Background(), accountIDSender)
	if err != nil {
		t.Fatal(err)
	}
	require.Equal(t, balances[0].Amount, "9899.9999900")

	balances, err = srv.BalancesLocal(context.Background(), accountIDRecip)
	if err != nil {
		t.Fatal(err)
	}
	require.Equal(t, balances[0].Amount, "10100.0000000")

	senderMsgs := kbtest.MockSentMessages(tcs[0].G, tcs[0].T)
	require.Len(t, senderMsgs, 0)
}

func TestSendLocalKeybase(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	acceptDisclaimer(tcs[1])

	srvSender := tcs[0].Srv
	rm := tcs[0].Backend
	accountIDSender := rm.AddAccount()
	accountIDRecip := rm.AddAccount()

	srvRecip := tcs[1].Srv

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDSender),
		MakePrimary: true,
		Name:        "uu",
	}
	err := srvSender.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	argImport.SecretKey = rm.SecretKey(accountIDRecip)
	err = srvRecip.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	arg := stellar1.SendCLILocalArg{
		Recipient: strings.ToUpper(tcs[1].Fu.Username),
		Amount:    "100",
		Asset:     stellar1.AssetNative(),
	}
	_, err = srvSender.SendCLILocal(context.Background(), arg)
	require.NoError(t, err)

	balances, err := srvSender.BalancesLocal(context.Background(), accountIDSender)
	if err != nil {
		t.Fatal(err)
	}
	require.Equal(t, "9899.9999900", balances[0].Amount)

	balances, err = srvRecip.BalancesLocal(context.Background(), accountIDRecip)
	if err != nil {
		t.Fatal(err)
	}
	require.Equal(t, "10100.0000000", balances[0].Amount)

	senderMsgs := kbtest.MockSentMessages(tcs[0].G, tcs[0].T)
	require.Len(t, senderMsgs, 1)
	require.Equal(t, senderMsgs[0].MsgType, chat1.MessageType_SENDPAYMENT)
}

func TestRecentPaymentsLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	acceptDisclaimer(tcs[1])

	srvSender := tcs[0].Srv
	rm := tcs[0].Backend
	accountIDSender := rm.AddAccount()
	accountIDRecip := rm.AddAccount()

	srvRecip := tcs[1].Srv

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDSender),
		MakePrimary: true,
		Name:        "uu",
	}
	err := srvSender.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	argImport.SecretKey = rm.SecretKey(accountIDRecip)
	err = srvRecip.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	arg := stellar1.SendCLILocalArg{
		Recipient: tcs[1].Fu.Username,
		Amount:    "100",
		Asset:     stellar1.Asset{Type: "native"},
	}
	_, err = srvSender.SendCLILocal(context.Background(), arg)
	require.NoError(t, err)

	checkPayment := func(p stellar1.PaymentCLILocal) {
		require.Equal(t, accountIDSender, p.FromStellar)
		require.Equal(t, accountIDRecip, *p.ToStellar)
		require.NotNil(t, p.ToUsername)
		require.Equal(t, tcs[1].Fu.Username, *(p.ToUsername))
		require.Equal(t, "100.0000000", p.Amount)
	}
	senderPayments, err := srvSender.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, senderPayments, 1)
	require.NotNil(t, senderPayments[0].Payment, senderPayments[0].Err)
	checkPayment(*senderPayments[0].Payment)

	recipPayments, err := srvRecip.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, recipPayments, 1)
	require.NotNil(t, recipPayments[0].Payment, recipPayments[0].Err)
	checkPayment(*recipPayments[0].Payment)

	payment, err := srvSender.PaymentDetailCLILocal(context.Background(), senderPayments[0].Payment.TxID.String())
	require.NoError(t, err)
	checkPayment(payment)
	payment, err = srvRecip.PaymentDetailCLILocal(context.Background(), recipPayments[0].Payment.TxID.String())
	require.NoError(t, err)
	checkPayment(payment)
}

func TestRelayTransferInnards(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	stellarSender, senderAccountBundle, err := stellar.LookupSenderPrimary(tcs[0].MetaContext())
	require.NoError(t, err)
	require.Equal(t, stellarSender.AccountID, senderAccountBundle.AccountID)

	u1, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tcs[0].G, tcs[1].Fu.Username))
	require.NoError(t, err)

	t.Logf("create relay transfer")
	m := libkb.NewMetaContextBackground(tcs[0].G)
	recipient, err := stellar.LookupRecipient(m, stellarcommon.RecipientInput(u1.GetNormalizedName()), false)
	require.NoError(t, err)
	appKey, teamID, err := relays.GetKey(m, recipient)
	require.NoError(t, err)
	out, err := relays.Create(relays.Input{
		From:          senderAccountBundle.Signers[0],
		AmountXLM:     "10.0005",
		Note:          "hey",
		EncryptFor:    appKey,
		SeqnoProvider: stellar.NewSeqnoProvider(libkb.NewMetaContextForTest(tcs[0].TestContext), tcs[0].Srv.walletState),
	})
	require.NoError(t, err)
	_, err = libkb.ParseStellarAccountID(out.RelayAccountID.String())
	require.NoError(t, err)
	require.True(t, len(out.FundTx.Signed) > 100)

	t.Logf("decrypt")
	relaySecrets, err := relays.DecryptB64(tcs[0].MetaContext(), teamID, out.EncryptedB64)
	require.NoError(t, err)
	_, accountID, _, err := libkb.ParseStellarSecretKey(relaySecrets.Sk.SecureNoLogString())
	require.NoError(t, err)
	require.Equal(t, out.RelayAccountID, accountID)
	require.Len(t, relaySecrets.StellarID, 64)
	require.Equal(t, "hey", relaySecrets.Note)
}

func TestRelaySBSClaim(t *testing.T) {
	testRelaySBS(t, false)
}

func TestRelaySBSYank(t *testing.T) {
	testRelaySBS(t, true)
}

func testRelaySBS(t *testing.T, yank bool) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingFull, usettingPukless})
	defer cleanup()

	acceptDisclaimer(tcs[0])

	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	tcs[0].Backend.Gift(getPrimaryAccountID(tcs[0]), "5")
	sendRes, err := tcs[0].Srv.SendCLILocal(context.Background(), stellar1.SendCLILocalArg{
		Recipient: tcs[1].Fu.Username,
		Amount:    "3",
		Asset:     stellar1.AssetNative(),
	})
	require.NoError(t, err)

	details, err := tcs[0].Backend.PaymentDetails(context.Background(), tcs[0], sendRes.KbTxID.String())
	require.NoError(t, err)

	claimant := 0
	if !yank {
		claimant = 1

		tcs[1].Tp.DisableUpgradePerUserKey = false
		acceptDisclaimer(tcs[1])

		tcs[0].Backend.ImportAccountsForUser(tcs[claimant])

		// The implicit team has an invite for the claimant. Now the sender signs them into the team.
		t.Logf("Sender keys recipient into implicit team")
		teamID := details.Summary.Relay().TeamID
		team, err := teams.Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{ID: teamID})
		require.NoError(t, err)
		invite, _, found := team.FindActiveKeybaseInvite(tcs[claimant].Fu.GetUID())
		require.True(t, found)
		err = teams.HandleSBSRequest(context.Background(), tcs[0].G, keybase1.TeamSBSMsg{
			TeamID: teamID,
			Invitees: []keybase1.TeamInvitee{{
				InviteID:    invite.Id,
				Uid:         tcs[claimant].Fu.GetUID(),
				EldestSeqno: tcs[claimant].Fu.EldestSeqno,
				Role:        keybase1.TeamRole_ADMIN,
			}},
		})
		require.NoError(t, err)
	}

	tcs[claimant].Srv.walletState.RefreshAll(tcs[claimant].MetaContext(), "test")

	history, err := tcs[claimant].Srv.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, history, 1)
	require.Nil(t, history[0].Err)
	require.NotNil(t, history[0].Payment)
	require.Equal(t, "Claimable", history[0].Payment.Status)
	txID := history[0].Payment.TxID

	fhistory, err := tcs[claimant].Srv.GetPendingPaymentsLocal(context.Background(), stellar1.GetPendingPaymentsLocalArg{AccountID: getPrimaryAccountID(tcs[claimant])})
	require.NoError(t, err)
	require.Len(t, fhistory, 1)
	require.Nil(t, fhistory[0].Err)
	require.NotNil(t, fhistory[0].Payment)
	require.NotEmpty(t, fhistory[0].Payment.Id)
	require.NotZero(t, fhistory[0].Payment.Time)
	require.Equal(t, stellar1.PaymentStatus_CLAIMABLE, fhistory[0].Payment.StatusSimplified)
	require.Equal(t, "claimable", fhistory[0].Payment.StatusDescription)
	if yank {
		require.Equal(t, "3 XLM", fhistory[0].Payment.AmountDescription)
		require.Equal(t, stellar1.BalanceDelta_DECREASE, fhistory[0].Payment.Delta)
	} else {
		require.Equal(t, "3 XLM", fhistory[0].Payment.AmountDescription)
		require.Equal(t, stellar1.BalanceDelta_INCREASE, fhistory[0].Payment.Delta) // assertion related to CORE-9322
	}

	tcs[0].Backend.AssertBalance(getPrimaryAccountID(tcs[0]), "1.9999900")
	if !yank {
		tcs[claimant].Backend.AssertBalance(getPrimaryAccountID(tcs[claimant]), "0")
	}

	res, err := tcs[claimant].Srv.ClaimCLILocal(context.Background(), stellar1.ClaimCLILocalArg{TxID: txID.String()})
	require.NoError(t, err)
	require.NotEqual(t, "", res.ClaimStellarID)

	if !yank {
		tcs[0].Backend.AssertBalance(getPrimaryAccountID(tcs[0]), "1.9999900")
		tcs[claimant].Backend.AssertBalance(getPrimaryAccountID(tcs[claimant]), "2.9999800")
	} else {
		tcs[claimant].Backend.AssertBalance(getPrimaryAccountID(tcs[claimant]), "4.9999800")
	}

	frontendExpStatusSimp := stellar1.PaymentStatus_COMPLETED
	frontendExpToAssertion := tcs[1].Fu.Username
	frontendExpOrigToAssertion := ""
	if yank {
		frontendExpStatusSimp = stellar1.PaymentStatus_CANCELED
		frontendExpToAssertion, frontendExpOrigToAssertion = frontendExpOrigToAssertion, frontendExpToAssertion
	}
	frontendExpStatusDesc := strings.ToLower(frontendExpStatusSimp.String())
	checkStatusesAndAssertions := func(p *stellar1.PaymentLocal) {
		require.Equal(t, frontendExpStatusSimp, p.StatusSimplified)
		require.Equal(t, frontendExpStatusDesc, p.StatusDescription)
		require.Equal(t, frontendExpToAssertion, p.ToAssertion)
		require.Equal(t, frontendExpOrigToAssertion, p.OriginalToAssertion)
	}

	history, err = tcs[claimant].Srv.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, history, 1)
	require.Nil(t, history[0].Err)
	require.NotNil(t, history[0].Payment)
	if !yank {
		require.Equal(t, "Completed", history[0].Payment.Status)
	} else {
		require.Equal(t, "Canceled", history[0].Payment.Status)
	}

	fhistoryPage, err := tcs[claimant].Srv.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: getPrimaryAccountID(tcs[claimant])})
	require.NoError(t, err)
	fhistory = fhistoryPage.Payments
	require.Len(t, fhistory, 1)
	require.Nil(t, fhistory[0].Err)
	require.NotNil(t, fhistory[0].Payment)
	checkStatusesAndAssertions(fhistory[0].Payment)

	history, err = tcs[0].Srv.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, history, 1)
	require.Nil(t, history[0].Err)
	require.NotNil(t, history[0].Payment)
	if !yank {
		require.Equal(t, "Completed", history[0].Payment.Status)
	} else {
		require.Equal(t, "Canceled", history[0].Payment.Status)
	}

	tcs[0].Srv.walletState.RefreshAll(tcs[0].MetaContext(), "test")

	fhistoryPage, err = tcs[0].Srv.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: getPrimaryAccountID(tcs[0])})
	require.NoError(t, err)
	fhistory = fhistoryPage.Payments
	require.Len(t, fhistory, 1)
	require.Nil(t, fhistory[0].Err)
	require.NotNil(t, fhistory[0].Payment)
	checkStatusesAndAssertions(fhistory[0].Payment)

	t.Logf("try to claim again")
	res, err = tcs[claimant].Srv.ClaimCLILocal(context.Background(), stellar1.ClaimCLILocalArg{TxID: txID.String()})
	require.Error(t, err)
	require.Equal(t, "Payment already claimed by "+tcs[claimant].Fu.Username, err.Error())
}

func TestRelayResetClaim(t *testing.T) {
	testRelayReset(t, false)
}

func TestRelayResetYank(t *testing.T) {
	testRelayReset(t, true)
}

func testRelayReset(t *testing.T, yank bool) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingFull, usettingFull})
	defer cleanup()

	acceptDisclaimer(tcs[0])

	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	tcs[0].Backend.Gift(getPrimaryAccountID(tcs[0]), "10")

	sendRes, err := tcs[0].Srv.SendCLILocal(context.Background(), stellar1.SendCLILocalArg{
		Recipient: tcs[1].Fu.Username,
		Amount:    "4",
		Asset:     stellar1.AssetNative(),
	})
	require.NoError(t, err)

	details, err := tcs[0].Backend.PaymentDetails(context.Background(), tcs[0], sendRes.KbTxID.String())
	require.NoError(t, err)

	typ, err := details.Summary.Typ()
	require.NoError(t, err)
	require.Equal(t, stellar1.PaymentSummaryType_RELAY, typ)

	// Reset and reprovision
	kbtest.ResetAccount(tcs[1].TestContext, tcs[1].Fu)
	require.NoError(t, tcs[1].Fu.Login(tcs[1].G))

	teamID := details.Summary.Relay().TeamID
	t.Logf("Team ID is: %s", teamID)

	var claimant int
	if !yank {
		// Admit back to the team.
		err = teams.ReAddMemberAfterReset(context.Background(), tcs[0].G, teamID, tcs[1].Fu.Username)
		require.NoError(t, err)

		acceptDisclaimer(tcs[1])
		tcs[1].Backend.ImportAccountsForUser(tcs[1])

		claimant = 1
	} else {
		// User0 will try to claim the funds back without readding user1 to the
		// impteam. Also do not accept disclaimer as user1.
		claimant = 0
	}

	tcs[claimant].Srv.walletState.RefreshAll(tcs[claimant].MetaContext(), "test")
	tcs[claimant].Srv.walletState.DumpToLog(tcs[claimant].MetaContext())

	history, err := tcs[claimant].Srv.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, history, 1)
	require.Nil(t, history[0].Err)
	require.NotNil(t, history[0].Payment)
	require.Equal(t, "Claimable", history[0].Payment.Status)
	txID := history[0].Payment.TxID

	t.Logf("claimant primary account id: %s", getPrimaryAccountID(tcs[claimant]))

	fhistory, err := tcs[claimant].Srv.GetPendingPaymentsLocal(context.Background(),
		stellar1.GetPendingPaymentsLocalArg{AccountID: getPrimaryAccountID(tcs[claimant])})
	require.NoError(t, err)
	require.Len(t, fhistory, 1)
	require.Nil(t, fhistory[0].Err)
	require.NotNil(t, fhistory[0].Payment)
	require.NotEmpty(t, fhistory[0].Payment.Id)
	require.NotZero(t, fhistory[0].Payment.Time)
	require.Equal(t, stellar1.PaymentStatus_CLAIMABLE, fhistory[0].Payment.StatusSimplified)
	require.Equal(t, "claimable", fhistory[0].Payment.StatusDescription)

	res, err := tcs[claimant].Srv.ClaimCLILocal(context.Background(), stellar1.ClaimCLILocalArg{TxID: txID.String()})
	require.NoError(t, err)
	require.NotEqual(t, "", res.ClaimStellarID)

	if !yank {
		tcs[0].Backend.AssertBalance(getPrimaryAccountID(tcs[0]), "5.9999900")
		tcs[1].Backend.AssertBalance(getPrimaryAccountID(tcs[1]), "3.9999800")
	} else {
		tcs[0].Backend.AssertBalance(getPrimaryAccountID(tcs[0]), "9.9999800")
	}
}

func TestGetAvailableCurrencies(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	conf, err := tcs[0].G.GetStellar().GetServerDefinitions(context.Background())
	require.NoError(t, err)
	require.Equal(t, conf.Currencies["USD"].Name, "US Dollar")
	require.Equal(t, conf.Currencies["EUR"].Name, "Euro")
}

func TestDefaultCurrency(t *testing.T) {
	// Initial account are created without display currency. When an account
	// has no currency selected, default "USD" is used. Additional accounts
	// display currencies should be set to primary account currency or NULL as
	// well (and can later be changed by the user).

	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	primary := getPrimaryAccountID(tcs[0])
	currency, err := remote.GetAccountDisplayCurrency(context.Background(), tcs[0].G, primary)
	require.NoError(t, err)
	require.EqualValues(t, "", currency)

	// stellar.GetAccountDisplayCurrency also checks for NULLs and returns
	// default currency code.
	codeStr, err := stellar.GetAccountDisplayCurrency(tcs[0].MetaContext(), primary)
	require.NoError(t, err)
	require.Equal(t, "USD", codeStr)

	err = tcs[0].Srv.SetDisplayCurrency(context.Background(), stellar1.SetDisplayCurrencyArg{
		AccountID: primary,
		Currency:  "EUR",
	})
	require.NoError(t, err)

	currency, err = remote.GetAccountDisplayCurrency(context.Background(), tcs[0].G, primary)
	require.NoError(t, err)
	require.EqualValues(t, "EUR", currency)

	a1, s1 := randomStellarKeypair()
	err = tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s1,
		MakePrimary: false,
		Name:        "uu",
	})
	require.NoError(t, err)

	// Should be "EUR" as well, inherited from primary account. Try to
	// use RPC instead of remote endpoint directly this time.
	currencyObj, err := tcs[0].Srv.GetDisplayCurrencyLocal(context.Background(), stellar1.GetDisplayCurrencyLocalArg{
		AccountID: &a1,
	})
	require.NoError(t, err)
	require.IsType(t, stellar1.CurrencyLocal{}, currencyObj)
	require.Equal(t, stellar1.OutsideCurrencyCode("EUR"), currencyObj.Code)
}

func TestRequestPayment(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	acceptDisclaimer(tcs[1])
	xlm := stellar1.AssetNative()
	reqID, err := tcs[0].Srv.MakeRequestCLILocal(context.Background(), stellar1.MakeRequestCLILocalArg{
		Recipient: tcs[1].Fu.Username,
		Asset:     &xlm,
		Amount:    "5.23",
		Note:      "hello world",
	})
	require.NoError(t, err)

	senderMsgs := kbtest.MockSentMessages(tcs[0].G, tcs[0].T)
	require.Len(t, senderMsgs, 1)
	require.Equal(t, senderMsgs[0].MsgType, chat1.MessageType_REQUESTPAYMENT)

	err = tcs[0].Srv.CancelRequestLocal(context.Background(), stellar1.CancelRequestLocalArg{
		ReqID: reqID,
	})
	require.NoError(t, err)

	details, err := tcs[0].Srv.GetRequestDetailsLocal(context.Background(), stellar1.GetRequestDetailsLocalArg{
		ReqID: reqID,
	})
	require.NoError(t, err)
	require.Equal(t, stellar1.RequestStatus_CANCELED, details.Status)
	require.Equal(t, "5.23", details.Amount)
	require.Nil(t, details.Currency)
	require.NotNil(t, details.Asset)
	require.Equal(t, stellar1.AssetNative(), *details.Asset)
	require.Equal(t, "5.23 XLM", details.AmountDescription)
}

func TestRequestPaymentOutsideCurrency(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	acceptDisclaimer(tcs[1])
	reqID, err := tcs[0].Srv.MakeRequestCLILocal(context.Background(), stellar1.MakeRequestCLILocalArg{
		Recipient: tcs[1].Fu.Username,
		Currency:  &usd,
		Amount:    "8.196",
		Note:      "got 10 bucks (minus tax)?",
	})
	require.NoError(t, err)
	details, err := tcs[0].Srv.GetRequestDetailsLocal(context.Background(), stellar1.GetRequestDetailsLocalArg{
		ReqID: reqID,
	})
	require.NoError(t, err)
	require.Equal(t, stellar1.RequestStatus_OK, details.Status)
	require.Equal(t, "8.196", details.Amount)
	require.Nil(t, details.Asset)
	require.NotNil(t, details.Currency)
	require.Equal(t, stellar1.OutsideCurrencyCode("USD"), *details.Currency)
	require.Equal(t, "$8.20 USD", details.AmountDescription)
}

func TestAccountBundleFlows(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()
	ctx := context.Background()
	g := tcs[0].G
	setupWithNewBundle(t, tcs[0])

	mctx := libkb.NewMetaContext(ctx, g)
	bundle, version, _, err := remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.Equal(t, version, stellar1.BundleVersion_V2)
	accounts := bundle.Accounts
	secretsMap := bundle.AccountBundles
	var accountIDs []stellar1.AccountID
	for _, acct := range accounts {
		signers := secretsMap[acct.AccountID].Signers
		require.Equal(t, len(signers), 0)
		accountIDs = append(accountIDs, acct.AccountID)
	}
	require.Equal(t, len(accountIDs), 1)
	// add a new account non-primary account
	a1, s1 := randomStellarKeypair()
	err = tcs[0].Srv.ImportSecretKeyLocal(ctx, stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s1,
		MakePrimary: false,
		Name:        "aa",
	})
	require.NoError(t, err)

	// add a new primary account
	a2, s2 := randomStellarKeypair()
	err = tcs[0].Srv.ImportSecretKeyLocal(ctx, stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s2,
		MakePrimary: true,
		Name:        "bb",
	})
	require.NoError(t, err)

	assertFetchAccountBundles(t, tcs[0], a2)

	// switch which account is primary
	err = tcs[0].Srv.SetWalletAccountAsDefaultLocal(ctx, stellar1.SetWalletAccountAsDefaultLocalArg{
		AccountID: a1,
	})
	require.NoError(t, err)
	assertFetchAccountBundles(t, tcs[0], a1)

	// FetchWholeBundle
	fullBundle, version, _, err := remote.FetchWholeBundle(ctx, g)
	require.NoError(t, err)
	require.Equal(t, version, stellar1.BundleVersion_V2)
	err = fullBundle.CheckInvariants()
	require.NoError(t, err)
	require.Equal(t, 3, len(fullBundle.Accounts))
	for _, acc := range fullBundle.Accounts {
		ab := fullBundle.AccountBundles[acc.AccountID]
		require.Equal(t, 1, len(ab.Signers))
		_, parsedAccountID, _, err := libkb.ParseStellarSecretKey(string(ab.Signers[0]))
		require.NoError(t, err)
		require.Equal(t, parsedAccountID, acc.AccountID)
	}

	// ExportSecretKey
	privKey, err := tcs[0].Srv.GetWalletAccountSecretKeyLocal(ctx, stellar1.GetWalletAccountSecretKeyLocalArg{
		AccountID: a2,
	})
	require.NoError(t, err)
	require.EqualValues(t, s2, privKey)

	// ChangeAccountName
	err = tcs[0].Srv.ChangeWalletAccountNameLocal(ctx, stellar1.ChangeWalletAccountNameLocalArg{
		AccountID: a2,
		NewName:   "rename",
	})
	require.NoError(t, err)
	bundle, _, _, err = remote.FetchAccountBundle(ctx, g, a2)
	require.NoError(t, err)
	for _, acc := range bundle.Accounts {
		if acc.AccountID == a2 {
			require.Equal(t, acc.Name, "rename")
			accSigners := bundle.AccountBundles[a2].Signers
			require.Equal(t, accSigners[0], s2)
		}
	}

	// DeleteAccount
	err = tcs[0].Srv.DeleteWalletAccountLocal(ctx, stellar1.DeleteWalletAccountLocalArg{
		AccountID:        a2,
		UserAcknowledged: "yes",
	})
	require.NoError(t, err)
	// fetching this account explicitly should error
	_, _, _, err = remote.FetchAccountBundle(ctx, g, a2)
	require.Error(t, err)
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("invalid error type %T", err)
	}
	require.Equal(t, libkb.SCStellarMissingAccount, aerr.Code)
	// fetching everything should yield a bundle that
	// does not include this account
	bundle, _, _, err = remote.FetchWholeBundle(ctx, g)
	require.NoError(t, err)
	for _, acc := range bundle.Accounts {
		require.False(t, acc.AccountID == a2)
	}
	for accID := range bundle.AccountBundles {
		require.False(t, accID == a2)
	}

	// CreateNewAccount
	accID, err := tcs[0].Srv.CreateWalletAccountLocal(ctx, stellar1.CreateWalletAccountLocalArg{
		Name: "skittles",
	})
	require.NoError(t, err)
	bundle, _, _, err = remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	found := false
	for _, acc := range bundle.Accounts {
		if acc.Name == "skittles" {
			require.False(t, found)
			require.Equal(t, accID, acc.AccountID)
			found = true
		}
	}
	require.True(t, found)
}

func assertFetchAccountBundles(t *testing.T, tc *TestContext, primaryAccountID stellar1.AccountID) {
	// fetch a secretless bundle to get all of the accountIDs
	ctx := context.Background()
	g := tc.G
	mctx := libkb.NewMetaContext(ctx, g)
	secretlessBundle, version, _, err := remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.Equal(t, version, stellar1.BundleVersion_V2)
	err = secretlessBundle.CheckInvariants()
	require.NoError(t, err)
	var accountIDs []stellar1.AccountID
	var foundPrimary bool
	for _, acct := range secretlessBundle.Accounts {
		accountIDs = append(accountIDs, acct.AccountID)
		if acct.AccountID == primaryAccountID {
			foundPrimary = true
		}
	}
	require.True(t, foundPrimary)

	// fetch the account bundle for each account and validate that it looks correct
	// for each account in the bundle including the ones not explicitly fetched
	for _, accountID := range accountIDs {
		fetchedBundle, version, _, err := remote.FetchAccountBundle(ctx, g, accountID)
		require.NoError(t, err)
		require.Equal(t, version, stellar1.BundleVersion_V2)
		err = fetchedBundle.CheckInvariants()
		require.NoError(t, err)
		ab := fetchedBundle.AccountBundles
		for _, acct := range fetchedBundle.Accounts {
			if acct.AccountID == primaryAccountID {
				require.True(t, acct.IsPrimary)
			} else {
				require.False(t, acct.IsPrimary)
			}
			if acct.AccountID == accountID {
				// this is the account we were explicitly fetching, so it should have signers
				signers := ab[accountID].Signers
				require.Equal(t, len(signers), 1)
				_, parsedAccountID, _, err := libkb.ParseStellarSecretKey(string(signers[0]))
				require.NoError(t, err)
				require.Equal(t, parsedAccountID, accountID)
			} else {
				// this is not an account we were explicitly fetching
				// so it should not be in the account bundle map
				_, accountInAccountBundle := ab[acct.AccountID]
				require.False(t, accountInAccountBundle)
			}
		}
	}
}

// TestMakeAccountMobileOnlyOnDesktop imports a new secret stellar key, then makes it
// mobile only from a desktop device.  The subsequent fetch fails because it is
// a desktop device.
func TestMakeAccountMobileOnlyOnDesktop(t *testing.T) {
	tc, cleanup := setupDesktopTest(t)
	defer cleanup()
	ctx := context.Background()
	g := tc.G
	setupWithNewBundle(t, tc)

	a1, s1 := randomStellarKeypair()
	err := tc.Srv.ImportSecretKeyLocal(ctx, stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s1,
		MakePrimary: false,
		Name:        "vault",
	})
	require.NoError(t, err)

	rev2AcctBundle, version, _, err := remote.FetchAccountBundle(ctx, g, a1)
	require.NoError(t, err)
	require.Equal(t, stellar1.BundleVersion_V2, version)
	require.Equal(t, stellar1.BundleRevision(2), rev2AcctBundle.Revision)
	// NOTE: we're using this rev2AcctBundle later...

	err = tc.Srv.SetAccountMobileOnlyLocal(ctx, stellar1.SetAccountMobileOnlyLocalArg{
		AccountID: a1,
	})
	require.NoError(t, err)

	// this is a desktop device, so this should now fail
	_, _, _, err = remote.FetchAccountBundle(ctx, g, a1)
	require.Error(t, err)
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("invalid error type %T", err)
	}
	require.Equal(t, libkb.SCStellarDeviceNotMobile, aerr.Code)

	// try to make it accessible on all devices, which shouldn't work
	err = tc.Srv.SetAccountAllDevicesLocal(ctx, stellar1.SetAccountAllDevicesLocalArg{
		AccountID: a1,
	})
	aerr, ok = err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("invalid error type %T", err)
	}
	require.Equal(t, libkb.SCStellarDeviceNotMobile, aerr.Code)

	primaryAcctName := fmt.Sprintf("%s's account", tc.Fu.Username)
	// can pull a secretless bundle though (not specifying an accountID)
	mctx := libkb.NewMetaContextBackground(g)
	rev3AcctBundle, _, _, err := remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.Equal(t, stellar1.BundleVersion_V2, version)
	require.Equal(t, stellar1.BundleRevision(3), rev3AcctBundle.Revision)
	accountID0 := rev3AcctBundle.Accounts[0].AccountID
	require.Equal(t, primaryAcctName, rev3AcctBundle.Accounts[0].Name)
	require.True(t, rev3AcctBundle.Accounts[0].IsPrimary)
	require.Len(t, rev3AcctBundle.AccountBundles[accountID0].Signers, 0)
	accountID1 := rev3AcctBundle.Accounts[1].AccountID
	require.Equal(t, stellar1.AccountMode_MOBILE, rev3AcctBundle.Accounts[1].Mode)
	require.False(t, rev3AcctBundle.Accounts[1].IsPrimary)
	require.Len(t, rev3AcctBundle.AccountBundles[accountID1].Signers, 0)
	require.Equal(t, "vault", rev3AcctBundle.Accounts[1].Name)

	// try posting an old bundle we got previously
	err = remote.Post(ctx, g, *rev2AcctBundle, version)
	require.Error(t, err)

	// tinker with it
	rev2AcctBundle.Revision = 4
	err = remote.Post(ctx, g, *rev2AcctBundle, version)
	require.Error(t, err)
}

// TestMakeAccountMobileOnlyOnRecentMobile imports a new secret stellar key, then
// makes it mobile only.  The subsequent fetch fails because it is
// a recently provisioned mobile device.  After 7 days, the fetch works.
func TestMakeAccountMobileOnlyOnRecentMobile(t *testing.T) {
	tc, cleanup := setupMobileTest(t)
	defer cleanup()
	ctx := context.Background()
	g := tc.G
	setupWithNewBundle(t, tc)

	a1, s1 := randomStellarKeypair()
	err := tc.Srv.ImportSecretKeyLocal(ctx, stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s1,
		MakePrimary: false,
		Name:        "vault",
	})
	require.NoError(t, err)

	checker := newAcctBundleChecker(a1, s1)

	acctBundle, version, _, err := remote.FetchAccountBundle(ctx, g, a1)
	require.NoError(t, err)
	t.Logf("acctBundle: %+v", acctBundle)
	require.Equal(t, stellar1.BundleVersion_V2, version)
	checker.assertBundle(t, acctBundle, 2, 1, stellar1.AccountMode_USER)

	err = tc.Srv.SetAccountMobileOnlyLocal(ctx, stellar1.SetAccountMobileOnlyLocalArg{
		AccountID: a1,
	})
	require.NoError(t, err)

	// this is a recent mobile device, so this should now fail
	_, _, _, err = remote.FetchAccountBundle(ctx, g, a1)
	require.Error(t, err)
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("invalid error type %T", err)
	}
	require.Equal(t, libkb.SCStellarMobileOnlyPurgatory, aerr.Code)

	// this will make the device older on the server
	makeActiveDeviceOlder(t, g)
	// so now the fetch will work
	acctBundle, version, _, err = remote.FetchAccountBundle(ctx, g, a1)
	require.NoError(t, err)
	require.Equal(t, stellar1.BundleVersion_V2, version)
	checker.assertBundle(t, acctBundle, 3, 2, stellar1.AccountMode_MOBILE)

	// this should not post a new bundle
	err = tc.Srv.SetAccountMobileOnlyLocal(ctx, stellar1.SetAccountMobileOnlyLocalArg{
		AccountID: a1,
	})
	require.NoError(t, err)
	acctBundle, version, _, err = remote.FetchAccountBundle(ctx, g, a1)
	require.NoError(t, err)
	require.Equal(t, stellar1.BundleVersion_V2, version)
	checker.assertBundle(t, acctBundle, 3, 2, stellar1.AccountMode_MOBILE)

	// make it accessible on all devices
	err = tc.Srv.SetAccountAllDevicesLocal(ctx, stellar1.SetAccountAllDevicesLocalArg{
		AccountID: a1,
	})
	require.NoError(t, err)

	acctBundle, version, _, err = remote.FetchAccountBundle(ctx, g, a1)
	require.NoError(t, err)
	require.Equal(t, stellar1.BundleVersion_V2, version)
	checker.assertBundle(t, acctBundle, 4, 3, stellar1.AccountMode_USER)
}

func TestAutoClaimLoop(t *testing.T) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingFull, usettingFull})
	defer cleanup()

	acceptDisclaimer(tcs[0])

	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	tcs[0].Backend.Gift(getPrimaryAccountID(tcs[0]), "100")
	sendRes, err := tcs[0].Srv.SendCLILocal(context.Background(), stellar1.SendCLILocalArg{
		Recipient:  tcs[1].Fu.Username,
		Amount:     "3",
		Asset:      stellar1.AssetNative(),
		ForceRelay: true,
	})
	require.NoError(t, err)

	acceptDisclaimer(tcs[1])
	tcs[1].Backend.ImportAccountsForUser(tcs[1])
	tcs[1].Backend.EnableAutoclaimMock(tcs[1])

	tcs[1].G.GetStellar().KickAutoClaimRunner(tcs[1].MetaContext(), gregor1.MsgID{})

	var found bool
	for i := 0; i < 10; i++ {
		time.Sleep(100 * time.Millisecond * libkb.CITimeMultiplier(tcs[1].G))
		payment := tcs[1].Backend.txLog.Find(sendRes.KbTxID.String())
		claim := payment.Summary.Relay().Claim
		if claim != nil {
			require.Equal(t, stellar1.TransactionStatus_SUCCESS, claim.TxStatus)
			require.Equal(t, stellar1.RelayDirection_CLAIM, claim.Dir)
			found = true
			break
		}
	}

	if !found {
		t.Fatal("Timed out waiting for auto claim")
	}

	tcs[0].Backend.AssertBalance(getPrimaryAccountID(tcs[0]), "96.9999900")
	tcs[1].Backend.AssertBalance(getPrimaryAccountID(tcs[1]), "2.9999800")
}

func makeActiveDeviceOlder(t *testing.T, g *libkb.GlobalContext) {
	deviceID := g.ActiveDevice.DeviceID()
	apiArg := libkb.APIArg{
		Endpoint:    "test/agedevice",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  context.Background(),
		Args: libkb.HTTPArgs{
			"device_id": libkb.S{Val: deviceID.String()},
		},
	}
	_, err := g.API.Post(apiArg)
	require.NoError(t, err)
}

type acctBundleChecker struct {
	accountID stellar1.AccountID
	secretKey stellar1.SecretKey
}

func newAcctBundleChecker(a stellar1.AccountID, s stellar1.SecretKey) *acctBundleChecker {
	return &acctBundleChecker{
		accountID: a,
		secretKey: s,
	}
}

func (a *acctBundleChecker) assertBundle(t *testing.T, bundle *stellar1.BundleRestricted, revisionParent, revisionAccount stellar1.BundleRevision, mode stellar1.AccountMode) {
	require.NotNil(t, bundle)
	require.Equal(t, revisionParent, bundle.Revision)
	require.Len(t, bundle.AccountBundles, 1)
	secret, err := acctbundle.AccountWithSecret(bundle, a.accountID)
	require.NoError(t, err)
	require.NotNil(t, secret)
	require.Equal(t, mode, secret.Mode)
	require.Equal(t, a.accountID, secret.AccountID)
	require.Len(t, secret.Signers, 1)
	require.Equal(t, a.secretKey, secret.Signers[0])
	require.Equal(t, revisionAccount, secret.Revision)
	require.NotEmpty(t, bundle.Prev)
	require.NotEmpty(t, bundle.OwnHash)
}

type TestContext struct {
	libkb.TestContext
	Fu      *kbtest.FakeUser
	Srv     *Server
	Backend *BackendMock
}

func (tc *TestContext) MetaContext() libkb.MetaContext {
	return libkb.NewMetaContextForTest(tc.TestContext)
}

// Create n TestContexts with logged in users
// Returns (FakeUsers, TestContexts, CleanupFunction)
func setupNTests(t *testing.T, n int) ([]*TestContext, func()) {
	var settings []usetting
	for i := 0; i < n; i++ {
		settings = append(settings, usettingFull)
	}
	return setupTestsWithSettings(t, settings)
}

// setupDesktopTest signs up the user on a desktop device.
func setupDesktopTest(t *testing.T) (*TestContext, func()) {
	settings := []usetting{usettingFull}
	tcs, f := setupTestsWithSettings(t, settings)
	return tcs[0], f
}

// setupMobileTest signs up the user on a mobile device.
func setupMobileTest(t *testing.T) (*TestContext, func()) {
	settings := []usetting{usettingMobile}
	tcs, f := setupTestsWithSettings(t, settings)
	return tcs[0], f
}

type usetting string

const (
	usettingFull    usetting = "full"
	usettingPukless usetting = "pukless"
	usettingMobile  usetting = "mobile"
)

func setupTestsWithSettings(t *testing.T, settings []usetting) ([]*TestContext, func()) {
	require.True(t, len(settings) > 0, "must create at least 1 tc")
	var tcs []*TestContext
	bem := NewBackendMock(t)
	for i, setting := range settings {
		tc := SetupTest(t, "wall", 1)
		switch setting {
		case usettingFull:
		case usettingMobile:
		case usettingPukless:
			tc.Tp.DisableUpgradePerUserKey = true
		}
		var fu *kbtest.FakeUser
		var err error
		if setting == usettingMobile {
			fu, err = kbtest.CreateAndSignupFakeUserMobile("wall", tc.G)
		} else {
			fu, err = kbtest.CreateAndSignupFakeUser("wall", tc.G)
		}
		require.NoError(t, err)
		tc2 := &TestContext{
			TestContext: tc,
			Fu:          fu,
			// All TCs in a test share the same backend.
			Backend: bem,
		}
		t.Logf("setup user %v %v", i, tc2.Fu.Username)
		rcm := NewRemoteClientMock(tc2, bem)
		ws := stellar.NewWalletState(tc.G, rcm)
		tc2.Srv = New(tc.G, newTestUISource(), ws)
		stellar.ServiceInit(tc.G, ws, nil)
		tcs = append(tcs, tc2)
	}
	cleanup := func() {
		for _, tc := range tcs {
			tc.Cleanup()
		}
	}
	for i, tc := range tcs {
		t.Logf("U%d: %v %v", i, tc.Fu.Username, tc.Fu.GetUserVersion())
	}
	return tcs, cleanup
}

func randomStellarKeypair() (pub stellar1.AccountID, sec stellar1.SecretKey) {
	full, err := keypair.Random()
	if err != nil {
		panic(err)
	}
	return stellar1.AccountID(full.Address()), stellar1.SecretKey(full.Seed())
}

func getPrimaryAccountID(tc *TestContext) stellar1.AccountID {
	accounts, err := tc.Srv.GetWalletAccountsLocal(context.Background(), 0)
	require.NoError(tc.T, err)
	for _, a := range accounts {
		if a.IsDefault {
			return a.AccountID
		}
	}
	require.Fail(tc.T, "no primary account")
	return ""
}

type nullSecretUI struct{}

func (nullSecretUI) GetPassphrase(keybase1.GUIEntryArg, *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("nullSecretUI.GetPassphrase")
}

type testUISource struct {
	secretUI   libkb.SecretUI
	identifyUI libkb.IdentifyUI
	stellarUI  stellar1.UiInterface
}

func newTestUISource() *testUISource {
	return &testUISource{
		secretUI:   nullSecretUI{},
		identifyUI: &kbtest.FakeIdentifyUI{},
		stellarUI:  &mockStellarUI{},
	}
}

func (t *testUISource) SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI {
	return t.secretUI
}

func (t *testUISource) IdentifyUI(g *libkb.GlobalContext, sessionID int) libkb.IdentifyUI {
	return t.identifyUI
}

func (t *testUISource) StellarUI() stellar1.UiInterface {
	return t.stellarUI
}

type mockStellarUI struct {
	PaymentReviewedHandler func(context.Context, stellar1.PaymentReviewedArg) error
}

func (ui *mockStellarUI) PaymentReviewed(ctx context.Context, arg stellar1.PaymentReviewedArg) error {
	if ui.PaymentReviewedHandler != nil {
		return ui.PaymentReviewedHandler(ctx, arg)
	}
	return fmt.Errorf("mockStellarUI.UiPaymentReview called with no handler")
}

func TestV2EndpointsAsV1(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()
	ctx := context.TODO()
	g := tcs[0].G

	// create a v1 bundle with two accounts
	mctx := tcs[0].MetaContext()
	err := stellar.SetMigrationFeatureFlag(mctx, false)
	require.NoError(t, err)
	acceptDisclaimer(tcs[0])
	created, err := stellar.CreateWallet(mctx, false)
	require.NoError(t, err)
	require.False(t, created)
	v1Bundle0, _, _, err := remote.FetchV1Bundle(ctx, g)
	require.NoError(t, err)
	_, err = bundle.CreateNewAccount(&v1Bundle0, "whatevs", false)
	require.NoError(t, err)
	v1Bundle1 := bundle.Advance(v1Bundle0)
	err = remote.PostV1Bundle(ctx, g, v1Bundle1)
	require.NoError(t, err)
	primaryAccount, err := v1Bundle1.PrimaryAccount()
	require.NoError(t, err)
	primaryAccountID := primaryAccount.AccountID

	// fetch secretless bundle
	bundle, version, _, err := remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	require.Equal(t, version, stellar1.BundleVersion_V1)
	for _, ab := range bundle.AccountBundles {
		require.Equal(t, len(ab.Signers), 0)
	}

	// fetch account bundle
	bundle, version, _, err = remote.FetchAccountBundle(ctx, g, primaryAccountID)
	require.NoError(t, err)
	require.Equal(t, version, stellar1.BundleVersion_V1)
	ab := bundle.AccountBundles[primaryAccountID]
	require.Equal(t, len(ab.Signers), 1)

	// fetch whole bundle
	fullBundle, version, _, err := remote.FetchWholeBundle(ctx, g)
	require.NoError(t, err)
	require.Equal(t, version, stellar1.BundleVersion_V1)
	err = fullBundle.CheckInvariants()
	require.NoError(t, err)
	require.Equal(t, 2, len(fullBundle.Accounts))
	for _, acc := range fullBundle.Accounts {
		ab := fullBundle.AccountBundles[acc.AccountID]
		require.Equal(t, 1, len(ab.Signers))
		_, parsedAccountID, _, err := libkb.ParseStellarSecretKey(string(ab.Signers[0]))
		require.NoError(t, err)
		require.Equal(t, parsedAccountID, acc.AccountID)
	}
}

func TestImplicitMigrationToAccountBundles(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()
	g := tcs[0].G
	m := libkb.NewMetaContextTODO(g)
	err := stellar.SetMigrationFeatureFlag(m, false)
	require.NoError(t, err)
	acceptDisclaimer(tcs[0])

	// verify that we have a v1 bundle
	bundle, version, _, err := remote.FetchSecretlessBundle(m)
	require.NoError(t, err)
	require.Equal(t, version, stellar1.BundleVersion_V1)
	require.Equal(t, len(bundle.Accounts), 1)

	// enable the feature flag
	err = stellar.SetMigrationFeatureFlag(m, true)
	require.NoError(t, err)
	m.G().FeatureFlags.InvalidateCache(m, libkb.FeatureStellarAcctBundles)

	// the next bundle we pull should be v2
	go func() {
		// test concurrency
		bundle, version, _, err = remote.FetchSecretlessBundle(m)
		require.NoError(t, err)
		require.Equal(t, version, stellar1.BundleVersion_V2)
		require.Equal(t, len(bundle.Accounts), 1)
	}()
	bundle, version, _, err = remote.FetchSecretlessBundle(m)
	require.NoError(t, err)
	require.Equal(t, version, stellar1.BundleVersion_V2)
	require.Equal(t, len(bundle.Accounts), 1)

	// attempting to migrate explicitly should throw already migrated
	err = remote.MigrateBundleToAccountBundles(m)
	require.Error(t, err)
	_, correctErrorType := err.(remote.AlreadyMigratedError)
	require.True(t, correctErrorType)
}

func TestMigrateBundleToAccountBundles(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()
	mctx := tcs[0].MetaContext()

	// create a v1 bundle with two accounts
	err := stellar.SetMigrationFeatureFlag(mctx, false)
	require.NoError(t, err)
	acceptDisclaimer(tcs[0]) // this actually creates the bundle
	v1Bundle0, _, _, err := remote.FetchV1Bundle(mctx.Ctx(), mctx.G())
	require.NoError(t, err)
	primaryAccount, err := v1Bundle0.PrimaryAccount()
	require.NoError(t, err)
	primaryAccountID := primaryAccount.AccountID
	_, err = bundle.CreateNewAccount(&v1Bundle0, "pettycash", false)
	require.NoError(t, err)
	v1Bundle := bundle.Advance(v1Bundle0)
	err = remote.PostV1Bundle(mctx.Ctx(), mctx.G(), v1Bundle)
	require.NoError(t, err)

	// assert cannot use v2 endpoints before migrating
	// fetch
	_, _, _, err = remote.FetchV2BundleForAccount(mctx.Ctx(), mctx.G(), nil)
	aerr := err.(libkb.AppStatusError)
	actualStatus := keybase1.StatusCode(aerr.Code)
	require.Equal(t, actualStatus, keybase1.StatusCode_SCStellarIncompatibleVersion)
	require.Error(t, err, "cannot fetch v2 before migrating")
	v1Bundle, _, _, err = remote.FetchV1Bundle(mctx.Ctx(), mctx.G())
	require.NoError(t, err)
	v2Bundle, err := acctbundle.NewFromBundle(v1Bundle)
	require.NoError(t, err)
	// post
	throwawayV2Bundle0 := v2Bundle.DeepCopy()
	throwawayV2Bundle1 := acctbundle.AdvanceAccounts(throwawayV2Bundle0, []stellar1.AccountID{primaryAccountID})
	err = remote.Post(mctx.Ctx(), mctx.G(), throwawayV2Bundle1, stellar1.BundleVersion_V2)
	require.Error(t, err, "cannot post v2 before migrating")
	aerr = err.(libkb.AppStatusError)
	actualStatus = keybase1.StatusCode(aerr.Code)
	require.Equal(t, keybase1.StatusCode_SCStellarIncompatibleVersion, actualStatus)

	// cannot migrate without the feature flag
	err = remote.MigrateBundleToAccountBundles(mctx)
	require.Error(t, err)
	_, correctErrorType := err.(remote.MissingFeatureFlagMigrationError)
	require.True(t, correctErrorType)

	// flip feature flag and migrate
	err = stellar.SetMigrationFeatureFlag(mctx, true)
	require.NoError(t, err)
	mctx.G().FeatureFlags.InvalidateCache(mctx, libkb.FeatureStellarAcctBundles)
	enabled, err := mctx.G().FeatureFlags.EnabledWithError(mctx, libkb.FeatureStellarAcctBundles)
	require.True(t, enabled)
	require.NoError(t, err)
	err = remote.MigrateBundleToAccountBundles(mctx)
	require.NoError(t, err)

	// cannot use v1 endpoints after migration
	_, _, _, err = remote.FetchV1Bundle(mctx.Ctx(), mctx.G())
	require.Error(t, err, "cannot fetch v1 after migrating")
	aerr = err.(libkb.AppStatusError)
	actualStatus = keybase1.StatusCode(aerr.Code)
	require.Equal(t, actualStatus, keybase1.StatusCode_SCStellarIncompatibleVersion)
	v2Bundle, _, _, err = remote.FetchWholeBundle(mctx.Ctx(), mctx.G())
	require.NoError(t, err)
	v1BundlePrev, err := acctbundle.BundleFromBundleRestricted(*v2Bundle)
	require.NoError(t, err)
	v1Bundle = bundle.Advance(*v1BundlePrev)
	err = remote.PostV1Bundle(mctx.Ctx(), mctx.G(), v1Bundle)
	aerr = err.(libkb.AppStatusError)
	actualStatus = keybase1.StatusCode(aerr.Code)
	require.Equal(t, actualStatus, keybase1.StatusCode_SCStellarIncompatibleVersion)
	require.Error(t, err, "cannot post v1 after migrating")

	// can use v2 endpoints after migration
	assertFetchAccountBundles(t, tcs[0], primaryAccountID)
	// add a non-primary account
	v2Bundle, _, _, err = remote.FetchSecretlessBundle(mctx)
	require.NoError(t, err)
	_, secretKey := randomStellarKeypair()
	err = acctbundle.AddAccount(v2Bundle, secretKey, "shenanigans", false /* make primary */)
	require.NoError(t, err)
	v2BundleNext := acctbundle.AdvanceBundle(*v2Bundle)
	require.NoError(t, err)
	err = remote.Post(mctx.Ctx(), mctx.G(), v2BundleNext, stellar1.BundleVersion_V2)
	require.NoError(t, err)
	assertFetchAccountBundles(t, tcs[0], primaryAccountID)
	// add a primary account
	fetchedBundle, _, _, err := remote.FetchV2BundleForAccount(mctx.Ctx(), mctx.G(), &primaryAccountID)
	require.NoError(t, err)
	newPrimaryAccountID, newPrimarySecretKey := randomStellarKeypair()
	err = acctbundle.AddAccount(fetchedBundle, newPrimarySecretKey, "newprimary", true /* make primary */)
	require.NoError(t, err)
	newBundle := acctbundle.AdvanceAccounts(*fetchedBundle, []stellar1.AccountID{primaryAccountID}) // advance the old primary account
	err = remote.PostWithChainlink(mctx.Ctx(), mctx.G(), newBundle, true /* v2link */)
	require.NoError(t, err)
	assertFetchAccountBundles(t, tcs[0], newPrimaryAccountID)
}
