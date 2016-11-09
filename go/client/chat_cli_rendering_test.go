package client

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func mustMakeConvID(t *testing.T, val string) chat1.ConversationID {
	id, err := chat1.MakeConvID(val)
	require.NoError(t, err)
	return id
}

func TestConversationIDPrefixLength(t *testing.T) {
	prefixLength, err := conversationIDPrefixLength([]chat1.ConversationID{
		mustMakeConvID(t, "00000100000000000000"),
		mustMakeConvID(t, "00000200000000000000"),
	})
	require.NoError(t, err)
	require.Equal(t, 4, prefixLength)

	prefixLength, err = conversationIDPrefixLength([]chat1.ConversationID{
		mustMakeConvID(t, "00000000100000000000"),
		mustMakeConvID(t, "00000000200000000000"),
	})
	require.NoError(t, err)
	require.Equal(t, 6, prefixLength)

	prefixLength, err = conversationIDPrefixLength([]chat1.ConversationID{
		mustMakeConvID(t, "00000000000000000000"),
		mustMakeConvID(t, "00000000000000000000"),
	})
	require.Error(t, err)
}
