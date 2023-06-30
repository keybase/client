package storage

import (
	"time"

	"github.com/keybase/client/go/protocol/gregor1"
)

const (
	minScoringMinutes = 1           // one minute
	maxScoringMinutes = 7 * 24 * 60 // one week
	frequencyWeight   = 2
	mtimeWeight       = 1
)

func ScoreByFrequencyAndMtime(freq int, mtime gregor1.Time) float64 {
	// if we are missing an mtime just backdate to a week ago
	if mtime == 0 {
		mtime = gregor1.ToTime(time.Now().Add(-time.Hour * 24 * 7))
	}
	minutes := time.Since(mtime.Time()).Minutes()
	var mtimeScore float64
	if minutes > maxScoringMinutes {
		mtimeScore = 0
	} else if minutes < minScoringMinutes {
		mtimeScore = 1
	} else {
		mtimeScore = 1 - minutes/(maxScoringMinutes-minScoringMinutes)
	}
	return float64(freq*frequencyWeight) + mtimeScore*mtimeWeight
}
