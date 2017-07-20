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
	config Config
	log    logger.Logger

	backgroundInProcess int32

	mu     sync.RWMutex
	cached cachedMerkleRoot
}

// NewEventuallyConsistentMerkleRoot creates a new
// EventuallyConsistentMerkleRoot object.
func NewEventuallyConsistentMerkleRoot(
	config Config, loggerSuffix string) *EventuallyConsistentMerkleRoot {
	return &EventuallyConsistentMerkleRoot{
		config: config,
		log:    config.MakeLogger(ECMRID + "-" + loggerSuffix),
	}
}

func (q *EventuallyConsistentMerkleRoot) getAndCache(
	ctx context.Context) (root cachedMerkleRoot, err error) {
	defer func() {
		q.log.CDebugf(ctx, "getAndCache: error=%v", err)
	}()
	bareRoot, err := q.config.KBPKI().GetCurrentMerkleRoot(ctx)
	if err != nil {
		return cachedMerkleRoot{}, err
	}

	root.root = bareRoot
	root.timestamp = q.config.Clock().Now()
	q.mu.Lock()
	defer q.mu.Unlock()
	q.cached = root

	return root, nil
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
func (q *EventuallyConsistentMerkleRoot) Get(
	ctx context.Context, bgTolerance, blockTolerance time.Duration) (
	timestamp time.Time, root keybase1.MerkleRootV2, err error) {
	c := func() cachedMerkleRoot {
		q.mu.RLock()
		defer q.mu.RUnlock()
		return q.cached
	}()
	getAndCache := func(ctx context.Context) {
		// The error is igonred here without logging since getAndCache already
		// logs it.
		_, _ = q.getAndCache(ctx)
	}
	decision, err := fetchAndCacheDecider(
		ctx, bgTolerance, blockTolerance, c.timestamp, getAndCache,
		&q.backgroundInProcess, q.log, ECMRCtxTagKey{}, ECMRID,
		q.config.Clock())
	if err != nil {
		return time.Time{}, keybase1.MerkleRootV2{}, err
	}

	if decision == fetchAndCache {
		c, err = q.getAndCache(ctx)
		if err != nil {
			return time.Time{}, keybase1.MerkleRootV2{}, err
		}
	}
	return c.timestamp, c.root, nil
}
