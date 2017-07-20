// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"golang.org/x/net/context"
)

// ECQUCtxTagKey is the type for unique ECQU background operation IDs.
type ECQUCtxTagKey struct{}

// ECQUID is used in EventuallyConsistentQuotaUsage for only background RPCs.
// More specifically, when we need to spawn a background goroutine for
// GetUserQuotaInfo, a new context with this tag is created and used. This is
// also used as a prefix for the logger module name in
// EventuallyConsistentQuotaUsage.
const ECQUID = "ECQU"

type cachedQuotaUsage struct {
	timestamp  time.Time
	usageBytes int64
	limitBytes int64
}

// EventuallyConsistentQuotaUsage keeps tracks of quota usage, in a way user of
// which can choose to accept stale data to reduce calls into block servers.
type EventuallyConsistentQuotaUsage struct {
	config  Config
	log     logger.Logger
	tid     keybase1.TeamID
	fetcher *fetchDecider

	mu     sync.RWMutex
	cached cachedQuotaUsage
}

// NewEventuallyConsistentQuotaUsage creates a new
// EventuallyConsistentQuotaUsage object.
func NewEventuallyConsistentQuotaUsage(
	config Config, loggerSuffix string) *EventuallyConsistentQuotaUsage {
	q := &EventuallyConsistentQuotaUsage{
		config: config,
		log:    config.MakeLogger(ECQUID + "-" + loggerSuffix),
	}
	getAndCache := func(ctx context.Context) error {
		// The error is igonred here without logging since getAndCache already
		// logs it.
		_, err := q.getAndCache(ctx)
		return err
	}
	q.fetcher = newFetchDecider(
		q.log, getAndCache, ECQUCtxTagKey{}, ECQUID, q.config)
	return q
}

// NewEventuallyConsistentTeamQuotaUsage creates a new
// EventuallyConsistentQuotaUsage object.
func NewEventuallyConsistentTeamQuotaUsage(
	config Config, tid keybase1.TeamID,
	loggerSuffix string) *EventuallyConsistentQuotaUsage {
	q := NewEventuallyConsistentQuotaUsage(config, loggerSuffix)
	q.tid = tid
	return q
}

func (q *EventuallyConsistentQuotaUsage) getAndCache(
	ctx context.Context) (usage cachedQuotaUsage, err error) {
	defer func() {
		q.log.CDebugf(ctx, "getAndCache: error=%v", err)
	}()
	var quotaInfo *kbfsblock.QuotaInfo
	if q.tid.IsNil() {
		quotaInfo, err = q.config.BlockServer().GetUserQuotaInfo(ctx)
	} else {
		quotaInfo, err = q.config.BlockServer().GetTeamQuotaInfo(ctx, q.tid)
	}
	if err != nil {
		return cachedQuotaUsage{}, err
	}

	usage.limitBytes = quotaInfo.Limit
	if quotaInfo.Total != nil {
		usage.usageBytes = quotaInfo.Total.Bytes[kbfsblock.UsageWrite]
	} else {
		usage.usageBytes = 0
	}
	usage.timestamp = q.config.Clock().Now()

	q.mu.Lock()
	defer q.mu.Unlock()
	q.cached = usage

	return usage, nil
}

func (q *EventuallyConsistentQuotaUsage) getCached() cachedQuotaUsage {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.cached
}

// Get returns KBFS bytes used and limit for user. To help avoid having too
// frequent calls into bserver, caller can provide a positive tolerance, to
// accept stale LimitBytes and UsageBytes data. If tolerance is 0 or negative,
// this always makes a blocking RPC to bserver and return latest quota usage.
//
// 1) If the age of cached data is more than blockTolerance, a blocking RPC is
// issued and the function only returns after RPC finishes, with the newest
// data from RPC. The RPC causes cached data to be refreshed as well.
// 2) Otherwise, if the age of cached data is more than bgTolerance,
// a background RPC is spawned to refresh cached data, and the stale
// data is returned immediately.
// 3) Otherwise, the cached stale data is returned immediately.
func (q *EventuallyConsistentQuotaUsage) Get(
	ctx context.Context, bgTolerance, blockTolerance time.Duration) (
	timestamp time.Time, usageBytes, limitBytes int64, err error) {
	c := q.getCached()
	err = q.fetcher.Do(ctx, bgTolerance, blockTolerance, c.timestamp)
	if err != nil {
		return time.Time{}, -1, -1, err
	}

	c = q.getCached()
	return c.timestamp, c.usageBytes, c.limitBytes, nil
}
