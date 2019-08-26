package merkletree2

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"
)

// Inefficient in memory StorageEngine implementation. Useful for tests, not for
// benchmarking. It ignores Transaction arguments, so it can't be used for
// concurrency tests.
type InMemoryStorageEngine struct {
	RootMRecords []RootMetadataRecord
	KVPRecords   []KVPRecord
	NodeRecords  []NodeRecord
}

var _ StorageEngine = &InMemoryStorageEngine{}

type NodeRecord struct {
	s Seqno
	p Position
	h Hash
}

type KVPRecord struct {
	s   Seqno
	kvp KeyValuePair
	h   Hash
}

type RootMetadataRecord struct {
	s Seqno
	r RootMetadataNode
}

func (i *InMemoryStorageEngine) NewTransaction(c context.Context) (Transaction, error) {
	return nil, nil
}

func (i *InMemoryStorageEngine) CommitTransaction(c context.Context, t Transaction) error {
	return nil
}

func (i *InMemoryStorageEngine) AbortTransaction(c context.Context, t Transaction) {
	return
}

func (i *InMemoryStorageEngine) StoreKVPairs(c context.Context, t Transaction, s Seqno, kvps []KeyValuePair, hs []Hash) error {
	newKVPR := make([]KVPRecord, len(i.KVPRecords)+len(kvps))
	for i, kvp := range kvps {
		newKVPR[i].s = s
		newKVPR[i].kvp = kvp
		newKVPR[i].h = hs[i]
	}
	copy(newKVPR[len(kvps):], i.KVPRecords)
	i.KVPRecords = newKVPR
	return nil
}

func (i *InMemoryStorageEngine) StoreNode(c context.Context, t Transaction, s Seqno, p Position, h Hash) error {
	i.NodeRecords = append([]NodeRecord{NodeRecord{s: s, p: p, h: h}}, i.NodeRecords...)
	return nil
}

func (i *InMemoryStorageEngine) StoreRootMetadataNode(c context.Context, t Transaction, r RootMetadataNode) error {
	i.RootMRecords = append([]RootMetadataRecord{RootMetadataRecord{s: r.Seqno, r: r}}, i.RootMRecords...)
	return nil
}

func (i *InMemoryStorageEngine) LookupLatestRoot(c context.Context, t Transaction) (Seqno, RootMetadataNode, error) {
	if len(i.RootMRecords) == 0 {
		return 0, RootMetadataNode{}, nil
	}
	return i.RootMRecords[0].s, i.RootMRecords[0].r, nil
}

func (i *InMemoryStorageEngine) LookupRoot(c context.Context, t Transaction, s Seqno) (RootMetadataNode, error) {
	for _, r := range i.RootMRecords {
		if r.s == s {
			return r.r, nil
		}
	}
	return RootMetadataNode{}, NewInvalidSeqnoError(fmt.Sprintf("No root at seqno %v", s))
}

func (i *InMemoryStorageEngine) LookupNode(c context.Context, t Transaction, s Seqno, p Position) (Hash, error) {
	for _, r := range i.NodeRecords {
		if r.s <= s && r.p.equals(&p) {
			return r.h, nil
		}
	}
	return nil, errors.New("No node found")
}

func (i *InMemoryStorageEngine) LookupNodes(c context.Context, t Transaction, s Seqno, positions []Position) (res []PositionHashPair, err error) {
	for _, p := range positions {
		h, err := i.LookupNode(c, t, s, p)
		if err == nil {
			res = append(res, PositionHashPair{p: p, h: h})
		}
	}
	return res, nil
}

func (i *InMemoryStorageEngine) LookupKVPair(c context.Context, t Transaction, s Seqno, k Key) (KeyValuePair, Hash, error) {
	for _, r := range i.KVPRecords {
		if r.s <= s && r.kvp.Key.Equal(k) {
			return r.kvp, r.h, nil
		}
	}
	return KeyValuePair{}, nil, NewKeyNotFoundError()
}

func (i *InMemoryStorageEngine) LookupKeyHashPairsUnderPosition(ctx context.Context, t Transaction, s Seqno, p Position) (keyHashPairs []KeyHashPair, err error) {
	m := make(map[string]KVPRecord)
	for _, r := range i.KVPRecords {
		if r.s <= s && p.isOnPathToKey(r.kvp.Key) {
			if rec, containsKey := m[string(r.kvp.Key)]; !containsKey && rec.s <= s {
				m[string(r.kvp.Key)] = r
			}
		}
	}
	keyHashPairs = make([]KeyHashPair, len(m))
	j := 0
	for _, v := range m {
		keyHashPairs[j] = KeyHashPair{Key: v.kvp.Key, Hash: v.h}
		j++
	}
	return keyHashPairs, nil
}
