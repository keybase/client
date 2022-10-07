package merkletree2

import (
	"fmt"
	"math"
)

// The SkipPointers struct is constructed for a specific Seqno s (version) of
// the tree and contains the hashes of RootMetadata structs at specific previous
// Seqnos (versions) of the tree. Such versions are fixed given s according to
// the algorithm in GenerateSkipPointersSeqnos so that a "chain" of SkipPointers
// can "connect" any two roots in a logarithmic number of steps.
type SkipPointers []Hash

func SkipPointersForSeqno(s Seqno) (pointers []Seqno) {
	if s == 1 {
		return []Seqno{}
	}
	n := int(math.Log2(float64(s - 1)))
	x := Seqno(0)
	for i := n; i >= 0; i-- {
		if x+(1<<uint(i)) < s {
			x += 1 << uint(i)
			pointers = append(pointers, x)
		}
	}
	return pointers
}

// SkipPointersPath takes two seqno 0 < start <= end. It returns a slice of
// Seqno `pointers` such that:
//   - start \in SkipPointersForSeqno(pointers[0]),
//   - pointers[len(pointers)] == end,
//   - pointers[i-1] \in SkipPointersForSeqno(pointers[i])
//     for i = 1...len(pointers)-1.
//
// If start == end, returns [end]. The sequence has length
// at most logarithmic in end - start.
func SkipPointersPath(start, end Seqno) (pointers []Seqno, err error) {
	if start > end {
		return nil, fmt.Errorf("GenerateSkipPointersSequence: start > end: %v > %v", start, end)
	}

	current := end
	pointers = append(pointers, current)

	for current > start {
		for _, i := range SkipPointersForSeqno(current) {
			if start <= i {
				current = i
				if start != i {
					pointers = append([]Seqno{i}, pointers...)
				}
				break
			}
		}
	}
	return pointers, nil
}

func ComputeRootMetadataSeqnosNeededInExtensionProof(start, end Seqno, isPartOfIncExtProof bool) ([]Seqno, error) {
	seqnos, err := SkipPointersPath(start, end)
	if err != nil {
		return nil, err
	}

	// small optimization since in an InclusionExtension proof the root of the
	// end seqno is already part of the Inclusion proof.
	if isPartOfIncExtProof {
		return seqnos[:len(seqnos)-1], nil
	}

	return seqnos, nil
}

func ComputeRootHashSeqnosNeededInExtensionProof(start, end Seqno) (ret []Seqno, err error) {
	// this map prevents duplicates, as well as inserting the hashes of
	// SkipPointersPath elements (as those can be recomputed from the rest).
	unnecessarySeqnoMap := make(map[Seqno]bool)
	unnecessarySeqnoMap[start] = true

	ret = []Seqno{}

	path, err := SkipPointersPath(start, end)
	if err != nil {
		return nil, err
	}
	for _, s := range path {
		unnecessarySeqnoMap[s] = true
		for _, s2 := range SkipPointersForSeqno(s) {
			if unnecessarySeqnoMap[s2] {
				continue
			}
			ret = append(ret, s2)
			unnecessarySeqnoMap[s2] = true
		}
	}

	return ret, nil
}
