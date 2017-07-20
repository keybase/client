// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// ECMRCtxTagKey is the type for unique ECMR background operation IDs.
type ECMRCtxTagKey struct{}

// ECMRID is used in EventuallyConsistentMerkleRoot for only
// background RPCs.  More specifically, when we need to spawn a
// background goroutine for GetCurrentMerkleRoot, a new context with
// this tag is created and used. This is also used as a prefix for the
// logger module name in EventuallyConsistentMerkleRoot.
const ECMRID = "ECMR"

type cachedMerkleRoot struct {
	timestamp time.Time
	root      keybase1.MerkleRootV2
}

// EventuallyConsistentMerkleRoot keeps tracks of the current global
// Merkle root, in a way user of which can choose to accept stale data
// to reduce calls to the API server.
type EventuallyConsistentMerkleRoot struct {
	config  Config
	log     logger.Logger
	getter  merkleRootGetter
	fetcher *fetchDecider

	mu     sync.RWMutex
	cached cachedMerkleRoot
}

// NewEventuallyConsistentMerkleRoot creates a new
// EventuallyConsistentMerkleRoot object.
func NewEventuallyConsistentMerkleRoot(
	config Config, getter merkleRootGetter) *EventuallyConsistentMerkleRoot {
	ecmr := &EventuallyConsistentMerkleRoot{
		config: config,
		log:    config.MakeLogger(ECMRID),
		getter: getter,
	}
	getAndCache := func(ctx context.Context) error {
		// The error is igonred here without logging since getAndCache already
		// logs it.
		_, err := ecmr.getAndCache(ctx)
		return err
	}
	ecmr.fetcher = newFetchDecider(
		ecmr.log, getAndCache, ECMRCtxTagKey{}, ECMRID, ecmr.config)
	return ecmr
}

func (ecmr *EventuallyConsistentMerkleRoot) getAndCache(
	ctx context.Context) (root cachedMerkleRoot, err error) {
	defer func() {
		ecmr.log.CDebugf(ctx, "getAndCache: error=%v", err)
	}()
	// Go through the
	bareRoot, err := ecmr.getter.GetCurrentMerkleRoot(ctx)
	if err != nil {
		return cachedMerkleRoot{}, err
	}

	root.root = bareRoot
	root.timestamp = ecmr.config.Clock().Now()
	ecmr.mu.Lock()
	defer ecmr.mu.Unlock()
	ecmr.cached = root

	return root, nil
}

func (ecmr *EventuallyConsistentMerkleRoot) getCached() cachedMerkleRoot {
	ecmr.mu.RLock()
	defer ecmr.mu.RUnlock()
	return ecmr.cached
}

// Get returns the current merkle root. To help avoid having too
// frequent calls into the API server, caller can provide a positive
// tolerance, to accept stale LimitBytes and UsageBytes data. If
// tolerance is 0 or negative, this always makes a blocking RPC to
// bserver and return latest quota usage.
//
// 1) If the age of cached data is more than blockTolerance, a blocking RPC is
// issued and the function only returns after RPC finishes, with the newest
// data from RPC. The RPC causes cached data to be refreshed as well.
// 2) Otherwise, if the age of cached data is more than bgTolerance,
// a background RPC is spawned to refresh cached data, and the stale
// data is returned immediately.
// 3) Otherwise, the cached stale data is returned immediately.
func (ecmr *EventuallyConsistentMerkleRoot) Get(
	ctx context.Context, bgTolerance, blockTolerance time.Duration) (
	timestamp time.Time, root keybase1.MerkleRootV2, err error) {
	c := ecmr.getCached()
	err = ecmr.fetcher.Do(ctx, bgTolerance, blockTolerance, c.timestamp)
	if err != nil {
		return time.Time{}, keybase1.MerkleRootV2{}, err
	}
	c = ecmr.getCached()
	return c.timestamp, c.root, nil
}
