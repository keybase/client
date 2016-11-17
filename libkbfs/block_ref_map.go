// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "fmt"

type blockRefStatus int

const (
	liveBlockRef     blockRefStatus = 1
	archivedBlockRef blockRefStatus = 2
)

type blockContextMismatchError struct {
	expected, actual BlockContext
}

func (e blockContextMismatchError) Error() string {
	return fmt.Sprintf(
		"Context mismatch: expected %s, got %s", e.expected, e.actual)
}

// TODO: Support unknown fields.

type blockRefEntry struct {
	Status  blockRefStatus
	Context BlockContext
	// mostRecentTag, if non-nil, is used by callers to figure out
	// if an entry has been modified by something else. See
	// blockRefMap.remove.
	MostRecentTag string
}

func (e blockRefEntry) checkContext(context BlockContext) error {
	if e.Context != context {
		return blockContextMismatchError{e.Context, context}
	}
	return nil
}

// blockRefMap is a map with additional checking methods.
//
// TODO: Make this into a struct type that supports unknown fields.
type blockRefMap map[BlockRefNonce]blockRefEntry

func (refs blockRefMap) hasNonArchivedRef() bool {
	for _, refEntry := range refs {
		if refEntry.Status == liveBlockRef {
			return true
		}
	}
	return false
}

func (refs blockRefMap) checkExists(context BlockContext) (bool, error) {
	refEntry, ok := refs[context.GetRefNonce()]
	if !ok {
		return false, nil
	}

	err := refEntry.checkContext(context)
	if err != nil {
		return false, err
	}

	return true, nil
}

func (refs blockRefMap) getStatuses() map[BlockRefNonce]blockRefStatus {
	statuses := make(map[BlockRefNonce]blockRefStatus)
	for ref, refEntry := range refs {
		statuses[ref] = refEntry.Status
	}
	return statuses
}

func (refs blockRefMap) put(context BlockContext, status blockRefStatus,
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
func (refs blockRefMap) remove(context BlockContext, tag string) error {
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
