package libkb

import (
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// ConnectionID is a sequential integer assigned to each RPC connection
// that this process serves. No IDs are reused.
type ConnectionID int

type addConnectionObj struct {
	xp rpc.Transporter
	ch chan<- ConnectionID
}

type lookupConnectionObj struct {
	i  ConnectionID
	ch chan<- rpc.Transporter
}

// ApplyFn can be applied to every connection. It is called with the
// RPC transporter, and also the connectionID. It should return a bool
// true to keep going and false to stop.
type ApplyFn func(i ConnectionID, xp rpc.Transporter) bool

// ConnectionManager manages all connections active for a given service.
// It can be called from multiple goroutines.
type ConnectionManager struct {
	nxt    ConnectionID
	lookup map[ConnectionID]rpc.Transporter

	addConnectionCh    chan *addConnectionObj
	lookupConnectionCh chan *lookupConnectionObj
	removeConnectionCh chan ConnectionID
	applyAllCh         chan ApplyFn
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

func (c *ConnectionManager) run() {
	for {
		select {
		case addConnectionObj := <-c.addConnectionCh:
			nxt := c.nxt
			c.nxt++
			c.lookup[nxt] = addConnectionObj.xp
			addConnectionObj.ch <- nxt
		case lookupConnectionObj := <-c.lookupConnectionCh:
			lookupConnectionObj.ch <- c.lookup[lookupConnectionObj.i]
		case id := <-c.removeConnectionCh:
			delete(c.lookup, id)
		case f := <-c.applyAllCh:
			for k, v := range c.lookup {
				if !f(k, v) {
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
		lookup:             make(map[ConnectionID]rpc.Transporter),
		addConnectionCh:    make(chan *addConnectionObj),
		lookupConnectionCh: make(chan *lookupConnectionObj),
		removeConnectionCh: make(chan ConnectionID),
		applyAllCh:         make(chan ApplyFn),
	}
	go ret.run()
	return ret
}
