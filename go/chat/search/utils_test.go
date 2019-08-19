package search

import (
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
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
			// phone
			"(123)-456-7890",
			"(234).567.8901",
			"(345) 678 9012",
			"456-789-0123",
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
			"\"hello10\"": map[string]chat1.EmptyStruct{
				"hel":     {},
				"hell":    {},
				"hello":   {},
				"hello1":  {},
				"hello10": {},
			},
			"#hello6": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello6": {},
			},
			"'hello11'": map[string]chat1.EmptyStruct{
				"hel":     {},
				"hell":    {},
				"hello":   {},
				"hello1":  {},
				"hello11": {},
			},
			"(123)-456-7890": map[string]chat1.EmptyStruct{
				"123":  {},
				"456":  {},
				"789":  {},
				"7890": {},
			},
			"(hello1)": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello1": {},
			},
			"*hello7*": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello7": {},
			},
			"456-789-0123": map[string]chat1.EmptyStruct{
				"456":  {},
				"789":  {},
				"0123": {},
				"012":  {},
			},
			"(234)": map[string]chat1.EmptyStruct{
				"234": {},
			},
			"(345)": map[string]chat1.EmptyStruct{
				"345": {},
			},
			"567": map[string]chat1.EmptyStruct{},
			"678": map[string]chat1.EmptyStruct{},
			"8901": map[string]chat1.EmptyStruct{
				"890": {},
			},
			"9012": map[string]chat1.EmptyStruct{
				"901": {},
			},
			":+1:": map[string]chat1.EmptyStruct{
				":+1": {},
			},
			"<hello3>": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello3": {},
			},
			"@hello5": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello5": {},
			},
			"[hello2]": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello2": {},
			},
			"_hello9_": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello9": {},
			},
			"blumua@twitter": map[string]chat1.EmptyStruct{
				"blu":     {},
				"blum":    {},
				"blumu":   {},
				"blumua":  {},
				"twi":     {},
				"twit":    {},
				"twitt":   {},
				"twitte":  {},
				"twitter": {},
			},
			"italy's": map[string]chat1.EmptyStruct{
				"ita":   {},
				"ital":  {},
				"itali": {},
				"italy": {},
				"s":     {},
			},
			"looking": map[string]chat1.EmptyStruct{
				"loo":    {},
				"look":   {},
				"looki":  {},
				"lookin": {},
			},
			"wanted": map[string]chat1.EmptyStruct{
				"wan":   {},
				"want":  {},
				"wante": {},
			},
			"{hello4}": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello4": {},
			},
			"~hello8~": map[string]chat1.EmptyStruct{
				"hel":    {},
				"hell":   {},
				"hello":  {},
				"hello8": {},
			},
			"约书亚和约翰屌爆": map[string]chat1.EmptyStruct{
				"约":   {},
				"约书":  {},
				"约书亚": {},
			},
		}, tokens)
	}
	// empty case
	require.Nil(t, tokenize(""))
}

func TestUpgradeSearchOptsFromQuery(t *testing.T) {
	username := "mikem"
	sentByCase := func(query, resQuery, resSentBy string) {
		query, opts := UpgradeSearchOptsFromQuery(query, chat1.SearchOpts{}, username)
		require.Equal(t, resQuery, query)
		require.Equal(t, resSentBy, opts.SentBy)
	}
	sentByCase("from:karenm hi mike", "hi mike", "karenm")
	sentByCase("from:@karenm hi mike", "hi mike", "karenm")
	sentByCase("from:@karenm          hi mike          ", "hi mike", "karenm")
	sentByCase("from: hi mike", "from: hi mike", "")
	sentByCase("hi mike from:karenm", "hi mike", "karenm")
	sentByCase("from:me hi mike", "hi mike", "mikem")

	sentToCase := func(query, resQuery, resSentTo string) {
		query, opts := UpgradeSearchOptsFromQuery(query, chat1.SearchOpts{}, username)
		require.Equal(t, resQuery, query)
		require.Equal(t, resSentTo, opts.SentTo)
	}
	sentToCase("to:karenm hi mike", "hi mike", "karenm")
	sentToCase("to:@karenm hi mike", "hi mike", "karenm")
	sentToCase("to:@karenm          hi mike          ", "hi mike", "karenm")
	sentToCase("to: hi mike", "to: hi mike", "")
	sentToCase("hi mike to:karenm", "hi mike", "karenm")
	sentToCase("to:me hi mike", "hi mike", "mikem")

	regexpCase := func(query, resQuery string, isRegex bool) {
		query, opts := UpgradeSearchOptsFromQuery(query, chat1.SearchOpts{}, username)
		require.Equal(t, resQuery, query)
		require.Equal(t, isRegex, opts.IsRegex)
	}
	regexpCase("/", "/", false)
	regexpCase("//", "//", false)
	regexpCase("/mike.*always/", "mike.*always", true)
	regexpCase("X/mike.*always/", "X/mike.*always/", false)

	dateFilterCase := func(query, resQuery string, sentBefore, sentAfter gregor1.Time) {
		query, opts := UpgradeSearchOptsFromQuery(query, chat1.SearchOpts{}, username)
		require.Equal(t, resQuery, query)
		require.Equal(t, sentBefore, opts.SentBefore)
		require.Equal(t, sentAfter, opts.SentAfter)
	}
	parsed, err := time.Parse(time.RFC822, "16 Mar 18 00:00 UTC")
	require.NoError(t, err)
	expectedTime := gregor1.ToTime(parsed)
	dateFilterCase("before:2018-03-16 hi mike", "hi mike", expectedTime, 0)
	dateFilterCase("before:3/16/18 hi mike", "hi mike", expectedTime, 0)
	dateFilterCase("before:3.16.18 hi mike", "hi mike", expectedTime, 0)
	dateFilterCase("before:03/16/2018 hi mike", "hi mike", expectedTime, 0)
	dateFilterCase("after:2018-03-16 hi mike", "hi mike", 0, expectedTime)
	dateFilterCase("before:2018-03-16 after:2018-03-16 hi mike", "hi mike", expectedTime, expectedTime)
	dateFilterCase("before:2018 after:asdf hi mike", "before:2018 after:asdf hi mike", 0, 0)

	// the whole shabang
	query, opts := UpgradeSearchOptsFromQuery("from:karenm to:mikem before:2018-03-16 after:3/16/18 /Lisa.*something/",
		chat1.SearchOpts{}, username)
	require.Equal(t, "Lisa.*something", query)
	require.Equal(t, "karenm", opts.SentBy)
	require.Equal(t, "mikem", opts.SentTo)
	require.Equal(t, expectedTime, opts.SentBefore)
	require.Equal(t, expectedTime, opts.SentBefore)
	require.True(t, opts.IsRegex)

}
