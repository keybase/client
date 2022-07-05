// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

const (
	fetchDeciderBackgroundTimeout = 10 * time.Second
)

// fetchDecider is a struct that helps avoid having too frequent calls
// into a remote server.
type fetchDecider struct {
	clockGetter

	log     logger.Logger
	vlog    *libkb.VDebugLog
	fetcher func(ctx context.Context) error
	tagKey  interface{}
	tagName string

	blockingForTest chan<- struct{}

	lock    sync.Mutex
	readyCh chan struct{}
	errPtr  *error
}

func newFetchDecider(
	log logger.Logger, vlog *libkb.VDebugLog,
	fetcher func(ctx context.Context) error, tagKey interface{}, tagName string,
	clock clockGetter) *fetchDecider {
	return &fetchDecider{
		log:         log,
		vlog:        vlog,
		fetcher:     fetcher,
		tagKey:      tagKey,
		tagName:     tagName,
		clockGetter: clock,
	}
}

func (fd *fetchDecider) launchBackgroundFetch(ctx context.Context) (
	readyCh <-chan struct{}, errPtr *error) {
	fd.lock.Lock()
	defer fd.lock.Unlock()

	if fd.readyCh != nil {
		fd.vlog.CLogf(ctx, libkb.VLog1, "Waiting on existing fetch")
		// There's already a fetch in progress.
		return fd.readyCh, fd.errPtr
	}

	fd.readyCh = make(chan struct{})
	fd.errPtr = new(error)

	id, err := MakeRandomRequestID()
	if err != nil {
		fd.log.Warning("Couldn't generate a random request ID: %v", err)
	}
	fd.vlog.CLogf(
		ctx, libkb.VLog1, "Spawning fetch in background with tag:%s=%v",
		fd.tagName, id)
	go func() {
		// Make a new context so that it doesn't get canceled
		// when returned.
		logTags := make(logger.CtxLogTags)
		logTags[fd.tagKey] = fd.tagName
		bgCtx := logger.NewContextWithLogTags(
			context.Background(), logTags)
		bgCtx = context.WithValue(bgCtx, fd.tagKey, id)
		// Make sure a timeout is on the context, in case the
		// RPC blocks forever somehow, where we'd end up with
		// never resetting backgroundInProcess flag again.
		bgCtx, cancel := context.WithTimeout(
			bgCtx, fetchDeciderBackgroundTimeout)
		defer cancel()
		err := fd.fetcher(bgCtx)

		// Notify everyone we're done fetching.
		fd.lock.Lock()
		defer fd.lock.Unlock()
		fd.vlog.CLogf(bgCtx, libkb.VLog1, "Finished fetch: %+v", err)
		*fd.errPtr = err
		close(fd.readyCh)
		fd.readyCh = nil
		fd.errPtr = nil
	}()
	return fd.readyCh, fd.errPtr
}

// Do decides whether to block on a fetch, launch a background fetch
// and use existing cached value, or simply use the existing cached
// value with no more fetching. The caller can provide a positive
// tolerance, to accept stale LimitBytes and UsageBytes data. If
// tolerance is 0 or negative, this always makes a blocking call using
// `fd.fetcher`.
//
// 1) If the age of cached data is more than blockTolerance, it blocks
// until a new value is fetched and ready in the caller's cache.
// 2) Otherwise, if the age of cached data is more than bgTolerance,
// a background RPC is spawned to refresh cached data using `fd.fetcher`,
// but returns immediately to let the caller use stale data.
// 3) Otherwise, it returns immediately
func (fd *fetchDecider) Do(
	ctx context.Context, bgTolerance, blockTolerance time.Duration,
	cachedTimestamp time.Time) (err error) {
	past := fd.Clock().Now().Sub(cachedTimestamp)
	switch {
	case past > blockTolerance || cachedTimestamp.IsZero():
		fd.vlog.CLogf(
			ctx, libkb.VLog1, "Blocking on fetch; cached data is %s old", past)
		readyCh, errPtr := fd.launchBackgroundFetch(ctx)

		if fd.blockingForTest != nil {
			fd.blockingForTest <- struct{}{}
		}

		select {
		case <-readyCh:
			return *errPtr
		case <-ctx.Done():
			return ctx.Err()
		}
	case past > bgTolerance:
		fd.vlog.CLogf(ctx, libkb.VLog1, "Cached data is %s old", past)
		_, _ = fd.launchBackgroundFetch(ctx)
		// Return immediately, with no error, since the caller can
		// just use the existing cache value.
		return nil
	default:
		fd.vlog.CLogf(ctx, libkb.VLog1, "Using cached data from %s ago", past)
		return nil
	}
}
