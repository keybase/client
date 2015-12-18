// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	context "golang.org/x/net/context"
)

type getObj struct {
	id    ConnectionID
	retCh chan<- keybase1.NotificationChannels
}

type setObj struct {
	id  ConnectionID
	val keybase1.NotificationChannels
}

// NotifyRouter routes notifications to the various active RPC
// connections. It's careful only to route to those who are interested
type NotifyRouter struct {
	Contextified
	cm         *ConnectionManager
	state      map[ConnectionID]keybase1.NotificationChannels
	setCh      chan setObj
	getCh      chan getObj
	shutdownCh chan struct{}
}

// NewNotifyRouter makes a new notification router; we should only
// make one of these per process.
func NewNotifyRouter(g *GlobalContext) *NotifyRouter {
	ret := &NotifyRouter{
		Contextified: NewContextified(g),
		cm:           g.ConnectionManager,
		state:        make(map[ConnectionID]keybase1.NotificationChannels),
		setCh:        make(chan setObj),
		getCh:        make(chan getObj),
		shutdownCh:   make(chan struct{}),
	}
	go ret.run()
	return ret
}

func (n *NotifyRouter) Shutdown() {
	n.shutdownCh <- struct{}{}
}

func (n *NotifyRouter) setNotificationChannels(id ConnectionID, val keybase1.NotificationChannels) {
	n.setCh <- setObj{id, val}
}

func (n *NotifyRouter) getNotificationChannels(id ConnectionID) keybase1.NotificationChannels {
	retCh := make(chan keybase1.NotificationChannels)
	n.getCh <- getObj{id, retCh}
	return <-retCh
}

func (n *NotifyRouter) run() {
	for {
		select {
		case <-n.shutdownCh:
			return
		case o := <-n.setCh:
			n.state[o.id] = o.val
		case o := <-n.getCh:
			o.retCh <- n.state[o.id]
		}
	}
}

// AddConnection should be called every time there's a new RPC connection
// established for this server.  The caller should pass in the Transporter
// and also the channel that will get messages when the chanel closes.
func (n *NotifyRouter) AddConnection(xp rpc.Transporter, ch chan error) ConnectionID {
	if n == nil {
		return 0
	}
	id := n.cm.AddConnection(xp, ch)
	n.setNotificationChannels(id, keybase1.NotificationChannels{})
	return id
}

// SetChannels sets which notification channels are interested for the connection
// with the given connection ID.
func (n *NotifyRouter) SetChannels(i ConnectionID, nc keybase1.NotificationChannels) {
	n.setNotificationChannels(i, nc)
}

// HandleLogout is called whenever the current user logged out. It will broadcast
// the message to all connections who care about such a mesasge.
func (n *NotifyRouter) HandleLogout() {
	if n == nil {
		return
	}
	n.G().Log.Debug("+ Sending logout notfication")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Session` notification type
		if n.getNotificationChannels(id).Session {
			// In the background do...
			go func() {
				// A send of a `LoggedOut` RPC
				(keybase1.NotifySessionClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}),
				}).LoggedOut(context.TODO())
			}()
		}
		return true
	})
	n.G().Log.Debug("- Logout notification sent")
}

// HandleUserChanged is called whenever we know that a given user has
// changed (and must be cache-busted). It will broadcast the messages
// to all curious listeners.
func (n *NotifyRouter) HandleUserChanged(uid keybase1.UID) {
	if n == nil {
		return
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Users` notification type
		if n.getNotificationChannels(id).Users {
			// In the background do...
			go func() {
				// A send of a `UserChanged` RPC with the user's UID
				(keybase1.NotifyUsersClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}),
				}).UserChanged(context.TODO(), uid)
			}()
		}
		return true
	})
}

// HandleTrackingChanged is called whenever we have a new tracking or
// untracking chain link related to a given user. It will broadcast the
// messages to all curious listeners.
func (n *NotifyRouter) HandleTrackingChanged(uid keybase1.UID, username string) {
	if n == nil {
		return
	}
	arg := keybase1.TrackingChangedArg{
		Uid:      uid,
		Username: username,
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Tracking` notification type
		if n.getNotificationChannels(id).Tracking {
			// In the background do...
			go func() {
				// A send of a `TrackingChanged` RPC with the user's UID
				(keybase1.NotifyTrackingClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}),
				}).TrackingChanged(context.TODO(), arg)
			}()
		}
		return true
	})
}

// HandleFSActivity is called for any KBFS notification. It will broadcast the messages
// to all curious listeners.
func (n *NotifyRouter) HandleFSActivity(activity keybase1.FSNotification) {
	if n == nil {
		return
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Kbfs` notification type
		if n.getNotificationChannels(id).Kbfs {
			// In the background do...
			go func() {
				// A send of a `FSActivity` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}),
				}).FSActivity(context.TODO(), activity)
			}()
		}
		return true
	})
}
