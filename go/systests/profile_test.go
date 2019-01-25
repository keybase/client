package systests

import (
	"context"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/engine"
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
			Key:           "bitcoin",
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
	require.Equal(t, len(expected.Suggestions), len(res.Suggestions))
	for i, b := range res.Suggestions {
		t.Logf("row %v", i)
		a := expected.Suggestions[i]
		require.Equal(t, a.Key, b.Key)
		require.Equal(t, a.BelowFold, b.BelowFold)
		require.Equal(t, a.ProfileText, b.ProfileText)
		require.Equal(t, a.PickerText, b.PickerText)
		require.Equal(t, a.PickerSubtext, b.PickerSubtext)
		require.Nil(t, b.Metas)
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
