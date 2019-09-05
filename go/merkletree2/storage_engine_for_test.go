package merkletree2

import (
	"errors"
	"fmt"
	"sort"

	"golang.org/x/net/context"
)

// In memory StorageEngine implementation, used for tests. It ignores
// Transaction arguments, so it can't be used for concurrency tests.
type InMemoryStorageEngine struct {
	Roots            map[Seqno]RootMetadata
	KVPs             map[string]*KVPRecord
	Nodes            map[string]*NodeRecord
	MasterSecretsMap map[Seqno]MasterSecret
}

var _ StorageEngine = &InMemoryStorageEngine{}
var _ StorageEngineWithBlinding = &InMemoryStorageEngine{}

type NodeRecord struct {
	p    Position
	s    Seqno
	h    Hash
	next *NodeRecord
}

type KVPRecord struct {
	kvp  KeyValuePair
	s    Seqno
	next *KVPRecord
}

func NewInMemoryStorageEngine() *InMemoryStorageEngine {
	i := InMemoryStorageEngine{}
	i.MasterSecretsMap = make(map[Seqno]MasterSecret)
	i.Roots = make(map[Seqno]RootMetadata)
	i.KVPs = make(map[string]*KVPRecord)
	i.Nodes = make(map[string]*NodeRecord)
	return &i
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
	for _, kvp := range kvps {
		oldKvp := i.KVPs[string(kvp.Key)]
		i.KVPs[string(kvp.Key)] = &KVPRecord{kvp: kvp, s: s, next: oldKvp}
		if oldKvp != nil && oldKvp.s >= s {
			return errors.New("Engine does not support out of order insertions")
		}
	}
	return nil
}

func (i *InMemoryStorageEngine) StoreNode(c context.Context, t Transaction, s Seqno, p Position, h Hash) error {
	strKey := string(p.getBytes())
	oldNodeRec := i.Nodes[strKey]
	i.Nodes[strKey] = &NodeRecord{s: s, p: p, h: h, next: oldNodeRec}
	if oldNodeRec != nil && oldNodeRec.s >= s {
		return errors.New("Engine does not support out of order insertions")
	}
	return nil
}

func (i *InMemoryStorageEngine) StoreRootMetadata(c context.Context, t Transaction, r RootMetadata) error {
	i.Roots[r.Seqno] = r
	return nil
}

func (i *InMemoryStorageEngine) LookupLatestRoot(c context.Context, t Transaction) (Seqno, RootMetadata, error) {
	if len(i.Roots) == 0 {
		return 0, RootMetadata{}, NewNoLatestRootFoundError()
	}
	max := Seqno(0)
	for k := range i.Roots {
		if k > max {
			max = k
		}
	}
	return max, i.Roots[max], nil
}

func (i *InMemoryStorageEngine) LookupRoot(c context.Context, t Transaction, s Seqno) (RootMetadata, error) {
	r, found := i.Roots[s]
	if found {
		return r, nil
	}
	return RootMetadata{}, NewInvalidSeqnoError(s, fmt.Errorf("No root at seqno %v", s))
}

func (i *InMemoryStorageEngine) LookupNode(c context.Context, t Transaction, s Seqno, p Position) (Hash, error) {
	node, found := i.Nodes[string(p.getBytes())]
	if !found {
		return nil, errors.New("No node found")
	}
	for ; node != nil; node = node.next {
		if node.s <= s {
			return node.h, nil
		}
	}
	return nil, errors.New("No node version found")
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
	kvpr, found := i.KVPs[string(k)]
	if !found {
		return KeyValuePair{}, 0, NewKeyNotFoundError()
	}
	for ; kvpr != nil; kvpr = kvpr.next {
		if kvpr.s <= s {
			return kvpr.kvp, kvpr.s, nil
		}
	}
	return KeyValuePair{}, 0, NewKeyNotFoundError()
}

type KVPRecordOrderedByKey []KVPRecord

func (k KVPRecordOrderedByKey) Len() int {
	return len(k)
}

func (k KVPRecordOrderedByKey) Less(i, j int) bool {
	return k[i].kvp.Key.Cmp(k[j].kvp.Key) < 0
}

func (k KVPRecordOrderedByKey) Swap(i, j int) {
	k[i], k[j] = k[j], k[i]
}

var _ sort.Interface = KVPRecordOrderedByKey{}

func (i *InMemoryStorageEngine) LookupKeyValuePairsUnderPosition(ctx context.Context, t Transaction, s Seqno, p Position) (kvp []KeyValuePair, seqnos []Seqno, err error) {
	var kvprl []KVPRecord
	for _, kvpr := range i.KVPs {
		if p.isOnPathToKey(kvpr.kvp.Key) {
			for ; kvpr != nil; kvpr = kvpr.next {
				if kvpr.s <= s {
					kvprl = append(kvprl, *kvpr)
					break
				}
			}
		}
	}

	sort.Sort(KVPRecordOrderedByKey(kvprl))

	kvp = make([]KeyValuePair, len(kvprl))
	seqnos = make([]Seqno, len(kvprl))
	for i, v := range kvprl {
		kvp[i] = v.kvp
		seqnos[i] = v.s
	}

	return kvp, seqnos, nil
}

func (i *InMemoryStorageEngine) StoreMasterSecret(ctx context.Context, t Transaction, s Seqno, ms MasterSecret) (err error) {
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
