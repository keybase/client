package search

import (
	"sort"
	"strings"
	"testing"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestTokenize(t *testing.T) {
	tc := externalstest.SetupTest(t, "tokenize", 2)
	defer tc.Cleanup()
	supportedSplit := []string{
		".",
		",",
		"?",
		"!",
		" ",
		"\n",
	}
	// make sure we split correctly for various separators we support and stem
	// on basic examples
	for _, sep := range supportedSplit {
		msgText := strings.Join([]string{
			// groupings
			"(hi1)",
			"[hi2]",
			"<hi3>",
			"{hi4}",
			// mentions
			"@hi5",
			"#hi6",
			// usernames
			"blumua@twitter",
			// markdown
			"*hi7*",
			"~hi8~",
			"_hi9_",
			"\"hi10\"",
			"'hi11'",
			//stem
			"wanted",
			"italy's",
			"looking",
			// utf8
			"约书亚和约翰屌爆",
			// emoji
			":+1:",
		}, sep)
		tokens := tokenize(msgText)
		t.Logf("msgText: %v, tokens: %v", msgText, tokens)
		sort.Strings(tokens)
		require.Equal(t, []string{
			"\"hi10\"",
			"#hi6",
			"'hi11'",
			"(hi1)",
			"*hi7*",
			":+1:",
			"<hi3>",
			"@hi5",
			"[hi2]",
			"_hi9_",
			"blumua",
			"blumua@twitter",
			"hi1",
			"hi10",
			"hi11",
			"hi2",
			"hi3",
			"hi4",
			"hi5",
			"hi6",
			"hi7",
			"hi8",
			"hi9",
			"itali",
			"italy",
			"italy's",
			"look",
			"looking",
			"s",
			"twitter",
			"want",
			"wanted",
			"{hi4}",
			"~hi8~",
			"约书亚和约翰屌爆",
		}, tokens)
	}
	// empty case
	require.Nil(t, tokenize(""))
}

func TestUpgradeRegexpArg(t *testing.T) {
	username := "mikem"
	sentByCase := func(query, resQuery, resSentBy string) {
		arg := chat1.SearchRegexpArg{
			Query: query,
		}
		res := UpgradeRegexpArgFromQuery(arg, username)
		require.Equal(t, resQuery, res.Query)
		require.Equal(t, resSentBy, res.Opts.SentBy)
	}
	sentByCase("from:karenm hi mike", "hi mike", "karenm")
	sentByCase("from:@karenm hi mike", "hi mike", "karenm")
	sentByCase("from:@karenm          hi mike          ", "hi mike", "karenm")
	sentByCase("from: hi mike", "from: hi mike", "")
	sentByCase("hi mike from:karenm", "hi mike from:karenm", "")
	sentByCase("from:me hi mike", "hi mike", "mikem")

	regexpCase := func(query, resQuery string, isRegex bool) {
		arg := chat1.SearchRegexpArg{
			Query: query,
		}
		res := UpgradeRegexpArgFromQuery(arg, username)
		require.Equal(t, resQuery, res.Query)
		require.Equal(t, isRegex, res.IsRegex)
	}
	regexpCase("/mike.*always/", "mike.*always", true)
	regexpCase("X/mike.*always/", "X/mike.*always/", false)

	arg := chat1.SearchRegexpArg{
		Query: "from:karenm /Lisa.*something/",
	}
	res := UpgradeRegexpArgFromQuery(arg, username)
	require.Equal(t, "Lisa.*something", res.Query)
	require.Equal(t, "karenm", res.Opts.SentBy)
	require.True(t, res.IsRegex)
}
