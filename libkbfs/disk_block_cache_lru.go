package libkbfs

import (
	"time"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
)

// lruEntry is an entry for sorting LRU times
type lruEntry struct {
	TlfID   tlf.ID
	BlockID kbfsblock.ID
	Time    time.Time
}

type blockIDsByTime []lruEntry

func (b blockIDsByTime) Len() int           { return len(b) }
func (b blockIDsByTime) Swap(i, j int)      { b[i], b[j] = b[j], b[i] }
func (b blockIDsByTime) Less(i, j int) bool { return b[i].Time.Before(b[j].Time) }

func (b blockIDsByTime) ToBlockIDSlice(numBlocks int) []diskBlockCacheDeleteKey {
	ids := make([]diskBlockCacheDeleteKey, 0, numBlocks)
	for _, entry := range b {
		if len(ids) == numBlocks {
			return ids
		}
		ids = append(ids, diskBlockCacheDeleteKey{entry.TlfID, entry.BlockID})
	}
	return ids
}
