package libkbfs

import (
	"time"

	"github.com/keybase/kbfs/kbfsblock"
)

// lruEntry is an entry for sorting LRU times
type lruEntry struct {
	BlockID kbfsblock.ID
	Time    time.Time
}

type blockIDsByTime []lruEntry

func (b blocksByTime) Len() int      { return len(b) }
func (b blocksByTime) Swap(i, j int) { b[i], b[j] = b[j], b[i] }
func (b blocksByTime) Less(i, j int) { return b[i].Time.Before(b[j].Time) }
