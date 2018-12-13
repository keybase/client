// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"sync"

	"github.com/eapache/channels"
	"github.com/keybase/client/go/logger"

	"golang.org/x/net/context"
)

// FSNotifications processes notifications (arbitrary functions,
// usually triggered by libkbfs) and lets other objects block on them,
// usually for testing.
type FSNotifications struct {
	log logger.Logger

	// notifications is a channel for notification functions (which
	// take no value and have no return value).
	notifications channels.Channel

	// notificationGroup can be used by tests to know when libfs is
	// done processing asynchronous notifications.
	notificationGroup sync.WaitGroup

	// protects access to the notifications channel member (though not
	// sending/receiving)
	notificationMutex sync.RWMutex
}

// NewFSNotifications creates a new FSNotifications object.
func NewFSNotifications(log logger.Logger) *FSNotifications {
	return &FSNotifications{log: log}
}

func (f *FSNotifications) processNotifications(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			f.notificationMutex.Lock()
			c := f.notifications
			f.log.CDebugf(ctx, "Nilling notifications channel")
			f.notifications = nil
			f.notificationMutex.Unlock()
			c.Close()
			for range c.Out() {
				// Drain the output queue to allow the Channel close
				// Out() and shutdown any goroutines.
				f.log.CWarningf(ctx,
					"Throwing away notification after shutdown")
			}
			return
		case i := <-f.notifications.Out():
			func() {
				defer f.notificationGroup.Done()
				notifyFn, ok := i.(func())
				if !ok {
					f.log.CWarningf(ctx, "Got a bad notification function: %v", i)
					return
				}
				notifyFn()
			}()
		}
	}
}

// QueueNotification queues a notification, which must be
// goroutine-safe.
func (f *FSNotifications) QueueNotification(fn func()) {
	f.notificationMutex.RLock()
	defer f.notificationMutex.RUnlock()
	if f.notifications == nil {
		f.log.Warning("Ignoring notification, no available channel")
		return
	}
	f.notificationGroup.Add(1)
	f.notifications.In() <- fn
}

// LaunchProcessor launches the notification processor.
func (f *FSNotifications) LaunchProcessor(ctx context.Context) {
	f.notificationMutex.Lock()
	defer f.notificationMutex.Unlock()

	f.log.CDebugf(ctx, "Launching notifications channel")
	// The notifications channel needs to have "infinite" capacity,
	// because otherwise we risk a deadlock between libkbfs and
	// libfs.  The notification processor sends invalidates to the
	// kernel.  In osxfuse 3.X, the kernel can call back into userland
	// during an invalidate (a GetAttr()) call, which in turn takes
	// locks within libkbfs.  So if libkbfs ever gets blocked while
	// trying to enqueue a notification (while it is holding locks),
	// we could have a deadlock.  Yes, if there are too many
	// outstanding notifications we'll run out of memory and crash,
	// but otherwise we risk deadlock.  Which is worse?
	f.notifications = channels.NewInfiniteChannel()

	// start the notification processor
	go f.processNotifications(ctx)
}

// Wait waits until all current notifications are done.
func (f *FSNotifications) Wait() {
	f.notificationGroup.Wait()
}
