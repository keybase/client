// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "fmt"

type blockContextMismatchError struct {
	expected, actual BlockContext
}

func (e blockContextMismatchError) Error() string {
	return fmt.Sprintf(
		"Context mismatch: expected %s, got %s", e.expected, e.actual)
}

type blockRefEntry struct {
	status  blockRefLocalStatus
	context BlockContext
	// mostRecentTag, if non-nil, is used by callers to figure out
	// if an entry has been modified by something else. See
	// blockRefMap.remove.
	mostRecentTag interface{}
}

func (e blockRefEntry) checkContext(context BlockContext) error {
	if e.context != context {
		return blockContextMismatchError{e.context, context}
	}
	return nil
}

// blockRefMap is a map with additional checking methods.
type blockRefMap map[BlockRefNonce]blockRefEntry

func (refs blockRefMap) hasNonArchivedRef() bool {
	for _, refEntry := range refs {
		if refEntry.status == liveBlockRef {
			return true
		}
	}
	return false
}

func (refs blockRefMap) checkExists(context BlockContext) error {
	refEntry, ok := refs[context.GetRefNonce()]
	if !ok {
		return blockNonExistentError{}
	}

	return refEntry.checkContext(context)
}

func (refs blockRefMap) getStatuses() map[BlockRefNonce]blockRefLocalStatus {
	statuses := make(map[BlockRefNonce]blockRefLocalStatus)
	for ref, refEntry := range refs {
		statuses[ref] = refEntry.status
	}
	return statuses
}

func (refs blockRefMap) put(context BlockContext, status blockRefLocalStatus,
	tag interface{}) error {
	refNonce := context.GetRefNonce()
	if refEntry, ok := refs[refNonce]; ok {
		err := refEntry.checkContext(context)
		if err != nil {
			return err
		}
	}

	refs[refNonce] = blockRefEntry{
		status:        status,
		context:       context,
		mostRecentTag: tag,
	}
	return nil
}

// remove removes the entry with the given context, if any. If tag is
// non-nil, then the entry will be removed only if its most recent tag
// (passed in to put) matches the given one.
func (refs blockRefMap) remove(context BlockContext, tag interface{}) error {
	refNonce := context.GetRefNonce()
	// If this check fails, this ref is already gone, which is not
	// an error.
	if refEntry, ok := refs[refNonce]; ok {
		err := refEntry.checkContext(context)
		if err != nil {
			return err
		}
		if tag == nil || refEntry.mostRecentTag == tag {
			delete(refs, refNonce)
		}
	}
	return nil
}
