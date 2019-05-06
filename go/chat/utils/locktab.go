package utils

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

var ErrConvLockTabDeadlock = errors.New("timeout reading thread")

type conversationLock struct {
	refs, shares int
	trace        string
	lock         sync.Mutex
}

type ConversationLockTab struct {
	globals.Contextified
	sync.Mutex
	DebugLabeler

	maxAcquireRetries int
	convLocks         map[string]*conversationLock
	waits             map[string]string
	blockCb           *chan struct{} // Testing
}

func NewConversationLockTab(g *globals.Context) *ConversationLockTab {
	return &ConversationLockTab{
		Contextified:      globals.NewContextified(g),
		DebugLabeler:      NewDebugLabeler(g.GetLog(), "ConversationLockTab", false),
		convLocks:         make(map[string]*conversationLock),
		waits:             make(map[string]string),
		maxAcquireRetries: 25,
	}
}

func (c *ConversationLockTab) SetMaxAcquireRetries(n int) {
	c.Lock()
	defer c.Unlock()
	c.maxAcquireRetries = n
}

func (c *ConversationLockTab) SetBlockCb(ch *chan struct{}) {
	c.Lock()
	defer c.Unlock()
	c.blockCb = ch
}

func (c *ConversationLockTab) NumLocks() int {
	c.Lock()
	defer c.Unlock()
	return len(c.convLocks)
}

func (c *ConversationLockTab) key(uid gregor1.UID, convID chat1.ConversationID) string {
	return fmt.Sprintf("%s:%s", uid, convID)
}

// deadlockDetect tries to find a deadlock condition in the current set of waiting acquirers.
func (c *ConversationLockTab) deadlockDetect(ctx context.Context, trace string, waiters map[string]bool) bool {
	// See if this trace is waiting on any other trace
	waitingOnTrace, ok := c.waits[trace]
	if !ok {
		// If not, no deadlock
		return false
	}
	// If we are waiting on a trace we have already encountered, then we have hit a deadlock
	if waiters[waitingOnTrace] {
		c.Debug(ctx, "deadlockDetect: deadlock detected: trace: %s waitingOnTrace: %s waiters: %v",
			trace, waitingOnTrace, waiters)
		return true
	}
	// Set the current trace as waiting, and then continue down the chain
	waiters[trace] = true
	return c.deadlockDetect(ctx, waitingOnTrace, waiters)
}

func (c *ConversationLockTab) doAcquire(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (blocked bool, err error) {
	key := c.key(uid, convID)
	trace, ok := globals.CtxTrace(ctx)
	if !ok {
		c.Debug(ctx, "Acquire: failed to find trace value, not using a lock: convID: %s", convID)
		return false, nil
	}

	c.Lock()
	if lock, ok := c.convLocks[key]; ok {
		if lock.trace == trace {
			// Our request holds the lock on this conversation ID already, so just plow through it
			lock.shares++
			c.Unlock()
			return
		}
		c.Debug(ctx, "Acquire: blocked by trace: %s on convID: %s", lock.trace, convID)
		if c.blockCb != nil {
			*c.blockCb <- struct{}{} // For testing
		}
		c.waits[trace] = lock.trace
		// If we get blocked, let's make sure we aren't in a deadlock situation, and if so, we bail out
		if c.deadlockDetect(ctx, lock.trace, map[string]bool{
			trace: true,
		}) {
			c.Unlock()
			return true, ErrConvLockTabDeadlock
		}
		lock.refs++
		c.Unlock() // Give up map lock while we are waiting for conv lock
		lock.lock.Lock()
		c.Lock()
		delete(c.waits, trace)
		lock.trace = trace
		lock.shares = 1
		c.Unlock()
		return true, nil
	}

	lock := &conversationLock{
		shares: 1,
		refs:   1,
		trace:  trace,
	}
	c.convLocks[key] = lock
	lock.lock.Lock()
	c.Unlock()
	return false, nil
}

// Acquire obtains a per user per conversation lock on a per trace basis. That is, the lock is a
// shared lock for the current chat trace, and serves to synchronize large chat operations. If there is
// no chat trace, this is a no-op.
func (c *ConversationLockTab) Acquire(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (blocked bool, err error) {
	sleep := 200 * time.Millisecond
	for i := 0; i < c.maxAcquireRetries; i++ {
		blocked, err = c.doAcquire(ctx, uid, convID)
		if err != nil {
			if err != ErrConvLockTabDeadlock {
				return true, err
			}
			c.Debug(ctx, "Acquire: deadlock condition detected, sleeping and trying again: attempt: %d", i)
			time.Sleep(sleep)
			continue
		}
		return blocked, nil
	}
	c.Debug(ctx, "Acquire: giving up, max attempts reached")
	return true, ErrConvLockTabDeadlock
}

func (c *ConversationLockTab) Release(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (released bool) {
	c.Lock()
	defer c.Unlock()
	trace, ok := globals.CtxTrace(ctx)
	if !ok {
		c.Debug(ctx, "Release: failed to find trace value, doing nothing: convID: %s", convID)
		return false
	}

	key := c.key(uid, convID)
	if lock, ok := c.convLocks[key]; ok {
		if lock.trace != trace {
			c.Debug(ctx, "Release: different trace trying to free lock? convID: %s lock.trace: %s trace: %s",
				convID, lock.trace, trace)
		} else {
			lock.shares--
			if lock.shares == 0 {
				lock.refs--
				if lock.refs == 0 {
					delete(c.convLocks, key)
				}
				lock.trace = ""
				lock.lock.Unlock()
				return true
			}
		}
	}
	return false
}
