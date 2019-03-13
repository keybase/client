package data

import (
	"fmt"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"
	"reflect"
	"testing"
)

func makePaths(childIndices [][]int,
	mockBlock BlockWithPtrs) [][]ParentBlockAndChildIndex {
	result := [][]ParentBlockAndChildIndex(nil)
	for _, indexList := range childIndices {
		Path := []ParentBlockAndChildIndex(nil)
		for _, childIndex := range indexList {
			Path = append(Path, ParentBlockAndChildIndex{
				pblock:     mockBlock,
				childIndex: childIndex,
			})
		}
		result = append(result, Path)
	}
	return result
}

func TestCheckForHolesAndTruncate(t *testing.T) {
	// Make a mock block that believes itself to have four children.
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()
	mockBlock := NewMockBlockWithPtrs(mockCtrl)
	mockBlock.EXPECT().NumIndirectPtrs().Return(4).MinTimes(1)

	goodExamples := [][][]int{
		{{3, 2}, {3, 3}},
		{{2, 3}, {3, 0}},
		{{1, 0}, {1, 1}, {1, 2}, {1, 3}, {2, 0}, {2, 1}},
		{{1, 2, 3}, {1, 3, 0}, {1, 3, 1}, {1, 3, 2}, {1, 3, 3}, {2, 0, 0}},
	}
	for _, goodEx := range goodExamples {
		paths := makePaths(goodEx, mockBlock)
		newPaths := checkForHolesAndTruncate(paths)
		require.True(t, reflect.DeepEqual(paths, newPaths),
			fmt.Sprintf("Paths incorrectly truncated from %v to %v",
				paths, newPaths))
	}

	badExamples := [][][]int{
		{{3, 3}, {3, 2}},
		{{1, 3, 0}, {1, 3, 1}, {1, 3, 2}, {2, 0, 3}},
		{{1, 0}, {1, 1}, {1, 2}, {2, 0}, {2, 1}},
	}
	// correctLengths holds the length that each bad example should be truncated
	// to.
	correctLengths := []int{1, 3, 3}
	for idx, badEx := range badExamples {
		paths := makePaths(badEx, mockBlock)
		newPaths := checkForHolesAndTruncate(paths)
		require.Len(t, newPaths, correctLengths[idx])
	}
}
