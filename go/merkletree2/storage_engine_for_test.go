package merkletree2

import (
	"errors"
	"fmt"
	"math/bits"
	"sort"

	"golang.org/x/net/context"
)

// In memory StorageEngine implementation, used for tests. It ignores
// Transaction arguments, so it can't be used for concurrency tests.
type InMemoryStorageEngine struct {
	Roots            map[Seqno]RootMetadata
	sortedKVPRs      []*KVPRecord
	Nodes            map[string]*NodeRecord
	MasterSecretsMap map[Seqno]MasterSecret

	// used to make prefix queries efficient. Not otherwise necessary
	//PositionToKeys map[string](map[string]bool)
	cfg Config
}

var _ StorageEngine = &InMemoryStorageEngine{}
var _ StorageEngineWithBlinding = &InMemoryStorageEngine{}

type SortedKVPR []*KVPRecord

func (s SortedKVPR) Len() int {
	return len(s)
}

func (s SortedKVPR) Less(i, j int) bool {
	return s[i].kvp.Key.Cmp(s[j].kvp.Key) < 0
}

func (s SortedKVPR) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

var _ sort.Interface = SortedKVPR{}

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

func NewInMemoryStorageEngine(cfg Config) *InMemoryStorageEngine {
	i := InMemoryStorageEngine{}
	i.MasterSecretsMap = make(map[Seqno]MasterSecret)
	i.Roots = make(map[Seqno]RootMetadata)
	//i.KVPs = make(map[string]*KVPRecord)
	i.Nodes = make(map[string]*NodeRecord)
	//	i.PositionToKeys = make(map[string](map[string]bool))
	i.cfg = cfg
	return &i
}

func (i *InMemoryStorageEngine) NewTransaction(c context.Context) (Transaction, error) {
	return nil, nil
}

func (i *InMemoryStorageEngine) CommitTransaction(c context.Context, t Transaction) error {
	return nil
}

func (i *InMemoryStorageEngine) AbortTransaction(c context.Context, t Transaction) {}

func (i *InMemoryStorageEngine) findKVPR(k Key) *KVPRecord {
	j := sort.Search(len(i.sortedKVPRs), func(n int) bool {
		return i.sortedKVPRs[n].kvp.Key.Cmp(k) >= 0
	})
	if j < len(i.sortedKVPRs) && i.sortedKVPRs[j].kvp.Key.Cmp(k) == 0 {
		return i.sortedKVPRs[j]
	}
	return nil
}

func (i *InMemoryStorageEngine) StoreKVPairs(c context.Context, t Transaction, s Seqno, kvps []KeyValuePair) error {
	newSKVPR := make([]*KVPRecord, len(kvps))

	for j, kvp := range kvps {
		oldKvp := i.findKVPR(kvp.Key)
		newSKVPR[j] = &KVPRecord{kvp: kvp, s: s, next: oldKvp}
		if oldKvp != nil && oldKvp.s >= s {
			return errors.New("Engine does not support out of order insertions")
		}
	}

	sort.Sort(SortedKVPR(newSKVPR))
	i.sortedKVPRs = newSKVPR
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
	kvpr := i.findKVPR(k)
	if kvpr == nil {
		return KeyValuePair{}, 0, NewKeyNotFoundError()
	}
	for ; kvpr != nil; kvpr = kvpr.next {
		if kvpr.s <= s {
			return kvpr.kvp, kvpr.s, nil
		}
	}
	return KeyValuePair{}, 0, NewKeyNotFoundError()
}

func (i *InMemoryStorageEngine) LookupKeyValuePairsUnderPosition(ctx context.Context, t Transaction, s Seqno, p Position) (kvps []KeyValuePair, seqnos []Seqno, err error) {
	pBytes := p.getBytes()

	minIndex := sort.Search(len(i.sortedKVPRs), func(n int) bool {
		k := i.sortedKVPRs[n].kvp.Key
		pLeadingZeros := bits.LeadingZeros8(pBytes[0])
		for j := 1; j < 8*len(pBytes)-pLeadingZeros; j++ {
			jthBitP := (pBytes[(pLeadingZeros+j)/8] & byte(1<<uint(7-((pLeadingZeros+j)%8)))) != 0
			jthBitK := (k[(j-1)/8] & byte(1<<uint(7-((j-1)%8)))) != 0
			if !jthBitK && jthBitP {
				return false
			} else if jthBitK == jthBitP {
				continue
			} else if jthBitK && !jthBitP {
				return true
			}
		}
		return true
	})

	maxIndex := sort.Search(len(i.sortedKVPRs), func(n int) bool {
		k := i.sortedKVPRs[n].kvp.Key
		pLeadingZeros := bits.LeadingZeros8(pBytes[0])
		for j := 1; j < 8*len(pBytes)-pLeadingZeros; j++ {
			jthBitP := (pBytes[(pLeadingZeros+j)/8] & byte(1<<uint(7-((pLeadingZeros+j)%8)))) != 0
			jthBitK := (k[(j-1)/8] & byte(1<<uint(7-((j-1)%8)))) != 0
			if !jthBitK && jthBitP {
				return false
			} else if jthBitK == jthBitP {
				continue
			} else if jthBitK && !jthBitP {
				return true
			}
		}
		return false
	})

	kvps = make([]KeyValuePair, 0, maxIndex-minIndex)
	seqnos = make([]Seqno, 0, maxIndex-minIndex)
	for j := minIndex; j < maxIndex; j++ {
		kvpr := i.sortedKVPRs[j]
		for ; kvpr != nil; kvpr = kvpr.next {
			if kvpr.s <= s {
				kvps = append(kvps, kvpr.kvp)
				seqnos = append(seqnos, kvpr.s)
				break
			}
		}
	}
	return kvps, seqnos, nil
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
