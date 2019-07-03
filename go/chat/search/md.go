package search

import (
	"context"
	"fmt"
	"sync"
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
		Version: fmt.Sprintf("%d:%d", indexVersion, indexMetadataVersion),
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

func (m *indexMetadata) indexStatus(conv chat1.Conversation) indexStatus {
	min, max := MinMaxIDs(conv)
	numMsgs := int(max) - int(min) + 1
	if numMsgs <= 1 {
		return indexStatus{numMsgs: numMsgs}
	}
	numMissing := m.numMissing(min, max)
	return indexStatus{numMissing: numMissing, numMsgs: numMsgs}
}

func (m *indexMetadata) PercentIndexed(conv chat1.Conversation) int {
	status := m.indexStatus(conv)
	if status.numMsgs <= 1 {
		return 100
	}
	return int(100 * (1 - (float64(status.numMissing) / float64(status.numMsgs))))
}

func (m *indexMetadata) FullyIndexed(conv chat1.Conversation) bool {
	min, max := MinMaxIDs(conv)
	if max <= min {
		return true
	}
	return m.numMissing(min, max) == 0
}

type indexStatus struct {
	numMissing int
	numMsgs    int
}

type inboxIndexStatus struct {
	sync.Mutex
	// convID -> indexStatus
	inbox         map[string]indexStatus
	uiCh          chan chat1.ChatSearchIndexStatus
	dirty         bool
	cachedPercent int
}

func newInboxIndexStatus(uiCh chan chat1.ChatSearchIndexStatus) *inboxIndexStatus {
	return &inboxIndexStatus{
		inbox: make(map[string]indexStatus),
		uiCh:  uiCh,
	}
}

func (p *inboxIndexStatus) updateUI(ctx context.Context) (int, error) {
	p.Lock()
	defer p.Unlock()
	percentIndexed := p.percentIndexedLocked()
	if p.uiCh != nil {
		status := chat1.ChatSearchIndexStatus{
			PercentIndexed: percentIndexed,
		}
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case p.uiCh <- status:
		default:
		}
	}
	return percentIndexed, nil
}

func (p *inboxIndexStatus) numConvs() int {
	p.Lock()
	defer p.Unlock()
	return len(p.inbox)
}

func (p *inboxIndexStatus) addConv(m *indexMetadata, conv chat1.Conversation) {
	p.Lock()
	defer p.Unlock()
	p.dirty = true
	p.inbox[conv.GetConvID().String()] = m.indexStatus(conv)
}

func (p *inboxIndexStatus) rmConv(conv chat1.Conversation) {
	p.Lock()
	defer p.Unlock()
	p.dirty = true
	delete(p.inbox, conv.GetConvID().String())
}

func (p *inboxIndexStatus) percentIndexed() int {
	p.Lock()
	defer p.Unlock()
	return p.percentIndexedLocked()
}

func (p *inboxIndexStatus) percentIndexedLocked() int {
	if p.dirty {
		var numMissing, numMsgs int
		for _, status := range p.inbox {
			numMissing += status.numMissing
			numMsgs += status.numMsgs
		}
		if numMsgs == 0 {
			p.cachedPercent = 100
		} else {
			p.cachedPercent = int(100 * (1 - (float64(numMissing) / float64(numMsgs))))
		}
		p.dirty = false
	}
	return p.cachedPercent
}
