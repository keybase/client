// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

type indexType int

const (
	indexNone indexType = iota
	indexFull
	indexIncremental
)

// Progress represents the current state of the indexer, and how far
// along the indexing is.
type Progress struct {
	clock libkbfs.Clock

	lock             sync.RWMutex
	tlfSizesToIndex  map[tlf.ID]uint64
	currTlf          tlf.ID
	currTotalToIndex uint64
	currHasIndexed   uint64
	currIndexType    indexType
	currStartTime    time.Time
	lastIndexRate    float64 // (bytes/second)
}

// NewProgress creates a new Progress instance.
func NewProgress(clock libkbfs.Clock) *Progress {
	return &Progress{
		clock:           clock,
		tlfSizesToIndex: make(map[tlf.ID]uint64),
	}
}

func (p *Progress) tlfQueue(id tlf.ID, sizeEstimate uint64) {
	p.lock.Lock()
	defer p.lock.Unlock()

	// Overwrite whatever was already there.
	p.tlfSizesToIndex[id] = sizeEstimate
}

func (p *Progress) tlfUnqueue(id tlf.ID) {
	p.lock.Lock()
	defer p.lock.Unlock()

	delete(p.tlfSizesToIndex, id)
}

func (p *Progress) startIndex(
	id tlf.ID, sizeEstimate uint64, t indexType) error {
	p.lock.Lock()
	defer p.lock.Unlock()

	if p.currTlf != tlf.NullID {
		return errors.Errorf("Cannot index %s before finishing index of %s",
			id, p.currTlf)
	}

	p.currTlf = id
	delete(p.tlfSizesToIndex, id)
	p.currTotalToIndex = sizeEstimate
	p.currHasIndexed = 0
	p.currIndexType = t
	p.currStartTime = p.clock.Now()
	return nil
}

func (p *Progress) indexedBytes(size uint64) {
	p.lock.Lock()
	defer p.lock.Unlock()

	p.currHasIndexed += size
	if p.currHasIndexed > p.currTotalToIndex {
		// The provided size estimate was wrong.  But we don't know by
		// how much.  So just add the newly-indexed bytes onto it, ot
		// make sure we're still under the limit.
		p.currTotalToIndex += size
	}
}

func (p *Progress) finishIndex(id tlf.ID) error {
	p.lock.Lock()
	defer p.lock.Unlock()

	if id != p.currTlf {
		return errors.Errorf(
			"Cannot finish index for %s, because %s is the current TLF",
			id, p.currTlf)
	}

	// Estimate how long these bytes took to index.
	timeSecs := p.clock.Now().Sub(p.currStartTime).Seconds()
	if timeSecs > 0 {
		p.lastIndexRate = float64(p.currHasIndexed) / timeSecs
	} else {
		p.lastIndexRate = 0
	}

	p.currTlf = tlf.NullID
	p.currTotalToIndex = 0
	p.currHasIndexed = 0
	p.currIndexType = indexNone
	p.currStartTime = time.Time{}
	return nil
}

func (p *Progress) fillInProgressRecord(
	total, soFar uint64, rate float64, rec *keybase1.IndexProgressRecord) {
	if rate > 0 {
		bytesLeft := total - soFar
		timeLeft := time.Duration(
			(float64(bytesLeft) / rate) * float64(time.Second))
		rec.EndEstimate = keybase1.ToTime(p.clock.Now().Add(timeLeft))
	}
	rec.BytesSoFar = int64(soFar)
	rec.BytesTotal = int64(total)
}

// GetStatus returns the current progress status.
func (p *Progress) GetStatus() (
	currProgress, overallProgress keybase1.IndexProgressRecord,
	currTlf tlf.ID, queuedTlfs []tlf.ID) {
	p.lock.RLock()
	defer p.lock.RUnlock()

	// At what rate is the current indexer running?
	rate := p.lastIndexRate
	if !p.currStartTime.IsZero() && p.currHasIndexed != 0 {
		timeSecs := p.clock.Now().Sub(p.currStartTime).Seconds()
		rate = float64(p.currHasIndexed) / timeSecs
	}

	if p.currTlf != tlf.NullID {
		p.fillInProgressRecord(
			p.currTotalToIndex, p.currHasIndexed, rate, &currProgress)
	}

	queuedTlfs = make([]tlf.ID, 0, len(p.tlfSizesToIndex))
	var totalSize, soFar uint64
	if p.currTlf != tlf.NullID {
		totalSize += p.currTotalToIndex
		soFar += p.currHasIndexed
	}
	for id, size := range p.tlfSizesToIndex {
		if id == p.currTlf {
			continue
		}
		totalSize += size
		queuedTlfs = append(queuedTlfs, id)
	}
	if totalSize != 0 {
		p.fillInProgressRecord(
			totalSize, soFar, rate, &overallProgress)
	}

	return currProgress, overallProgress, p.currTlf, queuedTlfs
}
