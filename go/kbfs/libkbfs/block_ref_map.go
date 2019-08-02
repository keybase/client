// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/protocol/keybase1"
)

type blockRefStatus int

const (
	unknownBlockRef  blockRefStatus = 0
	liveBlockRef     blockRefStatus = 1
	archivedBlockRef blockRefStatus = 2
)

func (brf blockRefStatus) toBlockStatus() keybase1.BlockStatus {
	switch brf {
	case unknownBlockRef:
		return keybase1.BlockStatus_UNKNOWN
	case liveBlockRef:
		return keybase1.BlockStatus_LIVE
	case archivedBlockRef:
		return keybase1.BlockStatus_ARCHIVED
	default:
		panic(fmt.Sprintf("Unknown ref status: %d", brf))
	}
}

func (brf blockRefStatus) String() string {
	switch brf {
	case unknownBlockRef:
		return "unknown"
	case liveBlockRef:
		return "live"
	case archivedBlockRef:
		return "archived"
	default:
		panic(fmt.Sprintf("Unknown ref status: %d", brf))
	}
}

type blockContextMismatchError struct {
	expected, actual kbfsblock.Context
}

func (e blockContextMismatchError) Error() string {
	return fmt.Sprintf(
		"Context mismatch: expected %s, got %s", e.expected, e.actual)
}

// TODO: Support unknown fields.

type blockRefEntry struct {
	Status  blockRefStatus
	Context kbfsblock.Context
	// mostRecentTag, if non-nil, is used by callers to figure out
	// if an entry has been modified by something else. See
	// blockRefMap.remove.
	MostRecentTag string
}

func (e blockRefEntry) checkContext(context kbfsblock.Context) error {
	if e.Context != context {
		return blockContextMismatchError{e.Context, context}
	}
	return nil
}

// blockRefMap is a map with additional checking methods.
//
// TODO: Make this into a struct type that supports unknown fields.
type blockRefMap map[kbfsblock.RefNonce]blockRefEntry

func (refs blockRefMap) hasNonArchivedRef() bool {
	for _, refEntry := range refs {
		if refEntry.Status == liveBlockRef {
			return true
		}
	}
	return false
}

func (refs blockRefMap) getLiveCount() (count int) {
	for _, refEntry := range refs {
		if refEntry.Status == liveBlockRef {
			count++
		}
	}
	return count
}

func (refs blockRefMap) checkExists(context kbfsblock.Context) (
	bool, blockRefStatus, error) {
	refEntry, ok := refs[context.GetRefNonce()]
	if !ok {
		return false, unknownBlockRef, nil
	}

	err := refEntry.checkContext(context)
	if err != nil {
		return false, unknownBlockRef, err
	}

	return true, refEntry.Status, nil
}

func (refs blockRefMap) put(context kbfsblock.Context, status blockRefStatus,
	tag string) error {
	refNonce := context.GetRefNonce()
	if refEntry, ok := refs[refNonce]; ok {
		err := refEntry.checkContext(context)
		if err != nil {
			return err
		}
	}

	refs[refNonce] = blockRefEntry{
		Status:        status,
		Context:       context,
		MostRecentTag: tag,
	}
	return nil
}

// remove removes the entry with the given context, if any. If tag is
// non-empty, then the entry will be removed only if its most recent
// tag (passed in to put) matches the given one.
func (refs blockRefMap) remove(context kbfsblock.Context, tag string) error {
	refNonce := context.GetRefNonce()
	// If this check fails, this ref is already gone, which is not
	// an error.
	if refEntry, ok := refs[refNonce]; ok {
		err := refEntry.checkContext(context)
		if err != nil {
			return err
		}
		if tag == "" || refEntry.MostRecentTag == tag {
			delete(refs, refNonce)
		}
	}
	return nil
}

func (refs blockRefMap) deepCopy() blockRefMap {
	if len(refs) == 0 {
		return nil
	}
	refsCopy := make(blockRefMap)
	for k, v := range refs {
		refsCopy[k] = v
	}
	return refsCopy
}
