package merkle

import (
	"crypto/sha512"

	merkletree "github.com/keybase/go-merkle-tree"
)

func ComputeSkipPointers(s TreeSeqno) []TreeSeqno {
	if s <= 1 {
		return nil
	}
	var skips []TreeSeqno
	r := TreeSeqno(1)
	s -= r
	for s > 0 {
		skips = append(skips, s)
		s -= r
		r *= 2
	}
	return skips
}

// computeSkipPath computes a log pattern skip path in reverse
// e.g., start=100, end=2033 -> ret = {1009, 497, 241, 113, 105, 101}
// such that ret[i+1] \in computeSkipPointers(ret[i])
func ComputeSkipPath(start TreeSeqno, end TreeSeqno) []TreeSeqno {
	if end <= start {
		return []TreeSeqno{}
	}
	jumps := []TreeSeqno{}
	diff := end - start
	z := TreeSeqno(1)
	for diff > 0 {
		if diff&1 == 1 {
			start += z
			jumps = append(jumps, start)
		}
		diff >>= 1
		z *= 2
	}

	// array reversal
	for i := len(jumps)/2 - 1; i >= 0; i-- {
		opp := len(jumps) - 1 - i
		jumps[i], jumps[opp] = jumps[opp], jumps[i]
	}

	return jumps[1:] // ignore end
}

type SHA512_256Hasher struct{}

var _ merkletree.Hasher = (*SHA512_256Hasher)(nil)

func (h SHA512_256Hasher) Hash(x []byte) merkletree.Hash {
	y := sha512.Sum512_256(x)
	return merkletree.Hash(y[:])
}
