package merkletree2

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSkipPointersForSeqno(t *testing.T) {

	tests := []struct {
		s        Seqno
		pointers []Seqno
	}{
		{1, []Seqno{}},
		{2, []Seqno{1}},
		{3, []Seqno{2}},
		{4, []Seqno{2, 3}},
		{5, []Seqno{4}},
		{10, []Seqno{8, 9}},
		{26, []Seqno{16, 24, 25}},
		{30, []Seqno{16, 24, 28, 29}},
		{2048, []Seqno{1024, 1536, 1792, 1920, 1984, 2016, 2032, 2040, 2044, 2046, 2047}},
		{2049, []Seqno{2048}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("skips for %v", test.s), func(t *testing.T) {
			skips := SkipPointersForSeqno(test.s)
			require.EqualValues(t, test.pointers, skips)
		})
	}

}

func TestSkipPointersPath(t *testing.T) {

	tests := []struct {
		s        Seqno
		e        Seqno
		pointers []Seqno
	}{
		{1, 1, []Seqno{1}},
		{1, 2, []Seqno{2}},
		{1, 3, []Seqno{2, 3}},
		{1, 4, []Seqno{2, 4}},
		{1, 5, []Seqno{2, 4, 5}},
		{1, 10, []Seqno{2, 4, 8, 10}},
		{1, 26, []Seqno{2, 4, 8, 16, 26}},
		{1, 30, []Seqno{2, 4, 8, 16, 30}},
		{1, 2048, []Seqno{2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048}},
		{5, 8, []Seqno{6, 8}},
		{31, 65, []Seqno{32, 64, 65}},
		{1023, 2049, []Seqno{1024, 2048, 2049}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("skips for %v->%v", test.s, test.e), func(t *testing.T) {
			skips, err := SkipPointersPath(test.s, test.e)
			require.NoError(t, err)
			require.EqualValues(t, test.pointers, skips)
		})
	}

	_, err := SkipPointersPath(3, 2)
	require.Error(t, err)
	require.Contains(t, err.Error(), "start > end")
}

func TestComputeRootHashesNeededInExtensionProof(t *testing.T) {

	tests := []struct {
		s        Seqno
		e        Seqno
		pointers []Seqno
	}{
		{1, 1, []Seqno{}},
		{1, 2, []Seqno{}},
		{1, 3, []Seqno{}},
		{1, 4, []Seqno{3}},
		{1, 5, []Seqno{3}},
		{1, 10, []Seqno{3, 6, 7, 9}},
		{2, 15, []Seqno{3, 6, 7, 12, 14}},
		{11, 30, []Seqno{8, 10, 14, 15, 24, 28, 29}},
		{1, 128, []Seqno{3, 6, 7, 12, 14, 15, 24, 28, 30, 31, 48, 56, 60, 62, 63, 96, 112, 120, 124, 126, 127}},
		{63, 128, []Seqno{32, 48, 56, 60, 62, 96, 112, 120, 124, 126, 127}},
		{64, 128, []Seqno{96, 112, 120, 124, 126, 127}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("skips for %v->%v", test.s, test.e), func(t *testing.T) {
			skips, err := ComputeRootHashSeqnosNeededInExtensionProof(test.s, test.e)
			require.NoError(t, err)
			require.EqualValues(t, test.pointers, skips)
		})
	}

	_, err := ComputeRootHashSeqnosNeededInExtensionProof(3, 2)
	require.Error(t, err)
	require.Contains(t, err.Error(), "start > end")
}
