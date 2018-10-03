package search

import (
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
		msgText := strings.Join([]string{"hi", "bye", "hi"}, sep)
		tokens := tokenize(msgText)
		t.Logf("msgText: %v, tokens: %v", msgText, tokens)
		require.Equal(t, []string{"hi", "bye"}, tokens)
	}
	// empty case
	require.Nil(t, tokenize(""))

	_, err := kbtest.CreateAndSignupFakeUser("ib", tc.G)
	require.NoError(t, err)
}
