package systests

import (
	"bytes"
	"net/http"
	"os"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/client"
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

func TestStellarNoteRoundtripAndResets(t *testing.T) {
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
	encB64, err := stellar.NoteEncryptB64(context.Background(), alice.getPrimaryGlobalContext(), sampleNote(), nil)
	require.NoError(t, err)
	note, err := stellar.NoteDecryptB64(context.Background(), alice.getPrimaryGlobalContext(), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("note to both users")
	other := bob.userVersion()
	encB64, err = stellar.NoteEncryptB64(context.Background(), alice.getPrimaryGlobalContext(), sampleNote(), &other)
	require.NoError(t, err)

	t.Logf("decrypt as self")
	note, err = stellar.NoteDecryptB64(context.Background(), alice.getPrimaryGlobalContext(), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("decrypt as other")
	note, err = stellar.NoteDecryptB64(context.Background(), bob.getPrimaryGlobalContext(), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("reset sender")
	alice.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)
	alice.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	t.Logf("fail to decrypt as post-reset self")
	note, err = stellar.NoteDecryptB64(context.Background(), alice.getPrimaryGlobalContext(), encB64)
	require.Error(t, err)
	require.Equal(t, "note not encrypted for logged-in user", err.Error())

	t.Logf("decrypt as other")
	note, err = stellar.NoteDecryptB64(context.Background(), bob.getPrimaryGlobalContext(), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)
}

// Part 1:
// XLM is sent to a user before they have a PUK.
// In the form of multiple relay payments.
// They then get a PUK, add a wallet, and enter the impteam,
// which all kick the autoclaim into gear.
// Part 2:
// A relay payment is sent to the user who already has a wallet.
// The funds should be claimed asap.
//
// To debug this test use log filter "stellar_test|poll-|AutoClaim|stellar.claim|pollfor"
//
// Test took 35s with dev servers 2018-05-30
func TestStellarRelayAutoClaims(t *testing.T) {
	if os.Getenv("UNSKIP_CORE_8044") != "1" {
		t.Skip("CORE-8044")
	}
	tt := newTeamTester(t)
	defer tt.cleanup()
	useStellarTestNet(t)

	alice := tt.addUser("alice")
	bob := tt.addPuklessUser("bob")
	alice.kickTeamRekeyd()

	t.Logf("alice gets funded")
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
	require.NoError(t, cmd.Run())

	t.Logf("alice sends a second relay payment to bob P2")
	cmd = client.CmdWalletSend{
		Contextified: libkb.NewContextified(alice.tc.G),
		Recipient:    bob.username,
		Amount:       "30",
	}
	require.NoError(t, cmd.Run())

	t.Logf("get the impteam seqno to wait on later")
	team, _, _, err := teams.LookupImplicitTeam(context.Background(), alice.tc.G, alice.username+","+bob.username, false)
	require.NoError(t, err)
	nextSeqno := team.NextSeqno()

	t.Logf("bob gets a PUK and wallet")
	bob.perUserKeyUpgrade()
	bob.tc.G.GetStellar().CreateWalletSoft(context.Background())

	t.Logf("wait for alice to add bob to their impteam")
	alice.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{ID: team.ID}, nextSeqno)

	pollFor(t, "claims to complete", 10*time.Second, bob.tc.G, func(i int) bool {
		res, err = bob.stellarClient.GetWalletAccountsLocal(context.Background(), 0)
		require.NoError(t, err)
		t.Logf("poll-1-%v: %v", i, res[0].BalanceDescription)
		if res[0].BalanceDescription == "0 XLM" {
			return false
		}
		if res[0].BalanceDescription == "49.9999800 XLM" {
			t.Logf("poll-1-%v: received T1 but not T2", i)
			return false
		}
		if res[0].BalanceDescription == "29.9999800 XLM" {
			t.Logf("poll-1-%v: received T2 but not T1", i)
			return false
		}
		t.Logf("poll-1-%v: received both payments", i)
		require.Equal(t, "79.9999700 XLM", res[0].BalanceDescription)
		return true
	})

	t.Logf("--------------------")
	t.Logf("Part 2: Alice sends a relay payment to bob who now already has a wallet")
	cmd = client.CmdWalletSend{
		Contextified: libkb.NewContextified(alice.tc.G),
		Recipient:    bob.username,
		Amount:       "10",
		ForceRelay:   true,
	}
	require.NoError(t, cmd.Run())

	pollFor(t, "final claim to complete", 10*time.Second, bob.tc.G, func(i int) bool {
		res, err = bob.stellarClient.GetWalletAccountsLocal(context.Background(), 0)
		require.NoError(t, err)
		t.Logf("poll-2-%v: %v", i, res[0].BalanceDescription)
		if res[0].BalanceDescription == "79.9999700 XLM" {
			return false
		}
		t.Logf("poll-1-%v: received final payment", i)
		require.Equal(t, "89.9999600 XLM", res[0].BalanceDescription)
		return true
	})

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
	t.Logf("gift url: %v", url)
	res, err := http.Get(url)
	require.NoError(t, err, "friendbot request error")
	bodyBuf := new(bytes.Buffer)
	bodyBuf.ReadFrom(res.Body)
	t.Logf("gift res: %v", bodyBuf.String())
	require.Equal(t, 200, res.StatusCode, "friendbot response status code")
}

func useStellarTestNet(t testing.TB) {
	stellarnet.SetClientAndNetwork(horizon.DefaultTestNetClient, build.TestNetwork)
}
