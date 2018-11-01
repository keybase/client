package search

import (
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/keybase/client/go/externalstest"
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

func TestGetQueryRe(t *testing.T) {
	queries := []string{
		"foo",
		"foo bar",
		"foo bar, baz? :+1:",
	}
	expectedRe := []string{
		"foo",
		"foo bar",
		"foo bar, baz\\? :\\+1:",
	}
	for i, query := range queries {
		re, err := getQueryRe(query)
		require.NoError(t, err)
		expected := regexp.MustCompile("(?i)" + expectedRe[i])
		require.Equal(t, expected, re)
		t.Logf("query: %v, expectedRe: %v, re: %v", query, expectedRe, re)
		ok := re.MatchString(query)
		require.True(t, ok)
	}
}
