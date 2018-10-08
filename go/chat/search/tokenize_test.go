package search

import (
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/stretchr/testify/require"
)

func TestTokenize(t *testing.T) {
	tc := externalstest.SetupTest(t, "tokenize", 2)
	defer tc.Cleanup()
	supportedSep := []string{
		".", ",", "?", "!", "`", " ", "\n", ">",
	}
	// make sure we split correctly for various separators we support
	for _, sep := range supportedSep {
		msgText := strings.Join([]string{
			"*bye*",
			"~hi~",
			"hey",
			"约书亚和约翰屌爆",
			":+1:",
		}, sep)
		tokens := tokenize(msgText)
		t.Logf("msgText: %v, tokens: %v", msgText, tokens)
		sort.Strings(tokens)
		require.Equal(t, []string{
			"*bye*",
			":+1:",
			"hey",
			"~hi~",
			"约书亚和约翰屌爆",
		}, tokens)
	}
	// empty case
	require.Nil(t, tokenize(""))

	_, err := kbtest.CreateAndSignupFakeUser("ib", tc.G)
	require.NoError(t, err)
}

func TestGetQueryRe(t *testing.T) {
	queries := []string{"foo", "foo bar", "foo bar, baz? :+1:"}
	expectedRe := []string{"foo", "foo bar", "foo bar, baz\\? :\\+1:"}
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
