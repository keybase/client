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

type conversationIDs []chat1.ConversationID

func (c conversationIDs) Len() int                                         { return len(c) }
func (c conversationIDs) GetConversationID(index int) chat1.ConversationID { return c[index] }

func TestConversationAliasShortener(t *testing.T) {
	shortener := NewConversationAliasShortener(conversationIDs([]chat1.ConversationID{
		mustMakeConvID(t, "00000100000000000000"),
		mustMakeConvID(t, "00000200000000000000"),
	}), 2)
	require.Equal(t, ShortConversationAlias(":0100"), shortener.Shorten(0))
	require.Equal(t, ShortConversationAlias(":0200"), shortener.Shorten(1))
	require.Equal(t, 5, shortener.ShortenedLength())

	shortener = NewConversationAliasShortener(conversationIDs([]chat1.ConversationID{
		mustMakeConvID(t, "00000000100000000000"),
		mustMakeConvID(t, "00000000200000000000"),
	}), 2)
	require.Equal(t, 7, shortener.ShortenedLength())
	require.Equal(t, ShortConversationAlias(":000010"), shortener.Shorten(0))
	require.Equal(t, ShortConversationAlias(":000020"), shortener.Shorten(1))

	require.Panics(t, func() {
		NewConversationAliasShortener(conversationIDs([]chat1.ConversationID{
			mustMakeConvID(t, "00000000000000000000"),
			mustMakeConvID(t, "00000000000000000000"),
		}), 2).Shorten(0)
	})
}
