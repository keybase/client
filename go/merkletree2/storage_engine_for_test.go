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
	RootMRecords     []RootMetadataRecord
	KVPRecords       []KVPRecord
	NodeRecords      []NodeRecord
	MasterSecretsMap map[Seqno]MasterSecret
}

var _ StorageEngine = &InMemoryStorageEngine{}
var _ StorageEngineWithBlinding = &InMemoryStorageEngine{}

type NodeRecord struct {
	s Seqno
	p Position
	h Hash
}

type KVPRecord struct {
	s   Seqno
	kvp KeyValuePair
}

type RootMetadataRecord struct {
	s Seqno
	r RootMetadata
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

func (i *InMemoryStorageEngine) StoreKVPairs(c context.Context, t Transaction, s Seqno, kvps []KeyValuePair) error {
	newKVPR := make([]KVPRecord, len(i.KVPRecords)+len(kvps))
	for i, kvp := range kvps {
		newKVPR[i].s = s
		newKVPR[i].kvp = kvp
	}
	copy(newKVPR[len(kvps):], i.KVPRecords)
	i.KVPRecords = newKVPR
	return nil
}

func (i *InMemoryStorageEngine) StoreNode(c context.Context, t Transaction, s Seqno, p Position, h Hash) error {
	i.NodeRecords = append([]NodeRecord{NodeRecord{s: s, p: p, h: h}}, i.NodeRecords...)
	return nil
}

func (i *InMemoryStorageEngine) StoreRootMetadata(c context.Context, t Transaction, r RootMetadata) error {
	i.RootMRecords = append([]RootMetadataRecord{RootMetadataRecord{s: r.Seqno, r: r}}, i.RootMRecords...)
	return nil
}

func (i *InMemoryStorageEngine) LookupLatestRoot(c context.Context, t Transaction) (Seqno, RootMetadata, error) {
	if len(i.RootMRecords) == 0 {
		return 0, RootMetadata{}, nil
	}
	return i.RootMRecords[0].s, i.RootMRecords[0].r, nil
}

func (i *InMemoryStorageEngine) LookupRoot(c context.Context, t Transaction, s Seqno) (RootMetadata, error) {
	for _, r := range i.RootMRecords {
		if r.s == s {
			return r.r, nil
		}
	}
	return RootMetadata{}, NewInvalidSeqnoError(s, fmt.Errorf("No root at seqno %v", s))
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

func (i *InMemoryStorageEngine) LookupKVPair(c context.Context, t Transaction, s Seqno, k Key) (KeyValuePair, Seqno, error) {
	for _, r := range i.KVPRecords {
		if r.s <= s && r.kvp.Key.Equal(k) {
			return r.kvp, r.s, nil
		}
	}
	return KeyValuePair{}, 0, NewKeyNotFoundError()
}

func (i *InMemoryStorageEngine) LookupKeyValuePairsUnderPosition(ctx context.Context, t Transaction, s Seqno, p Position) (kvp []KeyValuePair, seqnos []Seqno, err error) {
	m := make(map[string]KVPRecord)
	for _, r := range i.KVPRecords {
		if r.s <= s && p.isOnPathToKey(r.kvp.Key) {
			if rec, containsKey := m[string(r.kvp.Key)]; !containsKey && rec.s <= s {
				m[string(r.kvp.Key)] = r
			}
		}
	}
	kvp = make([]KeyValuePair, len(m))
	seqnos = make([]Seqno, len(m))
	j := 0
	for _, v := range m {
		kvp[j] = v.kvp
		seqnos[j] = v.s
		j++
	}
	return kvp, seqnos, nil
}

func (i *InMemoryStorageEngine) StoreMasterSecret(ctx context.Context, t Transaction, s Seqno, ms MasterSecret) (err error) {
	if i.MasterSecretsMap == nil {
		i.MasterSecretsMap = make(map[Seqno]MasterSecret)
	}
	i.MasterSecretsMap[s] = MasterSecret(append([]byte{}, []byte(ms)...))
	return nil
}

func (i *InMemoryStorageEngine) LookupMasterSecrets(ctx context.Context, t Transaction, seqnos []Seqno) (msMap map[Seqno]MasterSecret, err error) {
	if i.MasterSecretsMap == nil {
		i.MasterSecretsMap = make(map[Seqno]MasterSecret)
	}
	msMap = make(map[Seqno]MasterSecret)
	for _, s := range seqnos {
		ms, found := i.MasterSecretsMap[s]
		if found {
			msMap[s] = ms
		} else {
			return nil, fmt.Errorf("MasterSecret for Seqno %v not found", s)
		}
	}
	return msMap, nil
}
