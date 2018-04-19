package stellarsvc

import (
	"context"
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
	"github.com/stellar/go/keypair"
	"github.com/stretchr/testify/require"
)

func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	tc = externalstest.SetupTest(tb, name, depth+1)
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
	_, tcs, cleanup := setupNTests(t, 2)
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
	_, tcs, cleanup := setupNTests(t, 1)
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

func TestImport(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	srv, _ := newTestServer(tcs[0].G)

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	a1, s1 := randomStellarKeypair()
	argS1 := stellar1.ImportSecretKeyLocalArg{
		SecretKey:   s1,
		MakePrimary: false,
	}
	err = srv.ImportSecretKeyLocal(context.Background(), argS1)
	require.NoError(t, err)

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

	bundle, _, err := remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.Len(t, bundle.Accounts, 3)
}

func TestBalances(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	srv, rm := newTestServer(tcs[0].G)
	accountID := rm.AddAccount(t)

	balances, err := srv.BalancesLocal(context.Background(), accountID)
	if err != nil {
		t.Fatal(err)
	}

	require.Len(t, balances, 1)
	require.Equal(t, balances[0].Asset.Type, "native")
	require.Equal(t, balances[0].Amount, "10000")
}

func TestSendLocalStellarAddress(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	srv, rm := newTestServer(tcs[0].G)
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
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	_, err = stellar.CreateWallet(context.Background(), tcs[1].G)
	require.NoError(t, err)

	srvSender, rm := newTestServer(tcs[0].G)
	accountIDSender := rm.AddAccount(t)
	accountIDRecip := rm.AddAccount(t)

	srvRecip, _ := newTestServer(tcs[1].G)

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
		Recipient: fus[1].Username,
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
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	_, err = stellar.CreateWallet(context.Background(), tcs[1].G)
	require.NoError(t, err)

	srvSender, rm := newTestServer(tcs[0].G)
	accountIDSender := rm.AddAccount(t)
	accountIDRecip := rm.AddAccount(t)

	srvRecip, _ := newTestServer(tcs[1].G)

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
		Recipient: fus[1].Username,
		Amount:    "100",
		Asset:     stellar1.Asset{Type: "native"},
	}
	_, err = srvSender.SendLocal(context.Background(), arg)
	require.NoError(t, err)

	checkPayment := func(payment stellar1.PaymentCLILocal) {
		require.Equal(t, accountIDSender, payment.FromStellar)
		require.Equal(t, accountIDRecip, payment.ToStellar)
		require.NotNil(t, payment.ToUsername)
		require.Equal(t, fus[1].Username, *(payment.ToUsername))
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
}

// Create n TestContexts with logged in users
// Returns (FakeUsers, TestContexts, CleanupFunction)
func setupNTests(t *testing.T, n int) ([]*kbtest.FakeUser, []*libkb.TestContext, func()) {
	return setupNTestsWithPukless(t, n, 0)
}

func setupNTestsWithPukless(t *testing.T, n, nPukless int) ([]*kbtest.FakeUser, []*libkb.TestContext, func()) {
	require.True(t, n > 0, "must create at least 1 tc")
	require.True(t, n >= nPukless, "more pukless users than total users requested")
	var fus []*kbtest.FakeUser
	var tcs []*libkb.TestContext
	for i := 0; i < n; i++ {
		tc := SetupTest(t, "wall", 1)
		tcs = append(tcs, &tc)
		if i >= n-nPukless {
			tc.Tp.DisableUpgradePerUserKey = true
		}
		fu, err := kbtest.CreateAndSignupFakeUser("wall", tc.G)
		require.NoError(t, err)
		fus = append(fus, fu)
	}
	cleanup := func() {
		for _, tc := range tcs {
			tc.Cleanup()
		}
	}
	for i, fu := range fus {
		t.Logf("U%d: %v %v", i, fu.Username, fu.GetUserVersion())
	}
	return fus, tcs, cleanup
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
	return keybase1.GetPassphraseRes{}, nil
}

type testUISource struct{}

func (t *testUISource) SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI {
	return nullSecretUI{}
}

func newTestServer(g *libkb.GlobalContext) (*Server, *RemoteMock) {
	m := NewRemoteMock(g)
	return New(g, &testUISource{}, m), m
}
