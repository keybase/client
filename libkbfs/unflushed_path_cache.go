// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"golang.org/x/net/context"
)

type unflushedPathCacheState int

const (
	upcUninitialized unflushedPathCacheState = iota
	upcInitializing
	upcInitialized
)

type unflushedPathsPerRevMap map[string]bool
type unflushedPathsMap map[MetadataRevision]unflushedPathsPerRevMap

// unflushedPathCache tracks the paths that have been modified by MD
// updates that haven't yet been flushed from the journal.
type unflushedPathCache struct {
	lock            sync.RWMutex
	state           unflushedPathCacheState
	unflushedPaths  unflushedPathsMap
	ready           chan struct{}
	chainsPopulator chainsPathPopulator
	appendQueue     []unflushedPathMDInfo
	removeQueue     []MetadataRevision
}

var errUPCNotInitialized = errors.New("The unflushed path cache is not yet initialized")

// getUnflushedPaths returns a copy of the unflushed path cache if it
// has been initialized, otherwise nil.  It must be called under the
// same lock as the callers of appendToCache/removeFromCache.  The
// caller must not modify the inner per-revision maps of the return
// value.
func (upc *unflushedPathCache) getUnflushedPaths() unflushedPathsMap {
	upc.lock.RLock()
	defer upc.lock.RUnlock()
	if upc.unflushedPaths == nil {
		return nil
	}
	cache := make(unflushedPathsMap)
	// Only need to deep-copy the outer level of the map; the inner
	// level (per-revision) shouldn't be modified us once it's set,
	// and the caller isn't supposed to modify it.
	for k, v := range upc.unflushedPaths {
		cache[k] = v
	}
	return cache
}

func (upc *unflushedPathCache) doStartInitialization() (
	bool, <-chan struct{}) {
	upc.lock.Lock()
	defer upc.lock.Unlock()
	switch upc.state {
	case upcUninitialized:
		upc.state = upcInitializing
		if upc.ready != nil {
			panic("Unflushed path cache should not have a non-nil channel " +
				"when uninitialized")
		}
		upc.ready = make(chan struct{})
		return true, upc.ready
	case upcInitializing:
		return false, upc.ready
	case upcInitialized:
		return false, nil
	default:
		panic(fmt.Sprintf("Unknown unflushedPathsCache state: %v", upc.state))
	}
}

// startInitializeOrWait returns true if the caller should start
// initialization, otherwise false (which means the cache is already
// initialized when it returns).  It may block for an extended period
// of time during while another caller is initializing.
func (upc *unflushedPathCache) startInitializeOrWait(ctx context.Context) (
	bool, error) {
	// Retry in case the original initializer has to abort due to
	// error; limit the number of retries by the lifetime of `ctx`.
	for {
		doInit, readyCh := upc.doStartInitialization()
		if doInit {
			return true, nil
		} else if readyCh == nil {
			// Already initialized.
			return false, nil
		}
		select {
		case <-readyCh:
			continue
		case <-ctx.Done():
			return false, ctx.Err()
		}
	}
}

func (upc *unflushedPathCache) abortInitialization() {
	upc.lock.Lock()
	defer upc.lock.Unlock()
	upc.state = upcUninitialized
	upc.appendQueue = nil
	upc.removeQueue = nil
	close(upc.ready)
	upc.ready = nil
}

// unflushedPathMDInfo is the subset of metadata info needed by
// unflushedPathCache.
type unflushedPathMDInfo struct {
	revision       MetadataRevision
	kmd            KeyMetadata
	pmd            PrivateMetadata
	localTimestamp time.Time
}

// addUnflushedPaths populates the given unflushed paths object.  The
// caller should NOT be holding any locks, as it's possible that
// blocks will need to be fetched.
func addUnflushedPaths(ctx context.Context,
	uid keybase1.UID, key kbfscrypto.VerifyingKey, codec kbfscodec.Codec,
	log logger.Logger, mdInfos []unflushedPathMDInfo,
	cpp chainsPathPopulator, unflushedPaths unflushedPathsMap) error {
	// Make chains over the entire range to get the unflushed files.
	chains := newCRChainsEmpty()
	processedOne := false
	for _, mdInfo := range mdInfos {
		winfo := newWriterInfo(uid, key, mdInfo.revision)
		if _, ok := unflushedPaths[mdInfo.revision]; ok {
			if processedOne {
				return fmt.Errorf("Couldn't skip revision %d after "+
					"already processing one", mdInfo.revision)
			}

			log.CDebugf(ctx, "Skipping unflushed paths for revision %d "+
				"since it's already in the cache", mdInfo.revision)
			continue
		}
		unflushedPaths[mdInfo.revision] = make(map[string]bool)

		processedOne = true
		err := chains.addOps(codec, mdInfo.pmd, winfo, mdInfo.localTimestamp)
		if err != nil {
			return err
		}
	}
	if !processedOne {
		return nil
	}

	mostRecentMDInfo := mdInfos[len(mdInfos)-1]
	chains.mostRecentChainMDInfo = mostRecentChainMetadataInfo{
		kmd:     mostRecentMDInfo.kmd,
		rootPtr: mostRecentMDInfo.pmd.Dir.BlockPointer,
	}

	err := cpp.populateChainPaths(ctx, log, chains, true)
	if err != nil {
		return err
	}

	for _, chain := range chains.byOriginal {
		for _, op := range chain.ops {
			revPaths, ok := unflushedPaths[op.getWriterInfo().revision]
			if !ok {
				panic(fmt.Sprintf("No rev map for revision %d",
					op.getWriterInfo().revision))
			}
			revPaths[op.getFinalPath().String()] = true
		}
	}
	return nil
}

// prepUnflushedPaths returns a set of paths that were updated in the
// given revision.
func (upc *unflushedPathCache) prepUnflushedPaths(ctx context.Context,
	uid keybase1.UID, key kbfscrypto.VerifyingKey, codec kbfscodec.Codec,
	log logger.Logger, mdInfo unflushedPathMDInfo) (
	unflushedPathsPerRevMap, error) {
	cpp := func() chainsPathPopulator {
		upc.lock.Lock()
		defer upc.lock.Unlock()
		return upc.chainsPopulator
	}()

	// The unflushed paths haven't been initialized yet.
	if cpp == nil {
		return nil, nil
	}

	newUnflushedPaths := make(unflushedPathsMap)
	mdInfos := []unflushedPathMDInfo{mdInfo}

	err := addUnflushedPaths(ctx, uid, key, codec, log, mdInfos, cpp,
		newUnflushedPaths)
	if err != nil {
		return nil, err
	}
	if len(newUnflushedPaths) > 1 {
		return nil, fmt.Errorf("%d unflushed revisions on a single put",
			len(newUnflushedPaths))
	}

	perRevMap, ok := newUnflushedPaths[mdInfo.revision]
	if !ok {
		panic(fmt.Errorf("Cannot find per-revision map for revision %d",
			mdInfo.revision))
	}

	return perRevMap, nil
}

// appendToCache returns true when successful, and false if it needs
// to be retried after the per-revision map is recomputed.
func (upc *unflushedPathCache) appendToCache(mdInfo unflushedPathMDInfo,
	perRevMap unflushedPathsPerRevMap) bool {
	upc.lock.Lock()
	defer upc.lock.Unlock()
	switch upc.state {
	case upcUninitialized:
		// Nothing to do.
	case upcInitializing:
		// Append to queue for processing at the end of initialization.
		upc.appendQueue = append(upc.appendQueue, mdInfo)
	case upcInitialized:
		if perRevMap == nil {
			// This was prepared before `upc.chainsPopulator` was set,
			// and needs to be done again.
			return false
		}
		// Update the cache with the prepared paths.
		upc.unflushedPaths[mdInfo.revision] = perRevMap
	default:
		panic(fmt.Sprintf("Unknown unflushedPathsCache state: %v", upc.state))
	}
	return true
}

func (upc *unflushedPathCache) removeFromCache(rev MetadataRevision) {
	upc.lock.Lock()
	defer upc.lock.Unlock()
	switch upc.state {
	case upcUninitialized:
		// Nothing to do.
	case upcInitializing:
		// Append to queue for processing at the end of initialization.
		upc.removeQueue = append(upc.removeQueue, rev)
	case upcInitialized:
		delete(upc.unflushedPaths, rev)
	default:
		panic(fmt.Sprintf("Unknown unflushedPathsCache state: %v", upc.state))
	}
}

func (upc *unflushedPathCache) setCacheIfPossible(cache unflushedPathsMap,
	cpp chainsPathPopulator) []unflushedPathMDInfo {
	upc.lock.Lock()
	defer upc.lock.Unlock()
	if len(upc.appendQueue) > 0 {
		// We need to process more appends!
		queue := upc.appendQueue
		upc.appendQueue = nil
		return queue
	}

	for _, rev := range upc.removeQueue {
		delete(cache, rev)
	}
	upc.removeQueue = nil
	upc.unflushedPaths = cache
	upc.chainsPopulator = cpp
	close(upc.ready)
	upc.ready = nil
	upc.state = upcInitialized
	return nil
}

// initialize should only be called when the caller saw a `true` value
// from `startInitializeOrWait()`.  It returns the unflushed paths
// associated with `irmds`.  If it returns a `false` boolean, the
// caller must abort the initialization (although as long as `err` is
// nil, the returns unflushed paths may be used).  The caller should
// not modify any of the per-revision inner maps of the returned
// unflushed path map.
func (upc *unflushedPathCache) initialize(ctx context.Context,
	uid keybase1.UID, key kbfscrypto.VerifyingKey, codec kbfscodec.Codec,
	log logger.Logger, cpp chainsPathPopulator,
	mdInfos []unflushedPathMDInfo) (unflushedPathsMap, bool, error) {
	// First get all the paths for the given range.  On the first try
	unflushedPaths := make(unflushedPathsMap)
	log.CDebugf(ctx, "Initializing unflushed path cache with %d revisions",
		len(mdInfos))
	err := addUnflushedPaths(ctx, uid, key, codec, log, mdInfos, cpp,
		unflushedPaths)
	if err != nil {
		return nil, false, err
	}

	initialUnflushedPaths := make(unflushedPathsMap)
	// Only need to deep-copy the outer level of the map; the inner
	// level (per-revision) shouldn't be modified us once it's set,
	// and the caller isn't supposed to modify it.
	for k, v := range unflushedPaths {
		initialUnflushedPaths[k] = v
	}

	// Try to drain the queue a few times.  We may be unable to if we
	// are continuously racing with MD puts.
	for i := 0; i < 10; i++ {
		queue := upc.setCacheIfPossible(unflushedPaths, cpp)
		if len(queue) == 0 {
			// Return the paths corresponding only to the original set
			// of RMDs, not to anything from the queue.
			return initialUnflushedPaths, true, nil
		}

		select {
		case <-ctx.Done():
			return nil, false, ctx.Err()
		default:
		}

		log.CDebugf(ctx, "Processing unflushed paths for %d items in "+
			"the append queue", len(queue))
		err := addUnflushedPaths(ctx, uid, key, codec, log, queue, cpp,
			unflushedPaths)
		if err != nil {
			return nil, false, err
		}
	}
	// If we can't catch up to the queue, then instruct the caller to
	// abort the initialization.
	return initialUnflushedPaths, false, nil
}

// reinitializeWithResolution returns true when successful, and false
// if it needs to be retried after the per-revision map is recomputed.
func (upc *unflushedPathCache) reinitializeWithResolution(
	mdInfo unflushedPathMDInfo, perRevMap unflushedPathsPerRevMap) bool {
	upc.lock.Lock()
	defer upc.lock.Unlock()

	if perRevMap == nil && upc.state != upcUninitialized {
		return false
	}

	upc.unflushedPaths = unflushedPathsMap{mdInfo.revision: perRevMap}
	upc.appendQueue = nil
	upc.removeQueue = nil
	if upc.ready != nil {
		close(upc.ready)
		upc.ready = nil
	}
	upc.state = upcInitialized
	return true
}
