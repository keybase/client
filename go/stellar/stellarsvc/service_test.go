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
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/teams"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
	"github.com/stellar/go/keypair"
	"github.com/stretchr/testify/require"
)

func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	tc = externalstest.SetupTest(tb, name, depth+1)
	stellar.ServiceInit(tc.G)
	teams.ServiceInit(tc.G)
	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, warner, isProduction)
	}
	return tc
}

func TestCreateWallet(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

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

	t.Logf("Lookup the public stellar address as another user")
	u0, err := tcs[1].G.LoadUserByUID(tcs[0].G.ActiveDevice.UID())
	require.NoError(t, err)
	addr := u0.StellarWalletAddress()
	t.Logf("Found account: %v", addr)
	require.NotNil(t, addr)
	_, err = libkb.MakeNaclSigningKeyPairFromStellarAccountID(*addr)
	require.NoError(t, err, "stellar key should be nacl pubable")
	require.Equal(t, bundle.Accounts[0].AccountID.String(), addr.String(), "addr looked up should match secret bundle")
}

func TestUpkeep(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	created, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.True(t, created)

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
	engCtx := &engine.Context{NetContext: context.Background()}
	engArg := &engine.PerUserKeyRollArgs{}
	eng := engine.NewPerUserKeyRoll(tcs[0].G, engArg)
	err = engine.RunEngine(eng, engCtx)
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
		tcs[0].Srv.uiSource.(*testUISource).secret = ui
		f()
		require.True(t, ui.CalledGetPassphrase, "operation should ask for passphrase")
		tcs[0].Srv.uiSource.(*testUISource).secret = nullSecretUI{}
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

	_, err = srv.ExportSecretKeyLocal(context.Background(), stellar1.AccountID(s1))
	require.Error(t, err, "export confusing secret and public")

	err = srv.ImportSecretKeyLocal(context.Background(), argS1)
	require.Error(t, err)

	u0, err := tcs[1].G.LoadUserByUID(tcs[0].G.ActiveDevice.UID())
	require.NoError(t, err)
	addr := u0.StellarWalletAddress()
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
	addr = u0.StellarWalletAddress()
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

	accountID := tcs[0].Remote.AddAccount(t)

	balances, err := tcs[0].Srv.BalancesLocal(context.Background(), accountID)
	if err != nil {
		t.Fatal(err)
	}

	require.Len(t, balances, 1)
	require.Equal(t, balances[0].Asset.Type, "native")
	require.Equal(t, balances[0].Amount, "10000")
}

func TestGetLocalAccounts(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	created, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.True(t, created)
	require.NoError(t, err)

	tcs[0].Remote.ImportAccountsForUser(t, tcs[0].G)

	accs, err := tcs[0].Srv.WalletGetLocalAccounts(context.Background())
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
	rm := tcs[0].Remote
	accountIDSender := rm.AddAccount(t)
	accountIDRecip := rm.AddAccount(t)

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(t, accountIDSender),
		MakePrimary: true,
	}
	err = srv.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	arg := stellar1.SendLocalArg{
		Recipient: accountIDRecip.String(),
		Amount:    "100",
		Asset:     stellar1.Asset{Type: "native"},
	}
	res, err := srv.SendLocal(context.Background(), arg)
	require.NoError(t, err)
	_ = res

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
}

func TestSendLocalKeybase(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	_, err = stellar.CreateWallet(context.Background(), tcs[1].G)
	require.NoError(t, err)

	srvSender := tcs[0].Srv
	rm := tcs[0].Remote
	accountIDSender := rm.AddAccount(t)
	accountIDRecip := rm.AddAccount(t)

	srvRecip := tcs[1].Srv

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(t, accountIDSender),
		MakePrimary: true,
	}
	err = srvSender.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	argImport.SecretKey = rm.SecretKey(t, accountIDRecip)
	err = srvRecip.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	arg := stellar1.SendLocalArg{
		Recipient: strings.ToUpper(tcs[1].Fu.Username),
		Amount:    "100",
		Asset:     stellar1.Asset{Type: "native"},
	}
	_, err = srvSender.SendLocal(context.Background(), arg)
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
}

func TestRecentPaymentsLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	_, err = stellar.CreateWallet(context.Background(), tcs[1].G)
	require.NoError(t, err)

	srvSender := tcs[0].Srv
	rm := tcs[0].Remote
	accountIDSender := rm.AddAccount(t)
	accountIDRecip := rm.AddAccount(t)

	srvRecip := tcs[1].Srv

	argImport := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(t, accountIDSender),
		MakePrimary: true,
	}
	err = srvSender.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	argImport.SecretKey = rm.SecretKey(t, accountIDRecip)
	err = srvRecip.ImportSecretKeyLocal(context.Background(), argImport)
	require.NoError(t, err)

	arg := stellar1.SendLocalArg{
		Recipient: tcs[1].Fu.Username,
		Amount:    "100",
		Asset:     stellar1.Asset{Type: "native"},
	}
	_, err = srvSender.SendLocal(context.Background(), arg)
	require.NoError(t, err)

	checkPayment := func(payment stellar1.PaymentCLILocal) {
		require.Equal(t, accountIDSender, payment.FromStellar)
		require.Equal(t, accountIDRecip, payment.ToStellar)
		require.NotNil(t, payment.ToUsername)
		require.Equal(t, tcs[1].Fu.Username, *(payment.ToUsername))
		require.Equal(t, "100.0000000", payment.Amount)
	}
	senderPayments, err := srvSender.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, senderPayments, 1)
	checkPayment(senderPayments[0])

	recipPayments, err := srvRecip.RecentPaymentsCLILocal(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, recipPayments, 1)
	checkPayment(recipPayments[0])

	payment, err := srvSender.PaymentDetailCLILocal(context.Background(), senderPayments[0].StellarTxID.String())
	require.NoError(t, err)
	checkPayment(payment)
	payment, err = srvRecip.PaymentDetailCLILocal(context.Background(), senderPayments[0].StellarTxID.String())
	require.NoError(t, err)
	checkPayment(payment)
}

// TODO CORE-7718 delete this test.
// The functions it uses will be made private.
// Use the exposed RPCs and inspection of the remote mock instead.
func TestRelayTransferInnards(t *testing.T) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingFull, usettingWalletless})
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	stellarSender, err := stellar.LookupSenderPrimary(context.Background(), tcs[0].G)
	require.NoError(t, err)

	u1, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tcs[0].G, tcs[1].Fu.Username))
	require.NoError(t, err)

	t.Logf("create relay transfer")
	recipient, err := stellar.LookupRecipient(context.Background(), tcs[0].G, stellar.RecipientInput(u1.GetNormalizedName()))
	require.NoError(t, err)
	appKey, teamID, err := stellar.RelayTransferKey(context.Background(), tcs[0].G, recipient)
	require.NoError(t, err)
	out, err := stellar.CreateRelayTransfer(stellar.RelayPaymentInput{
		From:          stellarSender.Signers[0],
		AmountXLM:     "10.0005",
		Note:          "hey",
		EncryptFor:    appKey,
		SeqnoProvider: stellar.NewSeqnoProvider(context.Background(), tcs[0].Remote),
	})
	require.NoError(t, err)
	_, err = libkb.ParseStellarAccountID(out.RelayAccountID.String())
	require.True(t, len(out.FundTx.Signed) > 100)

	t.Logf("decrypt")
	appKey, err = stellar.RelayTransferKeyForDecryption(context.Background(), tcs[0].G, teamID, appKey.KeyGeneration)
	require.NoError(t, err)
	relaySecrets, err := stellar.DecryptRelaySecret(out.Encrypted, appKey)
	require.NoError(t, err)
	_, accountID, _, err := libkb.ParseStellarSecretKey(relaySecrets.Sk.SecureNoLogString())
	require.NoError(t, err)
	require.Equal(t, out.RelayAccountID, accountID)
	require.Len(t, relaySecrets.StellarID, 64)
	require.Equal(t, "hey", relaySecrets.Note)
}

func TestGetAvailableCurrencies(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	stellar.ServiceInit(tcs[0].G)
	conf, err := tcs[0].G.GetStellar().GetServerDefinitions(context.Background())
	require.NoError(t, err)
	require.Equal(t, conf.Currencies["USD"].Name, "US Dollar")
	require.Equal(t, conf.Currencies["EUR"].Name, "Euro")
}

type TestContext struct {
	libkb.TestContext
	Fu     *kbtest.FakeUser
	Srv    *Server
	Remote *RemoteMock
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
		srv, rm := newTestServer(tc.G)
		tcs = append(tcs, &TestContext{
			TestContext: tc,
			Fu:          fu,
			Srv:         srv,
			Remote:      rm,
		})
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

type nullSecretUI struct{}

func (nullSecretUI) GetPassphrase(keybase1.GUIEntryArg, *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("nullSecretUI.GetPassphrase")
}

type testUISource struct {
	secret libkb.SecretUI
}

func (t *testUISource) SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI {
	return t.secret
}

func newTestServer(g *libkb.GlobalContext) (*Server, *RemoteMock) {
	m := NewRemoteMock(g)
	return New(g, &testUISource{nullSecretUI{}}, m), m
}
