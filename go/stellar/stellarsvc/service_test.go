package stellarsvc

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
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
	stellar.ServiceInit(tc.G, nil)
	teams.ServiceInit(tc.G)
	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, warner, isProduction)
	}

	tc.G.SetService()

	tc.G.ChatHelper = kbtest.NewMockChatHelper()

	return tc
}

func TestCreateWallet(t *testing.T) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingWalletless, usettingFull})
	defer cleanup()

	t.Logf("Lookup for a bogus address")
	uv, _, err := stellar.LookupUserByAccountID(tcs[0].MetaContext(), "GCCJJFCRCQAWDWRAZ3R6235KCQ4PQYE5KEWHGE5ICVTZLTMRKVWAWP7N")
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)

	t.Logf("Create an initial wallet")
	created, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.True(t, created)

	created, err = stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.False(t, created)

	t.Logf("Fetch the bundle")
	bundle, _, err := remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.Equal(t, stellar1.BundleRevision(1), bundle.Revision)
	require.Nil(t, bundle.Prev)
	require.NotNil(t, bundle.OwnHash)
	require.Len(t, bundle.Accounts, 1)
	require.True(t, len(bundle.Accounts[0].AccountID) > 0)
	require.Equal(t, stellar1.AccountMode_USER, bundle.Accounts[0].Mode)
	require.True(t, bundle.Accounts[0].IsPrimary)
	require.Len(t, bundle.Accounts[0].Signers, 1)
	require.Equal(t, "", bundle.Accounts[0].Name)

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

func TestUpkeep(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	bundle, pukGen, err := remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	originalID := bundle.OwnHash
	originalPukGen := pukGen

	err = stellar.Upkeep(context.Background(), tcs[0].G)
	require.NoError(t, err)

	bundle, pukGen, err = remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.Equal(t, bundle.OwnHash, originalID, "bundle should be unchanged by no-op upkeep")
	require.Equal(t, originalPukGen, pukGen)

	t.Logf("rotate puk")
	engArg := &engine.PerUserKeyRollArgs{}
	eng := engine.NewPerUserKeyRoll(tcs[0].G, engArg)
	m := libkb.NewMetaContextTODO(tcs[0].G)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)
	require.True(t, eng.DidNewKey)

	err = stellar.Upkeep(context.Background(), tcs[0].G)
	require.NoError(t, err)

	bundle, pukGen, err = remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.NotEqual(t, bundle.OwnHash, originalID, "bundle should be new")
	require.NotEqual(t, originalPukGen, pukGen, "bundle should be for new puk")
	require.Equal(t, 2, int(bundle.Revision))
}

func TestImportExport(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	srv := tcs[0].Srv

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	mustAskForPassphrase := func(f func()) {
		ui := tcs[0].Fu.NewSecretUI()
		tcs[0].Srv.uiSource.(*testUISource).secretUI = ui
		f()
		require.True(t, ui.CalledGetPassphrase, "operation should ask for passphrase")
		tcs[0].Srv.uiSource.(*testUISource).secretUI = nullSecretUI{}
	}

	mustAskForPassphrase(func() {
		_, err = srv.ExportSecretKeyLocal(context.Background(), stellar1.AccountID(""))
		require.Error(t, err, "export empty specifier")
	})

	bundle, _, err := remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)

	mustAskForPassphrase(func() {
		exported, err := srv.ExportSecretKeyLocal(context.Background(), bundle.Accounts[0].AccountID)
		require.NoError(t, err)
		require.Equal(t, bundle.Accounts[0].Signers[0], exported)
	})

	a1, s1 := randomStellarKeypair()
	argS1 := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s1,
		MakePrimary: false,
	}
	err = srv.ImportSecretKeyLocal(context.Background(), argS1)
	require.NoError(t, err)

	mustAskForPassphrase(func() {
		exported, err := srv.ExportSecretKeyLocal(context.Background(), bundle.Accounts[0].AccountID)
		require.NoError(t, err)
		require.Equal(t, bundle.Accounts[0].Signers[0], exported)
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

	bundle, _, err = remote.Fetch(context.Background(), tcs[0].G)
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

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

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
	require.EqualValues(t, defaultOutsideCurrency, account.ExchangeRate.Currency)
}

func TestSendLocalStellarAddress(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	srv := tcs[0].Srv
	rm := tcs[0].Backend
	accountIDSender := rm.AddAccount()
	accountIDRecip := rm.AddAccount()

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDSender),
		MakePrimary: true,
	}
	err = srv.ImportSecretKeyLocal(context.Background(), argImport)
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

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	_, err = stellar.CreateWallet(context.Background(), tcs[1].G)
	require.NoError(t, err)

	srvSender := tcs[0].Srv
	rm := tcs[0].Backend
	accountIDSender := rm.AddAccount()
	accountIDRecip := rm.AddAccount()

	srvRecip := tcs[1].Srv

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDSender),
		MakePrimary: true,
	}
	err = srvSender.ImportSecretKeyLocal(context.Background(), argImport)
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
	require.Equal(t, balances[0].Amount, "9899.9999900")

	balances, err = srvSender.BalancesLocal(context.Background(), accountIDRecip)
	if err != nil {
		t.Fatal(err)
	}
	require.Equal(t, balances[0].Amount, "10100.0000000")

	senderMsgs := kbtest.MockSentMessages(tcs[0].G, tcs[0].T)
	require.Len(t, senderMsgs, 1)
	require.Equal(t, senderMsgs[0].MsgType, chat1.MessageType_SENDPAYMENT)
}

func TestRecentPaymentsLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	_, err = stellar.CreateWallet(context.Background(), tcs[1].G)
	require.NoError(t, err)

	srvSender := tcs[0].Srv
	rm := tcs[0].Backend
	accountIDSender := rm.AddAccount()
	accountIDRecip := rm.AddAccount()

	srvRecip := tcs[1].Srv

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDSender),
		MakePrimary: true,
	}
	err = srvSender.ImportSecretKeyLocal(context.Background(), argImport)
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
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingFull, usettingWalletless})
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	stellarSender, err := stellar.LookupSender(context.Background(), tcs[0].G, "")
	require.NoError(t, err)

	u1, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tcs[0].G, tcs[1].Fu.Username))
	require.NoError(t, err)

	t.Logf("create relay transfer")
	m := libkb.NewMetaContextBackground(tcs[0].G)
	recipient, err := stellar.LookupRecipient(m, stellarcommon.RecipientInput(u1.GetNormalizedName()), false)
	require.NoError(t, err)
	appKey, teamID, err := relays.GetKey(context.Background(), tcs[0].G, recipient)
	require.NoError(t, err)
	out, err := relays.Create(relays.Input{
		From:          stellarSender.Signers[0],
		AmountXLM:     "10.0005",
		Note:          "hey",
		EncryptFor:    appKey,
		SeqnoProvider: stellar.NewSeqnoProvider(context.Background(), tcs[0].Srv.remoter),
	})
	require.NoError(t, err)
	_, err = libkb.ParseStellarAccountID(out.RelayAccountID.String())
	require.NoError(t, err)
	require.True(t, len(out.FundTx.Signed) > 100)

	t.Logf("decrypt")
	relaySecrets, err := relays.DecryptB64(context.Background(), tcs[0].G, teamID, out.EncryptedB64)
	require.NoError(t, err)
	_, accountID, _, err := libkb.ParseStellarSecretKey(relaySecrets.Sk.SecureNoLogString())
	require.NoError(t, err)
	require.Equal(t, out.RelayAccountID, accountID)
	require.Len(t, relaySecrets.StellarID, 64)
	require.Equal(t, "hey", relaySecrets.Note)
}

func TestRelayClaim(t *testing.T) {
	testRelay(t, false)
}

func TestRelayYank(t *testing.T) {
	testRelay(t, true)
}

func testRelay(t *testing.T, yank bool) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingFull, usettingPukless})
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	tcs[0].Backend.Gift(getPrimaryAccountID(tcs[0]), "5")
	sendRes, err := tcs[0].Srv.SendCLILocal(context.Background(), stellar1.SendCLILocalArg{
		Recipient: tcs[1].Fu.Username,
		Amount:    "3",
		Asset:     stellar1.Asset{Type: "native"},
	})
	require.NoError(t, err)

	details, err := tcs[0].Backend.PaymentDetails(context.Background(), tcs[0], sendRes.KbTxID.String())
	require.NoError(t, err)

	claimant := 0
	if !yank {
		claimant = 1

		getapuk := func(tc *TestContext) {
			tc.Tp.DisableUpgradePerUserKey = false
			err = engine.RunEngine2(libkb.NewMetaContext(context.Background(), tc.G).WithUIs(libkb.UIs{
				LogUI: tc.G.Log,
			}), engine.NewPerUserKeyUpgrade(tc.G, &engine.PerUserKeyUpgradeArgs{}))
			require.NoError(t, err)

		}
		getapuk(tcs[1])

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
		require.Equal(t, stellar1.BalanceDelta_NONE, fhistory[0].Payment.Delta)
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

	history, err = tcs[claimant].Srv.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, history, 1)
	require.Nil(t, history[0].Err)
	require.NotNil(t, history[0].Payment)
	require.Equal(t, "Completed", history[0].Payment.Status)

	fhistoryPage, err := tcs[claimant].Srv.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: getPrimaryAccountID(tcs[claimant])})
	require.NoError(t, err)
	fhistory = fhistoryPage.Payments
	require.Len(t, fhistory, 1)
	require.Nil(t, fhistory[0].Err)
	require.NotNil(t, fhistory[0].Payment)
	require.Equal(t, stellar1.PaymentStatus_COMPLETED, fhistory[0].Payment.StatusSimplified)
	require.Equal(t, "completed", fhistory[0].Payment.StatusDescription)

	history, err = tcs[0].Srv.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, history, 1)
	require.Nil(t, history[0].Err)
	require.NotNil(t, history[0].Payment)
	require.Equal(t, "Completed", history[0].Payment.Status)

	fhistoryPage, err = tcs[0].Srv.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: getPrimaryAccountID(tcs[0])})
	require.NoError(t, err)
	fhistory = fhistoryPage.Payments
	require.Len(t, fhistory, 1)
	require.Nil(t, fhistory[0].Err)
	require.NotNil(t, fhistory[0].Payment)
	require.Equal(t, stellar1.PaymentStatus_COMPLETED, fhistory[0].Payment.StatusSimplified)
	require.Equal(t, "completed", fhistory[0].Payment.StatusDescription)

	t.Logf("try to claim again")
	res, err = tcs[claimant].Srv.ClaimCLILocal(context.Background(), stellar1.ClaimCLILocalArg{TxID: txID.String()})
	require.Error(t, err)
	require.Equal(t, "Payment already claimed by "+tcs[claimant].Fu.Username, err.Error())
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
	// Initial account should be created with display currency set
	// according to system locale/region. Additional accounts display
	// currencies should be set to primary account currency (and can
	// later be changed by the user).

	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	primary := getPrimaryAccountID(tcs[0])
	currency, err := remote.GetAccountDisplayCurrency(context.Background(), tcs[0].G, primary)
	require.NoError(t, err)
	require.EqualValues(t, "USD", currency)

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
	})
	require.NoError(t, err)

	// Should be "EUR" as well, inherited from primary account. Try to
	// use RPC instead of remote endpoint directly this time.
	currencyObj, err := tcs[0].Srv.GetDisplayCurrencyLocal(context.Background(), stellar1.GetDisplayCurrencyLocalArg{
		AccountID: a1,
	})
	require.NoError(t, err)
	require.IsType(t, stellar1.CurrencyLocal{}, currencyObj)
	require.Equal(t, stellar1.OutsideCurrencyCode("EUR"), currencyObj.Code)
}

func TestRequestPayment(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

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

type usetting string

const (
	usettingFull       usetting = "full"
	usettingWalletless usetting = "walletless"
	usettingPukless    usetting = "pukless"
)

func setupTestsWithSettings(t *testing.T, settings []usetting) ([]*TestContext, func()) {
	require.True(t, len(settings) > 0, "must create at least 1 tc")
	var tcs []*TestContext
	bem := NewBackendMock(t)
	for _, setting := range settings {
		tc := SetupTest(t, "wall", 1)
		switch setting {
		case usettingFull:
		case usettingWalletless:
			tc.Tp.DisableAutoWallet = true
		case usettingPukless:
			tc.Tp.DisableUpgradePerUserKey = true
		}
		fu, err := kbtest.CreateAndSignupFakeUser("wall", tc.G)
		require.NoError(t, err)
		tc2 := &TestContext{
			TestContext: tc,
			Fu:          fu,
			// All TCs in a test share the same backend.
			Backend: bem,
		}
		rcm := NewRemoteClientMock(tc2, bem)
		tc2.Srv = New(tc.G, newTestUISource(), rcm)
		stellar.ServiceInit(tc.G, rcm)
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
}

func newTestUISource() *testUISource {
	return &testUISource{
		secretUI:   nullSecretUI{},
		identifyUI: &kbtest.FakeIdentifyUI{},
	}
}

func (t *testUISource) SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI {
	return t.secretUI
}

func (t *testUISource) IdentifyUI(g *libkb.GlobalContext, sessionID int) libkb.IdentifyUI {
	return t.identifyUI
}
