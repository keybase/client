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

func TestConversationIDPrefixNumOfBytes(t *testing.T) {
	prefixNumOfBytes, err := conversationIDPrefixNumOfBytes([]FullConversationAlias{
		MakeFullConversationAlias(mustMakeConvID(t, "00000100000000000000")),
		MakeFullConversationAlias(mustMakeConvID(t, "00000200000000000000")),
	})
	require.NoError(t, err)
	require.Equal(t, 2, prefixNumOfBytes)

	prefixNumOfBytes, err = conversationIDPrefixNumOfBytes([]FullConversationAlias{
		MakeFullConversationAlias(mustMakeConvID(t, "00000000100000000000")),
		MakeFullConversationAlias(mustMakeConvID(t, "00000000200000000000")),
	})
	require.NoError(t, err)
	require.Equal(t, 3, prefixNumOfBytes)

	prefixNumOfBytes, err = conversationIDPrefixNumOfBytes([]FullConversationAlias{
		MakeFullConversationAlias(mustMakeConvID(t, "00000000000000000000")),
		MakeFullConversationAlias(mustMakeConvID(t, "00000000000000000000")),
	})
	require.Error(t, err)
}
