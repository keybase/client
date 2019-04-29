package systests

import (
	"context"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestProofSuggestions(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("abc")

	res, err := alice.userClient.ProofSuggestions(context.Background(), 0)
	require.NoError(t, err)
	t.Logf("suggestions: %v", spew.Sdump(res))
	expected := keybase1.ProofSuggestionsRes{
		ShowMore: true,
		Suggestions: []keybase1.ProofSuggestion{{
			Key:           "twitter",
			ProfileText:   "Prove your Twitter",
			PickerText:    "Twitter",
			PickerSubtext: "twitter.com",
		}, {
			Key:           "github",
			ProfileText:   "Prove your GitHub",
			PickerText:    "GitHub",
			PickerSubtext: "github.com",
		}, {
			Key:           "reddit",
			ProfileText:   "Prove your Reddit",
			PickerText:    "Reddit",
			PickerSubtext: "reddit.com",
		}, {
			Key:           "hackernews",
			ProfileText:   "Prove your Hacker News",
			PickerText:    "Hacker News",
			PickerSubtext: "news.ycombinator.com",
		}, {
			Key:           "rooter",
			ProfileText:   "Prove your Rooter",
			PickerText:    "Rooter",
			PickerSubtext: "",
		}, {
			Key:           "gubble.social",
			ProfileText:   "Prove your Gubble.social",
			PickerText:    "Gubble.social",
			PickerSubtext: "Gubble instance",
		}, {
			Key:           "web",
			ProfileText:   "Prove your website",
			PickerText:    "Your own website",
			PickerSubtext: "",
		}, {
			Key:           "pgp",
			ProfileText:   "Add a PGP key",
			PickerText:    "PGP key",
			PickerSubtext: "",
		}, {
			Key:           "btc",
			ProfileText:   "Set a Bitcoin address",
			PickerText:    "Bitcoin address",
			PickerSubtext: "",
		}, {
			Key:           "zcash",
			ProfileText:   "Set a Zcash address",
			PickerText:    "Zcash address",
			PickerSubtext: "",
		}, {
			Key:           "gubble.cloud",
			BelowFold:     true,
			ProfileText:   "Prove your Gubble.cloud",
			PickerText:    "Gubble.cloud",
			PickerSubtext: "Gubble instance",
		}, {
			Key:           "theqrl.org",
			BelowFold:     true,
			ProfileText:   "Prove your Quantum Resistant Ledger",
			PickerText:    "Quantum Resistant Ledger",
			PickerSubtext: "theqrl.org",
		}}}
	require.Equal(t, expected.ShowMore, res.ShowMore)
	require.True(t, len(res.Suggestions) >= len(expected.Suggestions), "should be at least as many results as expected")
	for _, b := range res.Suggestions {
		if b.Key == "theqrl.org" {
			// Skip checking for logos for this one.
			continue
		}
		require.Len(t, b.ProfileIcon, 2)
		for _, icon := range b.ProfileIcon {
			checkIcon(t, icon)
		}
		for _, icon := range b.PickerIcon {
			checkIcon(t, icon)
		}

	}
	var found int
	for i, b := range res.Suggestions {
		if found >= len(expected.Suggestions) {
			t.Logf("done")
			break
		}
		t.Logf("row %v %v", i, b.Key)
		a := expected.Suggestions[found]
		if a.Key != b.Key {
			t.Logf("skipping %v (mismatch)", a.Key)
			continue
		}
		found++
		require.Equal(t, a.Key, b.Key)
		require.Equal(t, a.BelowFold, b.BelowFold)
		require.Equal(t, a.ProfileText, b.ProfileText)
		require.Equal(t, a.PickerText, b.PickerText)
		require.Equal(t, a.PickerSubtext, b.PickerSubtext)

	}
	require.Len(t, expected.Suggestions, found)
}

func checkIcon(t testing.TB, icon keybase1.SizedImage) {
	if icon.Width < 2 {
		t.Fatalf("unreasonable icon size")
	}
	if kbtest.SkipIconRemoteTest() {
		t.Logf("Skipping icon remote test")
		require.True(t, len(icon.Path) > 8)
	} else {
		resp, err := http.Get(icon.Path)
		require.Equal(t, 200, resp.StatusCode, "icon file should be reachable")
		require.NoError(t, err)
		body, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		if len(body) < 150 {
			t.Fatalf("unreasonable icon payload size")
		}
	}
}

func TestProofSuggestionsOmitProven(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()
	alice := tt.addUser("abc")

	assertOmitted := func(service string) {
		res, err := alice.userClient.ProofSuggestions(context.Background(), 0)
		require.NoError(t, err)
		for _, suggestion := range res.Suggestions {
			require.NotEqual(t, service, suggestion.Key)
		}
	}

	alice.proveRooter()
	t.Logf("alice proved rooter, so rooter is no longer suggested")
	assertOmitted("rooter")

	eng := engine.NewCryptocurrencyEngine(alice.MetaContext().G(), keybase1.RegisterAddressArg{
		Address: "zcCk6rKzynC4tT1Rmg325A5Xw81Ck3S6nD6mtPWCXaMtyFczkyU4kYjEhrcz2QKfF5T2siWGyJNxWo43XWT3qk5YpPhFGj2",
	})
	err := engine.RunEngine2(alice.MetaContext().WithUIs(libkb.UIs{
		LogUI:    alice.MetaContext().G().Log,
		SecretUI: alice.newSecretUI(),
	}), eng)
	require.NoError(t, err)
	t.Logf("alice added a zcash address, so zcash is no longer suggested")
	assertOmitted("zcash")
}
