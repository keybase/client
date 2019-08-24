// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sort"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// ConnectionID is a sequential integer assigned to each RPC connection
// that this process serves. No IDs are reused.
type ConnectionID int

// ApplyFn can be applied to every connection. It is called with the
// RPC transporter, and also the connectionID. It should return a bool
// true to keep going and false to stop.
type ApplyFn func(i ConnectionID, xp rpc.Transporter) bool

// ApplyDetailsFn can be applied to every connection. It is called with the
// RPC transporter, and also the connectionID. It should return a bool
// true to keep going and false to stop.
type ApplyDetailsFn func(i ConnectionID, xp rpc.Transporter, details *keybase1.ClientDetails) bool

// LabelCb is a callback to be run when a client connects and labels itself.
type LabelCb func(typ keybase1.ClientType)

type rpcConnection struct {
	transporter rpc.Transporter
	details     *keybase1.ClientStatus
}

// ConnectionManager manages all active connections for a given service.
// It can be called from multiple goroutines.
type ConnectionManager struct {
	sync.Mutex
	nxt      ConnectionID
	lookup   map[ConnectionID](*rpcConnection)
	labelCbs []LabelCb
}

// AddConnection adds a new connection to the table of Connection object, with a
// related closeListener. We'll listen for a close on that channel, and when one occurs,
// we'll remove the connection from the pool.
func (c *ConnectionManager) AddConnection(xp rpc.Transporter, closeListener chan error) ConnectionID {
	c.Lock()
	c.nxt++ // increment first, since 0 is reserved
	id := c.nxt
	c.lookup[id] = &rpcConnection{transporter: xp}
	c.Unlock()

	if closeListener != nil {
		go func() {
			<-closeListener
			c.removeConnection(id)
		}()
	}

	return id
}

func (c *ConnectionManager) removeConnection(id ConnectionID) {
	c.Lock()
	delete(c.lookup, id)
	c.Unlock()
}

// LookupConnection looks up a connection given a connectionID, or returns nil
// if no such connection was found.
func (c *ConnectionManager) LookupConnection(i ConnectionID) rpc.Transporter {
	c.Lock()
	defer c.Unlock()
	if conn := c.lookup[i]; conn != nil {
		return conn.transporter
	}
	return nil
}

func (c *ConnectionManager) Shutdown() {
}

func (c *ConnectionManager) LookupByClientType(clientType keybase1.ClientType) rpc.Transporter {
	c.Lock()
	defer c.Unlock()
	for _, v := range c.lookup {
		if v.details != nil && v.details.Details.ClientType == clientType {
			return v.transporter
		}
	}
	return nil
}

func (c *ConnectionManager) Label(id ConnectionID, d keybase1.ClientDetails) error {
	c.Lock()
	defer c.Unlock()

	var err error
	if conn := c.lookup[id]; conn != nil {
		conn.details = &keybase1.ClientStatus{
			Details:      d,
			ConnectionID: int(id),
		}
	} else {
		err = NotFoundError{Msg: fmt.Sprintf("connection %d not found", id)}
	}

	// Hit all the callbacks with the client type
	for _, lloop := range c.labelCbs {
		go func(l LabelCb) { l(d.ClientType) }(lloop)
	}

	return err
}

func (c *ConnectionManager) RegisterLabelCallback(f LabelCb) {
	c.Lock()
	c.labelCbs = append(c.labelCbs, f)
	c.Unlock()
}

func (c *ConnectionManager) hasClientType(clientType keybase1.ClientType) bool {
	for _, con := range c.ListAllLabeledConnections() {
		if clientType == con.Details.ClientType {
			return true
		}
	}
	return false
}

// WaitForClientType returns true if client type is connected, or waits until timeout for the connection
func (c *ConnectionManager) WaitForClientType(clientType keybase1.ClientType, timeout time.Duration) bool {
	if c.hasClientType(clientType) {
		return true
	}
	ticker := time.NewTicker(time.Second)
	deadline := time.After(timeout)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if c.hasClientType(clientType) {
				return true
			}
		case <-deadline:
			return false
		}
	}
}

func (c *ConnectionManager) ListAllLabeledConnections() (ret []keybase1.ClientStatus) {
	c.Lock()
	defer c.Unlock()
	for _, v := range c.lookup {
		if v.details != nil {
			ret = append(ret, *v.details)
		}
	}
	sort.Sort(byClientType(ret))
	return ret
}

type byClientType []keybase1.ClientStatus

func (a byClientType) Len() int           { return len(a) }
func (a byClientType) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byClientType) Less(i, j int) bool { return a[i].Details.ClientType < a[j].Details.ClientType }

// ApplyAll applies the given function f to all connections in the table.
// If you're going to do something blocking, please do it in a GoRoutine,
// since we're holding the lock for all connections as we do this.
func (c *ConnectionManager) ApplyAll(f ApplyFn) {
	c.Lock()
	defer c.Unlock()
	for k, v := range c.lookup {
		if !f(k, v.transporter) {
			break
		}
	}
}

// ApplyAllDetails applies the given function f to all connections in the table.
// If you're going to do something blocking, please do it in a GoRoutine,
// since we're holding the lock for all connections as we do this.
func (c *ConnectionManager) ApplyAllDetails(f ApplyDetailsFn) {
	c.Lock()
	defer c.Unlock()
	for k, v := range c.lookup {
		status := v.details
		var details *keybase1.ClientDetails
		if status != nil {
			details = &status.Details
		}
		if !f(k, v.transporter, details) {
			break
		}
	}
}

// NewConnectionManager makes a new ConnectionManager.
func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		lookup: make(map[ConnectionID](*rpcConnection)),
	}
}
