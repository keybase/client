package merkleTree

import (
	"sort"
)

// SortedMap is a list of KeyValuePairs, kept in sorted order so
// that binary search can work.
type SortedMap struct {
	list []KeyValuePair
}

// NewSortedMap makes an empty sorted map.
func NewSortedMap() *SortedMap {
	return &SortedMap{}
}

// NewSortedMapFromSortedList just wraps the given sorted list and
// doesn't check that it's sorted.  So don't pass it an unsorted list.
func NewSortedMapFromSortedList(l []KeyValuePair) *SortedMap {
	return &SortedMap{list: l}
}

func newSortedMapFromNode(n *Node) *SortedMap {
	return NewSortedMapFromSortedList(n.Leafs)
}

// NewSortedMapFromList makes a sorted map from an unsorted list
// of KeyValuePairs
func NewSortedMapFromList(l []KeyValuePair) *SortedMap {
	ret := NewSortedMapFromSortedList(l)
	ret.sort()
	return ret
}

func newSortedMapFromKeyAndValue(kp KeyValuePair) *SortedMap {
	return NewSortedMapFromList([]KeyValuePair{kp})
}

type byKey []KeyValuePair

func (b byKey) Len() int           { return len(b) }
func (b byKey) Swap(i, j int)      { b[i], b[j] = b[j], b[i] }
func (b byKey) Less(i, j int) bool { return b[i].Key.Less(b[j].Key) }

func (s *SortedMap) sort() {
	sort.Sort(byKey(s.list))
}

func (s *SortedMap) push(kp KeyValuePair) {
	s.list = append(s.list, kp)
}

func (s *SortedMap) exportToNode(h Hasher, prevRoot Hash, level Level) (hash Hash, node Node, objExported []byte, err error) {
	node.Type = nodeTypeLeaf
	node.Leafs = s.list
	return node.export(h, prevRoot, level)
}

func (s *SortedMap) binarySearch(k Hash) (ret int, eq bool) {
	beg := 0
	end := len(s.list) - 1

	for beg < end {
		mid := (end + beg) >> 1
		if s.list[mid].Key.Less(k) {
			beg = mid + 1
		} else {
			end = mid
		}
	}

	ret = beg
	if c := k.cmp(s.list[beg].Key); c > 0 {
		ret = beg + 1
	} else if c == 0 {
		eq = true
	}
	return ret, eq
}

func (s *SortedMap) find(k Hash) *KeyValuePair {
	i, eq := s.binarySearch(k)
	if !eq {
		return nil
	}
	ret := s.at(ChildIndex(i))
	return &ret
}

func (s *SortedMap) replace(kvp KeyValuePair) *SortedMap {
	if len(s.list) > 0 {
		i, eq := s.binarySearch(kvp.Key)
		j := i
		if eq {
			j++
		}

		// Grow the list by one
		out := append(s.list, KeyValuePair{})
		// shift everything over by 1
		copy(out[(j+1):], out[j:])
		// Move the new element into the empty space
		out[j] = kvp
		// Put the new list into place
		s.list = out

	} else {
		s.list = []KeyValuePair{kvp}
	}
	return s
}

// Len returns the number of items in the Map.
func (s *SortedMap) Len() ChildIndex {
	return ChildIndex(len(s.list))
}

func (s *SortedMap) at(i ChildIndex) KeyValuePair {
	return s.list[i]
}

func (s *SortedMap) slice(begin, end ChildIndex) *SortedMap {
	return NewSortedMapFromList(s.list[begin:end])
}
