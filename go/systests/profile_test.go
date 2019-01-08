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

	profileProofs, err := alice.userClient.ProfileProofSuggestions(context.Background(), 0)
	require.NoError(t, err)
	t.Logf("profileProofs: %v", spew.Sdump(profileProofs))
	expectedProfileProofs := keybase1.ProfileProofSuggestionsRes{
		ShowMore: true,
		Suggestions: []keybase1.ProfileProofSuggestion{{
			Key:  "twitter",
			Text: "Prove your Twitter",
		}, {
			Key:  "github",
			Text: "Prove your GitHub",
		}, {
			Key:  "reddit",
			Text: "Prove your Reddit",
		}, {
			Key:  "hackernews",
			Text: "Prove your Hacker News",
		}, {
			Key:  "rooter",
			Text: "Prove your Rooter",
		}, {
			Key:  "gubble.social",
			Text: "Prove your Gubble.social",
		}, {
			Key:  "web",
			Text: "Prove your website",
		}, {
			Key:  "pgp",
			Text: "Add a PGP key",
		}, {
			Key:  "bitcoin",
			Text: "Set a Bitcoin address",
		}, {
			Key:  "zcash",
			Text: "Set a Zcash address",
		}}}
	require.Equal(t, expectedProfileProofs.ShowMore, profileProofs.ShowMore)
	require.Equal(t, len(expectedProfileProofs.Suggestions), len(profileProofs.Suggestions))
	for i, b := range profileProofs.Suggestions {
		t.Logf("row %v", i)
		a := expectedProfileProofs.Suggestions[i]
		require.Equal(t, a.Key, b.Key)
		require.Equal(t, a.Text, b.Text)
	}

	pickerProofs, err := alice.userClient.ProofSuggestions(context.Background(), 0)
	require.NoError(t, err)
	t.Logf("pickerProofs: %v", spew.Sdump(pickerProofs))
	expectedPickerProofs := []keybase1.ProofSuggestion{{
		Key:     "twitter",
		Text:    "Twitter",
		Subtext: "twitter.com",
	}, {
		Key:     "github",
		Text:    "GitHub",
		Subtext: "github.com",
	}, {
		Key:     "reddit",
		Text:    "Reddit",
		Subtext: "reddit.com",
	}, {
		Key:     "hackernews",
		Text:    "Hacker News",
		Subtext: "news.ycombinator.com",
	}, {
		Key:     "rooter",
		Text:    "Rooter",
		Subtext: "",
	}, {
		Key:     "gubble.social",
		Text:    "Gubble.social",
		Subtext: "gubble.social",
	}, {
		Key:     "web",
		Text:    "Your own website",
		Subtext: "",
	}, {
		Key:     "pgp",
		Text:    "PGP key",
		Subtext: "",
	}, {
		Key:     "bitcoin",
		Text:    "Bitcoin address",
		Subtext: "",
	}, {
		Key:     "zcash",
		Text:    "Zcash address",
		Subtext: "",
	}, {
		Key:     "gubble.cloud",
		Text:    "Gubble.cloud",
		Subtext: "gubble.cloud",
	}, {
		Key:     "theqrl.org",
		Text:    "Quantum Resistant Ledger",
		Subtext: "theqrl.org",
	}}
	require.Equal(t, len(expectedPickerProofs), len(pickerProofs))
	for i, b := range pickerProofs {
		t.Logf("row %v", i)
		a := expectedPickerProofs[i]
		require.Equal(t, a.Key, b.Key)
		require.Equal(t, a.Text, b.Text)
		require.Equal(t, a.Subtext, b.Subtext)
	}

}

func TestProofSuggestionsOmitProven(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()
	alice := tt.addUser("abc")

	assertOmitted := func(service string) {
		profileProofs, err := alice.userClient.ProfileProofSuggestions(context.Background(), 0)
		require.NoError(t, err)
		for _, suggestion := range profileProofs.Suggestions {
			require.NotEqual(t, service, suggestion.Key)
		}
		pickerProofs, err := alice.userClient.ProofSuggestions(context.Background(), 0)
		require.NoError(t, err)
		for _, suggestion := range pickerProofs {
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
