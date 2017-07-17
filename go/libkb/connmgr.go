// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sort"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// ConnectionID is a sequential integer assigned to each RPC connection
// that this process serves. No IDs are reused.
type ConnectionID int

type addConnectionObj struct {
	xp rpc.Transporter
	ch chan<- ConnectionID
}

type lookupConnectionObj struct {
	id ConnectionID
	ch chan<- rpc.Transporter
}

type labelConnectionObj struct {
	id      ConnectionID
	details keybase1.ClientDetails
	ch      chan<- error
}

type lookupByClientTypeObj struct {
	typ keybase1.ClientType
	ch  chan<- rpc.Transporter
}

// ApplyFn can be applied to every connection. It is called with the
// RPC transporter, and also the connectionID. It should return a bool
// true to keep going and false to stop.
type ApplyFn func(i ConnectionID, xp rpc.Transporter) bool

type rpcConnection struct {
	transporter rpc.Transporter
	details     *keybase1.ClientDetails
}

// ConnectionManager manages all connections active for a given service.
// It can be called from multiple goroutines.
type ConnectionManager struct {
	nxt    ConnectionID
	lookup map[ConnectionID](*rpcConnection)

	addConnectionCh      chan *addConnectionObj
	lookupConnectionCh   chan *lookupConnectionObj
	removeConnectionCh   chan ConnectionID
	applyAllCh           chan ApplyFn
	shutdownCh           chan struct{}
	labelConnectionCh    chan labelConnectionObj
	listAllCh            chan chan<- []keybase1.ClientDetails
	lookupByClientTypeCh chan *lookupByClientTypeObj
}

// AddConnection adds a new connection to the table of Connection object, with a
// related closeListener. We'll listen for a close on that channel, and when one occurs,
// we'll remove the connection from the pool.
func (c *ConnectionManager) AddConnection(xp rpc.Transporter, closeListener chan error) ConnectionID {
	retCh := make(chan ConnectionID)
	c.addConnectionCh <- &addConnectionObj{xp, retCh}
	id := <-retCh
	if closeListener != nil {
		go func() {
			<-closeListener
			c.removeConnectionCh <- id
		}()
	}
	return id
}

// LookupConnection looks up a connection given a connectionID, or returns nil
// if no such connection was found.
func (c *ConnectionManager) LookupConnection(i ConnectionID) rpc.Transporter {
	retCh := make(chan rpc.Transporter)
	c.lookupConnectionCh <- &lookupConnectionObj{i, retCh}
	return <-retCh
}

func (c *ConnectionManager) Shutdown() {
	close(c.shutdownCh)
}

func (c *ConnectionManager) lookupTransporter(i ConnectionID) (ret rpc.Transporter) {
	if conn := c.lookup[i]; conn != nil {
		ret = conn.transporter
	}
	return ret
}

func (c *ConnectionManager) LookupByClientType(clientType keybase1.ClientType) rpc.Transporter {
	retCh := make(chan rpc.Transporter)
	c.lookupByClientTypeCh <- &lookupByClientTypeObj{clientType, retCh}
	return <-retCh
}

func (c *ConnectionManager) Label(id ConnectionID, d keybase1.ClientDetails) error {
	retCh := make(chan error)
	c.labelConnectionCh <- labelConnectionObj{id: id, details: d, ch: retCh}
	return <-retCh
}

func (c *ConnectionManager) hasClientType(clientType keybase1.ClientType) bool {
	for _, con := range c.ListAllLabeledConnections() {
		if clientType == con.ClientType {
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
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if c.hasClientType(clientType) {
				return true
			}
		case <-time.After(timeout):
			return false
		}
	}
}

func (c *ConnectionManager) ListAllLabeledConnections() []keybase1.ClientDetails {
	retCh := make(chan []keybase1.ClientDetails)
	c.listAllCh <- retCh
	return <-retCh
}

type byClientType []keybase1.ClientDetails

func (a byClientType) Len() int           { return len(a) }
func (a byClientType) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byClientType) Less(i, j int) bool { return a[i].ClientType < a[j].ClientType }

func (c *ConnectionManager) listAllLabeledConnections() (ret []keybase1.ClientDetails) {
	for _, v := range c.lookup {
		if v.details != nil {
			ret = append(ret, *v.details)
		}
	}
	sort.Sort(byClientType(ret))
	return ret
}

func (c *ConnectionManager) run() {
	for {
		select {
		case <-c.shutdownCh:
			return
		case addConnectionObj := <-c.addConnectionCh:
			c.nxt++ // increment first, since 0 is reserved
			nxt := c.nxt
			c.lookup[nxt] = &rpcConnection{transporter: addConnectionObj.xp}
			addConnectionObj.ch <- nxt
		case lookupConnectionObj := <-c.lookupConnectionCh:
			lookupConnectionObj.ch <- c.lookupTransporter(lookupConnectionObj.id)
		case id := <-c.removeConnectionCh:
			delete(c.lookup, id)
		case labelConnectionObj := <-c.labelConnectionCh:
			id := labelConnectionObj.id
			var err error
			if conn := c.lookup[id]; conn != nil {
				conn.details = &labelConnectionObj.details
			} else {
				err = NotFoundError{Msg: fmt.Sprintf("connection %d not found", id)}
			}
			labelConnectionObj.ch <- err
		case retCh := <-c.listAllCh:
			retCh <- c.listAllLabeledConnections()
		case lookupByClientTypeObj := <-c.lookupByClientTypeCh:
			var found rpc.Transporter
			for _, v := range c.lookup {
				if v.details != nil && v.details.ClientType == lookupByClientTypeObj.typ {
					found = v.transporter
					break
				}
			}
			lookupByClientTypeObj.ch <- found
		case f := <-c.applyAllCh:
			for k, v := range c.lookup {
				if !f(k, v.transporter) {
					break
				}
			}
		}
	}
}

// ApplyAll applies the given function f to all connections in the table.
// If you're going to do something blocking, please do it in a GoRoutine,
// since we're holding the lock for all connections as we do this.
func (c *ConnectionManager) ApplyAll(f ApplyFn) {
	c.applyAllCh <- f
}

// NewConnectionManager makes a new ConnectionManager and starts its internal
// routing loop running.
func NewConnectionManager() *ConnectionManager {
	ret := &ConnectionManager{
		lookup:               make(map[ConnectionID](*rpcConnection)),
		addConnectionCh:      make(chan *addConnectionObj),
		lookupConnectionCh:   make(chan *lookupConnectionObj),
		removeConnectionCh:   make(chan ConnectionID),
		labelConnectionCh:    make(chan labelConnectionObj),
		applyAllCh:           make(chan ApplyFn),
		listAllCh:            make(chan chan<- []keybase1.ClientDetails),
		shutdownCh:           make(chan struct{}),
		lookupByClientTypeCh: make(chan *lookupByClientTypeObj),
	}
	go ret.run()
	return ret
}
