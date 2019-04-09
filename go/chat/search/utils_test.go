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
			`"hello10"`: map[string]chat1.EmptyStruct{
				"hello10": chat1.EmptyStruct{},
				"hel":     chat1.EmptyStruct{},
				"hell":    chat1.EmptyStruct{},
				"hello":   chat1.EmptyStruct{},
				"hello1":  chat1.EmptyStruct{},
			},
			"'hello11'": map[string]chat1.EmptyStruct{
				"hello11": chat1.EmptyStruct{},
				"hel":     chat1.EmptyStruct{},
				"hell":    chat1.EmptyStruct{},
				"hello":   chat1.EmptyStruct{},
				"hello1":  chat1.EmptyStruct{},
			},
			"{hello4}": map[string]chat1.EmptyStruct{
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
				"hello":  chat1.EmptyStruct{},
				"hello4": chat1.EmptyStruct{},
			},
			"blumua@twitter": map[string]chat1.EmptyStruct{
				"blumua":  chat1.EmptyStruct{},
				"blu":     chat1.EmptyStruct{},
				"blumu":   chat1.EmptyStruct{},
				"twitter": chat1.EmptyStruct{},
				"twit":    chat1.EmptyStruct{},
				"twitt":   chat1.EmptyStruct{},
				"blum":    chat1.EmptyStruct{},
				"twi":     chat1.EmptyStruct{},
				"twitte":  chat1.EmptyStruct{},
			},
			"~hello8~": map[string]chat1.EmptyStruct{
				"hello8": chat1.EmptyStruct{},
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
				"hello":  chat1.EmptyStruct{},
			},
			"_hello9_": map[string]chat1.EmptyStruct{
				"hello9": chat1.EmptyStruct{},
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
				"hello":  chat1.EmptyStruct{},
			},
			"wanted": map[string]chat1.EmptyStruct{
				"want":  chat1.EmptyStruct{},
				"wan":   chat1.EmptyStruct{},
				"wante": chat1.EmptyStruct{},
			},
			":+1:": map[string]chat1.EmptyStruct{
				":+1": chat1.EmptyStruct{},
			},
			"<hello3>": map[string]chat1.EmptyStruct{
				"hello":  chat1.EmptyStruct{},
				"hello3": chat1.EmptyStruct{},
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
			},
			"@hello5": map[string]chat1.EmptyStruct{
				"hello5": chat1.EmptyStruct{},
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
				"hello":  chat1.EmptyStruct{},
			},
			"*hello7*": map[string]chat1.EmptyStruct{
				"hello":  chat1.EmptyStruct{},
				"hello7": chat1.EmptyStruct{},
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
			},
			"italy's": map[string]chat1.EmptyStruct{
				"ital":  chat1.EmptyStruct{},
				"s":     chat1.EmptyStruct{},
				"italy": chat1.EmptyStruct{},
				"itali": chat1.EmptyStruct{},
				"ita":   chat1.EmptyStruct{},
			},
			"(hello1)": map[string]chat1.EmptyStruct{
				"hello1": chat1.EmptyStruct{},
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
				"hello":  chat1.EmptyStruct{},
			},
			"[hello2]": map[string]chat1.EmptyStruct{
				"hello2": chat1.EmptyStruct{},
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
				"hello":  chat1.EmptyStruct{},
			},
			"约书亚和约翰屌爆": map[string]chat1.EmptyStruct{
				"约":      chat1.EmptyStruct{},
				"约书":     chat1.EmptyStruct{},
				"约书亚":    chat1.EmptyStruct{},
				"约书亚和":   chat1.EmptyStruct{},
				"约书亚和约":  chat1.EmptyStruct{},
				"约书亚和约翰": chat1.EmptyStruct{},
			},
			"#hello6": map[string]chat1.EmptyStruct{
				"hello6": chat1.EmptyStruct{},
				"hel":    chat1.EmptyStruct{},
				"hell":   chat1.EmptyStruct{},
				"hello":  chat1.EmptyStruct{},
			},
			"looking": map[string]chat1.EmptyStruct{
				"looki":  chat1.EmptyStruct{},
				"lookin": chat1.EmptyStruct{},
				"look":   chat1.EmptyStruct{},
				"loo":    chat1.EmptyStruct{},
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
