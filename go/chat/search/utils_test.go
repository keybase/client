package search

import (
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
			"(hello1)",
			"[hello2]",
			"<hello3>",
			"{hello4}",
			// mentions
			"@hello5",
			"#hello6",
			// usernames
			"blumua@twitter",
			// markdown
			"*hello7*",
			"~hello8~",
			"_hello9_",
			`"hello10"`,
			"'hello11'",
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
		require.Equal(t, tokenMap{
			`"hello10"`: map[string]struct{}{
				"hello10": struct{}{},
				"hel":     struct{}{},
				"hell":    struct{}{},
				"hello":   struct{}{},
				"hello1":  struct{}{},
			},
			"'hello11'": map[string]struct{}{
				"hello11": struct{}{},
				"hel":     struct{}{},
				"hell":    struct{}{},
				"hello":   struct{}{},
				"hello1":  struct{}{},
			},
			"{hello4}": map[string]struct{}{
				"hel":    struct{}{},
				"hell":   struct{}{},
				"hello":  struct{}{},
				"hello4": struct{}{},
			},
			"blumua@twitter": map[string]struct{}{
				"blumua":  struct{}{},
				"blu":     struct{}{},
				"blumu":   struct{}{},
				"twitter": struct{}{},
				"twit":    struct{}{},
				"twitt":   struct{}{},
				"blum":    struct{}{},
				"twi":     struct{}{},
				"twitte":  struct{}{},
			},
			"~hello8~": map[string]struct{}{
				"hello8": struct{}{},
				"hel":    struct{}{},
				"hell":   struct{}{},
				"hello":  struct{}{},
			},
			"_hello9_": map[string]struct{}{
				"hello9": struct{}{},
				"hel":    struct{}{},
				"hell":   struct{}{},
				"hello":  struct{}{},
			},
			"wanted": map[string]struct{}{
				"want":  struct{}{},
				"wan":   struct{}{},
				"wante": struct{}{},
			},
			":+1:": map[string]struct{}{
				":+1": struct{}{},
			},
			"<hello3>": map[string]struct{}{
				"hello":  struct{}{},
				"hello3": struct{}{},
				"hel":    struct{}{},
				"hell":   struct{}{},
			},
			"@hello5": map[string]struct{}{
				"hello5": struct{}{},
				"hel":    struct{}{},
				"hell":   struct{}{},
				"hello":  struct{}{},
			},
			"*hello7*": map[string]struct{}{
				"hello":  struct{}{},
				"hello7": struct{}{},
				"hel":    struct{}{},
				"hell":   struct{}{},
			},
			"italy's": map[string]struct{}{
				"ital":  struct{}{},
				"s":     struct{}{},
				"italy": struct{}{},
				"itali": struct{}{},
				"ita":   struct{}{},
			},
			"(hello1)": map[string]struct{}{
				"hello1": struct{}{},
				"hel":    struct{}{},
				"hell":   struct{}{},
				"hello":  struct{}{},
			},
			"[hello2]": map[string]struct{}{
				"hello2": struct{}{},
				"hel":    struct{}{},
				"hell":   struct{}{},
				"hello":  struct{}{},
			},
			"约书亚和约翰屌爆": map[string]struct{}{
				"约书":      struct{}{},
				"约书亚":     struct{}{},
				"约书亚和":    struct{}{},
				"约书亚和约":   struct{}{},
				"约书亚和约翰":  struct{}{},
				"约书亚和约翰屌": struct{}{},
				"约": struct{}{},
			},
			"#hello6": map[string]struct{}{
				"hello6": struct{}{},
				"hel":    struct{}{},
				"hell":   struct{}{},
				"hello":  struct{}{},
			},
			"looking": map[string]struct{}{
				"looki":  struct{}{},
				"lookin": struct{}{},
				"look":   struct{}{},
				"loo":    struct{}{},
			},
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
