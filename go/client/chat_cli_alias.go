package client

import (
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

func (f FullConversationAlias) Shorten(numOfBytes int) ShortConversationAlias {
	f.mustBeValid()
	return ShortConversationAlias(f[:ConversationAliasWidth(numOfBytes)])
}

func (f FullConversationAlias) NumOfBytes() int {
	f.mustBeValid()
	return (len(f) - 1) / 2
}

func (f FullConversationAlias) ToConversationID() chat1.ConversationID {
	f.mustBeValid()
	cid, err := chat1.MakeConvID(string(f[1:]))
	if err != nil {
		panic(err)
	}
	return cid
}

func MakeShortConversationAlias(str string) (ShortConversationAlias, bool) {
	if len(str) <= 1 || !strings.HasPrefix(str, ":") {
		return "", false
	}
	return ShortConversationAlias(str), true
}

func (s ShortConversationAlias) MatchesFullAlias(f FullConversationAlias) bool {
	return strings.HasPrefix(string(f), string(s))
}

func (s ShortConversationAlias) MatchesConversationID(cid chat1.ConversationID) bool {
	return strings.HasPrefix(string(MakeFullConversationAlias(cid)), string(s))
}

// ConversationIDGetter represents a group of conversation IDs.
type ConversationIDGetter interface {
	GetConversationID(index int) chat1.ConversationID
	Len() int
}

// ConversationAliasShortener shortens conversation ID aliases. It's not safe
// to use it from multiple go routines.
type ConversationAliasShortener struct {
	shortened         []ShortConversationAlias
	idGetter          ConversationIDGetter
	minimumNumOfBytes int
}

// NewConversationAliasShortener creates an ConversationAliasShortener. During
// the lifetime of a ConversationAliasShortener, any call to any method in this
// interface with the same argument should return the same value.
func NewConversationAliasShortener(idGetter ConversationIDGetter, minimumNumOfBytes int) *ConversationAliasShortener {
	return &ConversationAliasShortener{
		idGetter:          idGetter,
		minimumNumOfBytes: minimumNumOfBytes,
	}
}

func (s *ConversationAliasShortener) shorten() {
	if s.shortened != nil {
		return
	}

	if s.idGetter.Len() == 0 {
		return
	}

	s.shortened = make([]ShortConversationAlias, s.idGetter.Len())

	if s.minimumNumOfBytes < 1 {
		s.minimumNumOfBytes = 1
	}

	aliases := make([]FullConversationAlias, 0, s.idGetter.Len())
	for i := 0; i < s.idGetter.Len(); i++ {
		aliases = append(aliases, MakeFullConversationAlias(s.idGetter.GetConversationID(i)))
	}

	totalBytes := aliases[0].NumOfBytes()
numOfBytesFinder:
	for numOfBytes := s.minimumNumOfBytes; numOfBytes < totalBytes; numOfBytes++ {
		existing := make(map[ShortConversationAlias]bool)
		for i, alias := range aliases {
			s.shortened[i] = alias.Shorten(numOfBytes)
			if existing[s.shortened[i]] {
				// With a reasonable minimumNumOfBytes, this should rarely happen, and
				// even it happens, it should be still reasonably fast. So we are not
				// bothering with using a trie.
				continue numOfBytesFinder
			}
			existing[s.shortened[i]] = true
		}
		return
	}

	panic("duplicate conversation IDs")
}

// Shorten returns a ShortConversationAlias of conversation ID at index from
// the internal ConversationIDGetter. Caller needs to ensure index < Len() of
// the internal ConversationIDGetter.
func (s *ConversationAliasShortener) Shorten(index int) ShortConversationAlias {
	s.shorten()
	return s.shortened[index]
}

func (s *ConversationAliasShortener) ShortenedLength() int {
	if s.idGetter.Len() == 0 {
		return 0
	}
	s.shorten()
	return len(s.shortened[0])
}
