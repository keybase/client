// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	// quotaServerTimeoutWhenCached defines how long we wait for the
	// quota usage to return from the server, when we've already read
	// it from the disk cache.
	quotaServerTimeoutWhenCached = 500 * time.Millisecond
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
	timestamp       time.Time
	usageBytes      int64
	archiveBytes    int64
	limitBytes      int64
	gitUsageBytes   int64
	gitArchiveBytes int64
	gitLimitBytes   int64
}

// EventuallyConsistentQuotaUsage keeps tracks of quota usage, in a way user of
// which can choose to accept stale data to reduce calls into block servers.
type EventuallyConsistentQuotaUsage struct {
	config  Config
	log     logger.Logger
	tid     keybase1.TeamID
	fetcher *fetchDecider

	mu      sync.RWMutex
	cached  cachedQuotaUsage
	bgFetch bool
}

// QuotaUsageLogModule makes a log module for a quota usage log.
func QuotaUsageLogModule(suffix string) string {
	return fmt.Sprintf("%s - %s", ECQUID, suffix)
}

// NewEventuallyConsistentQuotaUsage creates a new
// EventuallyConsistentQuotaUsage object.
func NewEventuallyConsistentQuotaUsage(
	config Config, log logger.Logger,
	vlog *libkb.VDebugLog) *EventuallyConsistentQuotaUsage {
	q := &EventuallyConsistentQuotaUsage{
		config: config,
		log:    log,
	}
	q.fetcher = newFetchDecider(
		q.log, vlog, q.getAndCache, ECQUCtxTagKey{}, ECQUID, q.config)
	return q
}

// NewEventuallyConsistentTeamQuotaUsage creates a new
// EventuallyConsistentQuotaUsage object.
func NewEventuallyConsistentTeamQuotaUsage(
	config Config, tid keybase1.TeamID,
	log logger.Logger, vlog *libkb.VDebugLog) *EventuallyConsistentQuotaUsage {
	q := NewEventuallyConsistentQuotaUsage(config, log, vlog)
	q.tid = tid
	return q
}

func (q *EventuallyConsistentQuotaUsage) getCached() cachedQuotaUsage {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.cached
}

func (q *EventuallyConsistentQuotaUsage) getID(
	ctx context.Context) (keybase1.UserOrTeamID, error) {
	if q.tid.IsNil() {
		session, err := q.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return keybase1.UserOrTeamID(""), err
		}
		return session.UID.AsUserOrTeam(), nil
	}
	return q.tid.AsUserOrTeam(), nil
}

func (q *EventuallyConsistentQuotaUsage) cache(
	ctx context.Context, quotaInfo *kbfsblock.QuotaInfo, doCacheToDisk bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.cached.limitBytes = quotaInfo.Limit
	q.cached.gitLimitBytes = quotaInfo.GitLimit
	if quotaInfo.Total != nil {
		q.cached.usageBytes = quotaInfo.Total.Bytes[kbfsblock.UsageWrite]
		q.cached.archiveBytes = quotaInfo.Total.Bytes[kbfsblock.UsageArchive]
		q.cached.gitUsageBytes = quotaInfo.Total.Bytes[kbfsblock.UsageGitWrite]
		q.cached.gitArchiveBytes =
			quotaInfo.Total.Bytes[kbfsblock.UsageGitArchive]
	} else {
		q.cached.usageBytes = 0
	}
	q.cached.timestamp = q.config.Clock().Now()

	dqc := q.config.DiskQuotaCache()
	if !doCacheToDisk || dqc == nil {
		return
	}

	id, err := q.getID(ctx)
	if err != nil {
		q.log.CDebugf(ctx, "Can't get ID: %+v", err)
		return
	}
	err = dqc.Put(ctx, id, *quotaInfo)
	if err != nil {
		q.log.CDebugf(ctx, "Can't cache quota for %s: %+v", id, err)
	}
}

func (q *EventuallyConsistentQuotaUsage) fetch(ctx context.Context) (
	quotaInfo *kbfsblock.QuotaInfo, err error) {
	bserver := q.config.BlockServer()
	for i := 0; bserver == nil; i++ {
		// This is possible if a login event comes in during
		// initialization.
		if i == 0 {
			q.log.CDebugf(ctx, "Waiting for bserver")
		}
		time.Sleep(100 * time.Millisecond)
		bserver = q.config.BlockServer()
	}
	if q.tid.IsNil() {
		return bserver.GetUserQuotaInfo(ctx)
	}
	return bserver.GetTeamQuotaInfo(ctx, q.tid)
}

func (q *EventuallyConsistentQuotaUsage) doBackgroundFetch() {
	doFetch := func() bool {
		q.mu.Lock()
		defer q.mu.Unlock()
		if q.bgFetch {
			return false
		}
		q.bgFetch = true
		return true
	}()
	if !doFetch {
		return
	}

	defer func() {
		q.mu.Lock()
		defer q.mu.Unlock()
		q.bgFetch = false
	}()

	ctx := CtxWithRandomIDReplayable(
		context.Background(), ECQUCtxTagKey{}, ECQUID, q.log)
	q.log.CDebugf(ctx, "Running background quota fetch, without a timeout")

	quotaInfo, err := q.fetch(ctx)
	if err != nil {
		q.log.CDebugf(ctx, "Unable to fetch quota in background: %+v", err)
		return
	}
	q.cache(ctx, quotaInfo, true)
}

func (q *EventuallyConsistentQuotaUsage) getAndCache(
	ctx context.Context) (err error) {
	defer func() {
		q.log.CDebugf(ctx, "getAndCache: error=%v", err)
	}()

	// Try pulling the quota from the disk cache.  If it exists, still
	// try the servers, but give it a short timeout.
	var quotaInfoFromCache *kbfsblock.QuotaInfo
	id, err := q.getID(ctx)
	if err != nil {
		return err
	}
	getCtx := ctx
	dqc := q.config.DiskQuotaCache()
	if dqc != nil {
		qi, err := dqc.Get(ctx, id)
		if err == nil {
			q.log.CDebugf(ctx, "Read quota for %s from disk cache", id)
			quotaInfoFromCache = &qi
			var cancel context.CancelFunc
			getCtx, cancel = context.WithTimeout(
				ctx, quotaServerTimeoutWhenCached)
			defer cancel()
		}
	}

	quotaInfo, err := q.fetch(getCtx)
	doCacheToDisk := dqc != nil
	switch err {
	case nil:
	case context.DeadlineExceeded:
		go q.doBackgroundFetch()
		if quotaInfoFromCache != nil {
			q.log.CDebugf(ctx, "Can't contact server; using cached quota")
			quotaInfo = quotaInfoFromCache
			doCacheToDisk = false
		} else {
			return err
		}
	default:
		return err
	}

	q.cache(ctx, quotaInfo, doCacheToDisk)
	return nil
}

// Get returns KBFS bytes used and limit for user, for the current
// default block type. To help avoid having too frequent calls into
// bserver, caller can provide a positive tolerance, to accept stale
// LimitBytes and UsageBytes data. If tolerance is 0 or negative, this
// always makes a blocking RPC to bserver and return latest quota
// usage.
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
	timestamp time.Time, usageBytes, archiveBytes, limitBytes int64,
	err error) {
	c := q.getCached()
	err = q.fetcher.Do(ctx, bgTolerance, blockTolerance, c.timestamp)
	if err != nil {
		return time.Time{}, -1, -1, -1, err
	}

	c = q.getCached()
	switch q.config.DefaultBlockType() {
	case keybase1.BlockType_DATA:
		return c.timestamp, c.usageBytes, c.archiveBytes, c.limitBytes, nil
	case keybase1.BlockType_GIT:
		return c.timestamp, c.gitUsageBytes, c.gitArchiveBytes,
			c.gitLimitBytes, nil
	default:
		return time.Time{}, -1, -1, -1, errors.Errorf(
			"Unknown default block type: %d", q.config.DefaultBlockType())
	}
}

// GetAllTypes is the same as Get, except it returns usage and limits
// for all block types.
func (q *EventuallyConsistentQuotaUsage) GetAllTypes(
	ctx context.Context, bgTolerance, blockTolerance time.Duration) (
	timestamp time.Time,
	usageBytes, archiveBytes, limitBytes,
	gitUsageBytes, gitArchiveBytes, gitLimitBytes int64, err error) {
	c := q.getCached()
	err = q.fetcher.Do(ctx, bgTolerance, blockTolerance, c.timestamp)
	if err != nil {
		return time.Time{}, -1, -1, -1, -1, -1, -1, err
	}

	c = q.getCached()
	return c.timestamp,
		c.usageBytes, c.archiveBytes, c.limitBytes,
		c.gitUsageBytes, c.gitArchiveBytes, c.gitLimitBytes, nil
}
