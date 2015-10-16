package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
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
	cm    *ConnectionManager
	state map[ConnectionID]keybase1.NotificationChannels
	setCh chan setObj
	getCh chan getObj
}

// NewNotifyRouter makes a new notification router; we should only
// make one of these per process.
func NewNotifyRouter() *NotifyRouter {
	ret := &NotifyRouter{
		cm:    NewConnectionManager(),
		state: make(map[ConnectionID]keybase1.NotificationChannels),
		setCh: make(chan setObj),
		getCh: make(chan getObj),
	}
	go ret.run()
	return ret
}

func (n *NotifyRouter) set(id ConnectionID, val keybase1.NotificationChannels) {
	n.setCh <- setObj{id, val}
}

func (n *NotifyRouter) get(id ConnectionID) keybase1.NotificationChannels {
	retCh := make(chan keybase1.NotificationChannels)
	n.getCh <- getObj{id, retCh}
	return <-retCh
}

func (n *NotifyRouter) run() {
	for {
		select {
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
	id := n.cm.AddConnection(xp, ch)
	n.set(id, keybase1.NotificationChannels{})
	return id
}

// SetChannels sets which notification channels are interested for the connection
// with the given connection ID.
func (n *NotifyRouter) SetChannels(i ConnectionID, nc keybase1.NotificationChannels) {
	n.set(i, nc)
}

// HandleLogout is called whenever the current user logged out. It will broadcast
// the message to all connections who care about such a mesasge.
func (n *NotifyRouter) HandleLogout() {
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.get(id).Session {
			go func() {
				(keybase1.NotifySessionClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}),
				}).LoggedOut()
			}()
		}
		return true
	})
}

// HandleUserChanged is called whenever we know that a given user has
// changed (and must be cache-busted). It will broadcast the messages
// to all curious listeners.
func (n *NotifyRouter) HandleUserChanged(uid keybase1.UID) {
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.get(id).Users {
			go func() {
				(keybase1.NotifyUsersClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}),
				}).Changed(uid)
			}()
		}
		return true
	})
}
