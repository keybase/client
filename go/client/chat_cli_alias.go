package client

import (
	"fmt"

	"github.com/keybase/client/go/protocol/chat1"
)

// FullConversationAlias is the full alias of a conversation ID. It is the ":"
// plus lower case hex string of the conversation ID, with first 2 bytes (4 hex
// characters) moved to the end. This is because first 2 bytes are for shard
// IDs, and for now is always 0.
type FullConversationAlias string

// ShortConversationAlias is a prefix of a FullConversationAlias.
type ShortConversationAlias string

func MakeFullConversationAlias(cid chat1.ConversationID) FullConversationAlias {
	cidHex := cid.String()
	return FullConversationAlias(":" + cidHex[4:] + cidHex[:4])
}

func (f FullConversationAlias) MustShorten(numOfBytes int) ShortConversationAlias {
	return ShortConversationAlias(f[:ConversationAliasWidth(numOfBytes)])
}

func (f FullConversationAlias) MustGetNumOfBytes() int {
	if len(f)%2 != 1 {
		panic(fmt.Sprintf("incorrect format of FullConversationAlias: %s", f))
	}
	return (len(f) - 1) / 2
}

func ConversationAliasWidth(numOfBytes int) int {
	return 1 + numOfBytes*2
}
