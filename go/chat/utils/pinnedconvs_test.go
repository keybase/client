package utils

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestParsePinnedConvs(t *testing.T) {
	require.Nil(t, ParsePinnedConvs(nil))
	require.Nil(t, ParsePinnedConvs([]byte("not json")))
	require.Nil(t, ParsePinnedConvs([]byte(`{"a":1}`)))
	require.Equal(t, []chat1.ConvIDStr{"aa", "bb"},
		ParsePinnedConvs([]byte(`["aa","","bb","aa"]`)))
	require.Empty(t, ParsePinnedConvs([]byte(`[]`)))
}
