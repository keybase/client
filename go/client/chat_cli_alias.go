package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/protocol/chat1"
)

// FullConversationAlias is the full alias of a conversation ID. It is the ":"
// plus lower case hex string of the conversation ID, with first 2 bytes (4 hex
// characters) moved to the end. This is because first 2 bytes are for shard
// IDs, and for now is always 0.
type FullConversationAlias string

// ShortConversationAlias is a prefix of a FullConversationAlias.
type ShortConversationAlias string

func ConversationAliasWidth(numOfBytes int) int {
	// ":" + hex encoding of bytes
	return 1 + numOfBytes*2
}

func MakeFullConversationAlias(cid chat1.ConversationID) FullConversationAlias {
	cidHex := strings.ToLower(cid.String())
	return FullConversationAlias(":" + cidHex[4:] + cidHex[:4])
}

func (f FullConversationAlias) mustBeValid() {
	if len(f)%2 != 1 || f[0] != ':' {
		panic(fmt.Sprintf("incorrect format of FullConversationAlias: %s", f))
	}
}

func (f FullConversationAlias) MustShorten(numOfBytes int) ShortConversationAlias {
	f.mustBeValid()
	return ShortConversationAlias(f[:ConversationAliasWidth(numOfBytes)])
}

func (f FullConversationAlias) MustGetNumOfBytes() int {
	f.mustBeValid()
	return (len(f) - 1) / 2
}

func (f FullConversationAlias) ToConversationIDOrBust() chat1.ConversationID {
	f.mustBeValid()
	cid, err := chat1.MakeConvID(string(f[1:]))
	if err != nil {
		panic(err)
	}
	return cid
}

func (s ShortConversationAlias) MatchesFullAlias(f FullConversationAlias) bool {
	return strings.HasPrefix(string(f), string(s))
}

func (s ShortConversationAlias) MatchesConversationID(cid chat1.ConversationID) bool {
	return strings.HasPrefix(string(MakeFullConversationAlias(cid)), string(s))
}

func ConversationAliasPrefixNumOfBytes(
	aliases []FullConversationAlias, minimumNumOfBytes int) (int, error) {
	if minimumNumOfBytes < 1 {
		minimumNumOfBytes = 1
	}
	if len(aliases) == 0 {
		return minimumNumOfBytes, nil
	}

	totalBytes := aliases[0].MustGetNumOfBytes()
numOfBytesFinder:
	for numOfBytes := minimumNumOfBytes; numOfBytes < totalBytes; numOfBytes++ {
		existing := make(map[ShortConversationAlias]bool)
		for _, alias := range aliases {
			shortened := alias.MustShorten(numOfBytes)
			if existing[shortened] {
				// With a reasonable minimumNumOfBytes, this should rarely happen, and
				// even it happens, it should be still reasonably fast. So we are not
				// bothering with using a trie.
				continue numOfBytesFinder
			}
			existing[shortened] = true
		}
		return numOfBytes, nil
	}

	return -1, errors.New("duplicate conversation IDs")
}
