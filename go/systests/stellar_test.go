package systests

import (
	"bytes"
	"net/http"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
	"github.com/stellar/go/clients/horizon"
	"github.com/stretchr/testify/require"
)

const disable = false
const disableMsg = "friendbot issues"

func TestStellarNoteRoundtripAndResets(t *testing.T) {
	if disable {
		t.Skip(disableMsg)
	}
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	// Sign up two users, bob and alice.
	alice := ctx.installKeybaseForUser("alice", 10)
	alice.signup()
	divDebug(ctx, "Signed up alice (%s)", alice.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	t.Logf("note to self")
	encB64, err := stellar.NoteEncryptB64(libkb.NewMetaContextBackground(alice.getPrimaryGlobalContext()), sampleNote(), nil)
	require.NoError(t, err)
	note, err := stellar.NoteDecryptB64(libkb.NewMetaContextBackground(alice.getPrimaryGlobalContext()), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("note to both users")
	other := bob.userVersion()
	encB64, err = stellar.NoteEncryptB64(libkb.NewMetaContextBackground(alice.getPrimaryGlobalContext()), sampleNote(), &other)
	require.NoError(t, err)

	t.Logf("decrypt as self")
	note, err = stellar.NoteDecryptB64(libkb.NewMetaContextBackground(alice.getPrimaryGlobalContext()), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("decrypt as other")
	note, err = stellar.NoteDecryptB64(libkb.NewMetaContextBackground(bob.getPrimaryGlobalContext()), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("reset sender")
	alice.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)
	alice.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	t.Logf("fail to decrypt as post-reset self")
	_, err = stellar.NoteDecryptB64(libkb.NewMetaContextBackground(alice.getPrimaryGlobalContext()), encB64)
	require.Error(t, err)
	require.Equal(t, "note not encrypted for logged-in user", err.Error())

	t.Logf("decrypt as other")
	note, err = stellar.NoteDecryptB64(libkb.NewMetaContextBackground(bob.getPrimaryGlobalContext()), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)
}

// Test took 38s on a dev server 2018-06-07
func TestStellarRelayAutoClaims(t *testing.T) {
	kbtest.SkipTestOnNonMasterCI(t, "slow stellar test")
	if disable {
		t.Skip(disableMsg)
	}
	testStellarRelayAutoClaims(t, false, false)
}

// Test took 29s on a dev server 2018-06-07
func TestStellarRelayAutoClaimsWithPUK(t *testing.T) {
	kbtest.SkipTestOnNonMasterCI(t, "slow stellar test")
	if disable {
		t.Skip(disableMsg)
	}
	testStellarRelayAutoClaims(t, true, true)
}

// Part 1:
// XLM is sent to a user before they have a [PUK / wallet].
// In the form of multiple relay payments.
// They then [get a PUK,] add a wallet, and enter the impteam,
// which all kick the autoclaim into gear.
//
// Part 2:
// A relay payment is sent to the user who already has a wallet.
// The funds should be claimed asap.
//
// To debug this test use log filter "stellar_test|poll-|AutoClaim|stellar.claim|pollfor"
func testStellarRelayAutoClaims(t *testing.T, startWithPUK, skipPart2 bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()
	useStellarTestNet(t)

	alice := tt.addUser("alice")
	var bob *userPlusDevice
	if startWithPUK {
		bob = tt.addUser("bob")
	} else {
		bob = tt.addPuklessUser("bob")
	}
	alice.kickTeamRekeyd()

	t.Logf("alice gets funded")
	acceptDisclaimer(alice)

	baseFeeStroops := int64(alice.tc.G.GetStellar().(*stellar.Stellar).WalletStateForTest().BaseFee(alice.tc.MetaContext()))

	res, err := alice.stellarClient.GetWalletAccountsLocal(context.Background(), 0)
	require.NoError(t, err)
	gift(t, res[0].AccountID)

	t.Logf("alice sends a first relay payment to bob P1")
	attachIdentifyUI(t, alice.tc.G, newSimpleIdentifyUI())
	cmd := client.CmdWalletSend{
		Contextified: libkb.NewContextified(alice.tc.G),
		Recipient:    bob.username,
		Amount:       "50",
	}
	for i := 0; i < retryCount; i++ {
		err = cmd.Run()
		if err == nil {
			break
		}
	}
	require.NoError(t, err)

	t.Logf("alice sends a second relay payment to bob P2")
	cmd = client.CmdWalletSend{
		Contextified: libkb.NewContextified(alice.tc.G),
		Recipient:    bob.username,
		Amount:       "30",
	}
	for i := 0; i < retryCount; i++ {
		err = cmd.Run()
		if err == nil {
			break
		}
	}
	require.NoError(t, err)

	t.Logf("get the impteam seqno to wait on later")
	team, _, _, err := teams.LookupImplicitTeam(context.Background(), alice.tc.G, alice.username+","+bob.username, false, teams.ImplicitTeamOptions{})
	require.NoError(t, err)
	nextSeqno := team.NextSeqno()

	if startWithPUK {
		t.Logf("bob gets a wallet")
		acceptDisclaimer(bob)
	} else {
		t.Logf("bob gets a PUK and wallet")
		bob.device.tctx.Tp.DisableUpgradePerUserKey = false
		acceptDisclaimer(bob)

		t.Logf("wait for alice to add bob to their impteam")
		alice.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{ID: team.ID}, nextSeqno)
	}

	pollTime := 20 * time.Second
	if libkb.UseCITime(bob.tc.G) {
		// This test is especially slow because it's waiting on multiple transactions
		pollTime = 90 * time.Second
	}

	pollFor(t, "claims to complete", pollTime, bob.tc.G, func(i int) bool {
		// The first claims takes a create_account + account_merge. The second only account_merge.
		res, err = bob.stellarClient.GetWalletAccountsLocal(context.Background(), 0)
		require.NoError(t, err)
		t.Logf("poll-1-%v: %v", i, res[0].BalanceDescription)
		if res[0].BalanceDescription == "0 XLM" {
			return false
		}
		if isWithinFeeBounds(t, res[0].BalanceDescription, "50", baseFeeStroops*2) {
			t.Logf("poll-1-%v: received T1 but not T2", i)
			return false
		}
		if isWithinFeeBounds(t, res[0].BalanceDescription, "30", baseFeeStroops*2) {
			t.Logf("poll-1-%v: received T2 but not T1", i)
			return false
		}
		t.Logf("poll-1-%v: received both payments", i)
		assertWithinFeeBounds(t, res[0].BalanceDescription, "80", baseFeeStroops*3)
		return true
	})

	if skipPart2 {
		t.Logf("Skipping part 2")
		return
	}

	t.Logf("--------------------")
	t.Logf("Part 2: Alice sends a relay payment to bob who now already has a wallet")
	cmd = client.CmdWalletSend{
		Contextified: libkb.NewContextified(alice.tc.G),
		Recipient:    bob.username,
		Amount:       "10",
		ForceRelay:   true,
	}
	for i := 0; i < retryCount; i++ {
		err = cmd.Run()
		if err == nil {
			break
		}
	}
	require.NoError(t, err)

	pollFor(t, "final claim to complete", pollTime, bob.tc.G, func(i int) bool {
		res, err = bob.stellarClient.GetWalletAccountsLocal(context.Background(), 0)
		require.NoError(t, err)
		t.Logf("poll-2-%v: %v", i, res[0].BalanceDescription)
		if isWithinFeeBounds(t, res[0].BalanceDescription, "80", baseFeeStroops*3) {
			return false
		}
		t.Logf("poll-1-%v: received final payment", i)
		assertWithinFeeBounds(t, res[0].BalanceDescription, "90", baseFeeStroops*4)
		return true
	})

}

// XLM is sent to a rooter assertion that does not resolve.
// The recipient-to-be signs up, gets a wallet, and then proves the assertion.
// The recipient enters the impteam which kicks autoclaim into gear.
//
// To debug this test use log filter "stellar_test|poll-|AutoClaim|stellar.claim|pollfor"
// Test took 20s on a dev server 2019-01-23
func TestStellarRelayAutoClaimsSBS(t *testing.T) {
	kbtest.SkipTestOnNonMasterCI(t, "slow stellar test")
	if disable {
		t.Skip(disableMsg)
	}
	tt := newTeamTester(t)
	defer tt.cleanup()
	useStellarTestNet(t)

	alice := tt.addUser("alice")
	bob := tt.addUser("bob")
	rooterAssertion := bob.username + "@rooter"
	alice.kickTeamRekeyd()

	t.Logf("alice gets funded")
	acceptDisclaimer(alice)

	res, err := alice.stellarClient.GetWalletAccountsLocal(context.Background(), 0)
	require.NoError(t, err)
	gift(t, res[0].AccountID)

	t.Logf("alice sends a first relay payment to bob P1")
	attachIdentifyUI(t, alice.tc.G, newSimpleIdentifyUI())
	cmd := client.CmdWalletSend{
		Contextified: libkb.NewContextified(alice.tc.G),
		Recipient:    rooterAssertion,
		Amount:       "50",
	}
	for i := 0; i < retryCount; i++ {
		err = cmd.Run()
		if err == nil {
			break
		}
	}
	require.NoError(t, err)
	baseFeeStroops := int64(alice.tc.G.GetStellar().(*stellar.Stellar).WalletStateForTest().BaseFee(alice.tc.MetaContext()))
	t.Logf("baseFeeStroops %v", baseFeeStroops)

	t.Logf("get the impteam seqno to wait on later")
	team, _, _, err := teams.LookupImplicitTeam(context.Background(), alice.tc.G, alice.username+","+rooterAssertion, false, teams.ImplicitTeamOptions{})
	require.NoError(t, err)
	nextSeqno := team.NextSeqno()

	t.Logf("bob proves his rooter")
	tt.users[1].proveRooter()
	t.Logf("bob gets a wallet")
	acceptDisclaimer(bob)

	t.Logf("wait for alice to add bob to their impteam")
	alice.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{ID: team.ID}, nextSeqno)

	pollTime := 20 * time.Second
	if libkb.UseCITime(bob.tc.G) {
		// This test is especially slow.
		pollTime = 30 * time.Second
	}

	pollFor(t, "claim to complete", pollTime, bob.tc.G, func(i int) bool {
		res, err = bob.stellarClient.GetWalletAccountsLocal(context.Background(), 0)
		require.NoError(t, err)
		t.Logf("poll-1-%v: %v", i, res[0].BalanceDescription)
		if res[0].BalanceDescription == "0 XLM" {
			return false
		}
		t.Logf("poll-1-%v: received P1", i)
		require.NoError(t, err)
		// This assertion could potentially fail if baseFee changes between the send and BaseFee calls above.
		assertWithinFeeBounds(t, res[0].BalanceDescription, "50", baseFeeStroops*2) // paying for create_account + account_merge
		return true
	})
}

// Assert that: target - maxMissingStroops <= amount <= target
// Strips suffix off amount.
func assertWithinFeeBounds(t testing.TB, amount string, target string, maxFeeStroops int64) {
	suffix := " XLM"
	amount = strings.TrimSuffix(amount, suffix)
	amountX, err := stellarnet.ParseStellarAmount(amount)
	require.NoError(t, err)
	targetX, err := stellarnet.ParseStellarAmount(target)
	require.NoError(t, err)
	lowestX := targetX - maxFeeStroops
	require.LessOrEqual(t, amountX, targetX)
	require.LessOrEqual(t, lowestX, amountX)
}

func isWithinFeeBounds(t testing.TB, amount string, target string, maxFeeStroops int64) bool {
	suffix := " XLM"
	amount = strings.TrimSuffix(amount, suffix)
	amountX, err := stellarnet.ParseStellarAmount(amount)
	require.NoError(t, err)
	targetX, err := stellarnet.ParseStellarAmount(target)
	require.NoError(t, err)
	lowestX := targetX - maxFeeStroops
	return amountX <= targetX && amountX >= lowestX
}

func sampleNote() stellar1.NoteContents {
	return stellar1.NoteContents{
		Note:      "wizbang",
		StellarID: stellar1.TransactionID("6653fc2fdbc42ad51ccbe77ee0a3c29e258a5513c62fdc532cbfff91ab101abf"),
	}
}

// Friendbot sends someone XLM
func gift(t testing.TB, accountID stellar1.AccountID) {
	t.Logf("gift -> %v", accountID)
	url := "https://friendbot.stellar.org/?addr=" + accountID.String()
	for i := 0; i < retryCount; i++ {
		t.Logf("gift url: %v", url)
		res, err := http.Get(url)
		if err != nil {
			t.Logf("http get %s error: %s", url, err)
			continue
		}
		bodyBuf := new(bytes.Buffer)
		_, err = bodyBuf.ReadFrom(res.Body)
		require.NoError(t, err)
		res.Body.Close()
		t.Logf("gift res: %v", bodyBuf.String())
		if res.StatusCode == 200 {
			return
		}
		t.Logf("gift status not ok: %d", res.StatusCode)
	}
	t.Fatalf("gift to %s failed after multiple attempts", accountID)
}

func useStellarTestNet(t testing.TB) {
	stellarnet.SetClientAndNetwork(horizon.DefaultTestNetClient, build.TestNetwork)
}

func acceptDisclaimer(u *userPlusDevice) {
	err := u.stellarClient.AcceptDisclaimerLocal(context.Background(), 0)
	require.NoError(u.tc.T, err)
}

func TestAccountMerge(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()
	useStellarTestNet(t)
	ctx := context.Background()
	alice := tt.addUser("alice")

	t.Logf("fund two accounts for alice from one friendbot gift for 10k lumens")
	acceptDisclaimer(alice)
	walletState := alice.tc.G.GetStellar().(*stellar.Stellar).WalletStateForTest()
	getRes, err := alice.stellarClient.GetWalletAccountsLocal(context.Background(), 0)
	firstAccountID := getRes[0].AccountID
	require.NoError(t, err)
	secondAccountID, err := alice.stellarClient.CreateWalletAccountLocal(ctx, stellar1.CreateWalletAccountLocalArg{Name: "second"})
	require.NoError(t, err)

	stroopsInAcct := func(acctID stellar1.AccountID) int64 {
		acctBalances, err := walletState.Balances(ctx, acctID)
		require.NoError(t, err)
		if len(acctBalances) == 0 {
			return 0
		}
		amount, err := stellarnet.ParseStellarAmount(acctBalances[0].Amount)
		require.NoError(t, err)
		return amount
	}

	pollTime := 20 * time.Second
	if libkb.UseCITime(alice.tc.G) {
		// This test is especially slow.
		pollTime = 30 * time.Second
	}

	gift(t, firstAccountID)
	pollFor(t, "set up first account", pollTime, alice.tc.G, func(i int) bool {
		err = walletState.Refresh(alice.tc.MetaContext(), firstAccountID, "test")
		require.NoError(t, err)
		return stroopsInAcct(firstAccountID) > 0
	})

	attachIdentifyUI(t, alice.tc.G, newSimpleIdentifyUI())
	sendCmd := client.CmdWalletSend{
		Contextified: libkb.NewContextified(alice.tc.G),
		Recipient:    secondAccountID.String(),
		Amount:       "50",
	}
	for i := 0; i < retryCount; i++ {
		err = sendCmd.Run()
		if err == nil {
			break
		}
	}
	require.NoError(t, err)

	pollFor(t, "set up second account", pollTime, alice.tc.G, func(i int) bool {
		err = walletState.Refresh(alice.tc.MetaContext(), firstAccountID, "test")
		require.NoError(t, err)
		err = walletState.Refresh(alice.tc.MetaContext(), secondAccountID, "test")
		require.NoError(t, err)
		secondAcctBalance := stroopsInAcct(secondAccountID)
		if secondAcctBalance == 0 {
			t.Logf("waiting on payment between accounts to complete")
			return false
		}
		require.Equal(t, secondAcctBalance, int64(50*stellarnet.StroopsPerLumen))
		return true
	})
	t.Logf("10k lumens split into two accounts: ~99,949.999 and 50")

	beforeMergeBalance := stroopsInAcct(firstAccountID)
	mergeCmd := client.CmdWalletMerge{
		Contextified:  libkb.NewContextified(alice.tc.G),
		FromAccountID: secondAccountID,
		To:            firstAccountID.String(),
	}
	err = mergeCmd.Run()
	require.NoError(t, err)

	pollFor(t, "merge command", pollTime, alice.tc.G, func(i int) bool {
		err = walletState.RefreshAll(alice.tc.MetaContext(), "test")
		require.NoError(t, err)
		afterMergeBalance := stroopsInAcct(firstAccountID)
		if beforeMergeBalance == afterMergeBalance {
			t.Logf("waiting on merge to complete")
			return false
		}
		return true
	})

	t.Logf("merged the second into the first")
	afterMergeBalance := stroopsInAcct(firstAccountID)
	lowerBoundFinalExpectedAmount := int64(stellarnet.StroopsPerLumen * 9999.99)
	require.True(t, afterMergeBalance > lowerBoundFinalExpectedAmount)
	t.Logf("value of the second account was merged into the first account")
}
