package search

import (
	"fmt"
	"unsafe"

	"github.com/keybase/client/go/protocol/chat1"
)

const indexMetadataVersion = 3

type indexMetadata struct {
	SeenIDs map[chat1.MessageID]chat1.EmptyStruct `codec:"s"`
	Version string                                `codec:"v"`
}

func newIndexMetadata() *indexMetadata {
	return &indexMetadata{
		Version: fmt.Sprintf("%s:%s", indexVersion, indexMetadataVersion),
		SeenIDs: make(map[chat1.MessageID]chat1.EmptyStruct),
	}
}

var refIndexMetadata = newIndexMetadata()

func (m *indexMetadata) Size() int64 {
	size := unsafe.Sizeof(m.Version)
	size += uintptr(len(m.SeenIDs)) * unsafe.Sizeof(chat1.MessageID(0))
	return int64(size)
}

func (m *indexMetadata) MissingIDForConv(conv chat1.Conversation) (res []chat1.MessageID) {
	min, max := MinMaxIDs(conv)
	for i := min; i <= max; i++ {
		if _, ok := m.SeenIDs[i]; !ok {
			res = append(res, i)
		}
	}
	return res
}

func (m *indexMetadata) numMissing(min, max chat1.MessageID) (numMissing int) {
	for i := min; i <= max; i++ {
		if _, ok := m.SeenIDs[i]; !ok {
			numMissing++
		}
	}
	return numMissing
}

func (m *indexMetadata) PercentIndexed(conv chat1.Conversation) int {
	min, max := MinMaxIDs(conv)
	numMessages := int(max) - int(min) + 1
	if numMessages <= 1 {
		return 100
	}
	numMissing := m.numMissing(min, max)
	return int(100 * (1 - (float64(numMissing) / float64(numMessages))))
}

func (m *indexMetadata) FullyIndexed(conv chat1.Conversation) bool {
	min, max := MinMaxIDs(conv)
	if max <= min {
		return true
	}
	return m.numMissing(min, max) == 0
}
