package libkbfs

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net"
	"sync"
	"time"

	"github.com/cenkalti/backoff"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/net/context"
)

// ConnectionHandler is the callback interface for interacting with the connection.
type ConnectionHandler interface {
	// OnConnect is called immediately after a connection has been established.
	// An implementation would likely log something and/or perform authentication.
	OnConnect(context.Context, *Connection, keybase1.GenericClient) error

	// OnConnectError is called whenever there is an error during connection.
	OnConnectError(err error, reconnectThrottleDuration time.Duration)

	// OnDisconnected is called whenever the connection notices it is disconnected.
	OnDisconnected()

	// ShouldThrottle is called whenever an error is returned by
	// an RPC function passed to Connection.DoCommand(), and
	// should return whether or not that error signifies that that
	// RPC is throttled.
	ShouldThrottle(error) bool
}

// ConnectionTransportTLS is a ConnectionTransport implementation that uses TLS+rpc2.
type ConnectionTransportTLS struct {
	config          Config
	unwrapErrFunc   rpc2.UnwrapErrorFunc
	transport       *rpc2.Transport
	stagedTransport *rpc2.Transport
	server          *rpc2.Server
	conn            net.Conn
	mutex           sync.Mutex // protects transport and server
}

// Test that ConnectionTransportTLS fully implements the ConnectionTransport interface.
var _ ConnectionTransport = (*ConnectionTransportTLS)(nil)

// Dial is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Dial(ctx context.Context, srvAddr string) (
	keybase1.GenericClient, error) {
	var err error
	err = runUnlessCanceled(ctx, func() error {
		// load CA certificate
		certs := x509.NewCertPool()
		if !certs.AppendCertsFromPEM(ct.config.RootCerts()) {
			return errors.New("Unable to load root certificates")
		}
		// connect
		config := tls.Config{RootCAs: certs}
		ct.conn, err = tls.Dial("tcp", srvAddr, &config)
		return err
	})
	if err != nil {
		return nil, err
	}

	ct.stagedTransport = rpc2.NewTransport(ct.conn, libkb.NewRPCLogFactory(), libkb.WrapError)
	client := rpc2.NewClient(ct.stagedTransport, ct.unwrapErrFunc)
	return client, nil
}

// Serve is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Serve(server rpc2.Protocol) error {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	if ct.server != nil {
		return nil
	}
	ct.server = rpc2.NewServer(ct.transport, libkb.WrapError)
	err := ct.server.Register(server)
	if err != nil {
		return err
	}
	return ct.server.Run(true)
}

// IsConnected is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) IsConnected() bool {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	return ct.transport != nil && ct.transport.IsConnected()
}

// Finalize is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Finalize() {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	ct.transport = ct.stagedTransport
	ct.stagedTransport = nil
	ct.server = nil
}

// Close is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Close() {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	if ct.conn != nil {
		ct.conn.Close()
	}
}

// Connection encapsulates all client connection handling.
type Connection struct {
	config    Config
	srvAddr   string
	handler   ConnectionHandler
	transport ConnectionTransport

	mutex         sync.Mutex // protects: client, reconnectChan, and cancelFunc
	client        keybase1.GenericClient
	reconnectChan chan struct{}
	cancelFunc    context.CancelFunc // used to cancel the reconnect loop
}

// NewConnection returns a newly connected connection.
func NewConnection(ctx context.Context, config Config, srvAddr string,
	handler ConnectionHandler, errFunc rpc2.UnwrapErrorFunc) *Connection {
	transport := &ConnectionTransportTLS{config: config, unwrapErrFunc: errFunc}
	return newConnectionWithTransport(ctx, config, srvAddr, handler, transport)
}

// Separate from NewConnection to allow for unit testing.
func newConnectionWithTransport(ctx context.Context, config Config, srvAddr string,
	handler ConnectionHandler, transport ConnectionTransport) *Connection {
	connection := &Connection{
		srvAddr:   srvAddr,
		config:    config,
		handler:   handler,
		transport: transport,
	}
	connection.getReconnectChan() // start connecting
	return connection
}

// connect performs the actual connect() and rpc setup.
func (c *Connection) connect(ctx context.Context) error {
	// connect
	client, err := c.transport.Dial(ctx, c.srvAddr)
	if err != nil {
		return err
	}

	// call the connect handler
	err = c.handler.OnConnect(ctx, c, client)
	if err != nil {
		return err
	}

	// set the client for other callers.
	// we wait to do this so the handler has time to do
	// any setup required, e.g. authenticate.
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.client = client
	c.transport.Finalize()

	return nil
}

// DoCommand executes the specific rpc command wrapped in rpcFunc.
func (c *Connection) DoCommand(ctx context.Context, rpcFunc func() error) error {
	for {
		// we may or may not be in the process of reconnecting.
		// if so we'll block here unless canceled by the caller.
		connErr := c.waitForConnection(ctx)
		if connErr != nil {
			return connErr
		}

		var rpcErr error

		// retry throttle errors w/backoff
		throttleErr := backoff.RetryNotify(func() error {
			// try the rpc call. this can also be canceled
			// by the caller, and will retry connectivity
			// errors w/backoff.
			throttleErr := runUnlessCanceled(ctx, rpcFunc)
			if c.handler.ShouldThrottle(throttleErr) {
				return throttleErr
			}
			rpcErr = throttleErr
			return nil
		}, backoff.NewExponentialBackOff(),
			func(err error, nextTime time.Duration) {
				c.config.MakeLogger("").Warning(
					"error: %q; will retry in %s",
					err, nextTime)
			})
		// RetryNotify gave up.
		if throttleErr != nil {
			return throttleErr
		}

		// check to see if we need to retry it.
		if !c.checkForRetry(rpcErr) {
			return rpcErr
		}
	}
}

// Blocks until a connnection is ready for use or the context is canceled.
func (c *Connection) waitForConnection(ctx context.Context) error {
	if c.IsConnected() {
		// already connected
		return nil
	}
	// inform the handler of our disconnected state
	c.handler.OnDisconnected()
	// kick-off a connection and wait for it to complete
	// or for the caller to cancel.
	reconnectChan := c.getReconnectChan()
	select {
	case <-ctx.Done():
		// caller canceled
		return ctx.Err()
	case <-reconnectChan:
		// reconnect complete
		return nil
	}
}

// Returns true if the error indicates we should retry the command.
func (c *Connection) checkForRetry(err error) bool {
	if err == nil {
		return false
	}
	_, disconnected := err.(rpc2.DisconnectedError)
	_, eof := err.(rpc2.EofError)
	return disconnected || eof
}

// IsConnected returns true if the connection is connected.
func (c *Connection) IsConnected() bool {
	return c.transport.IsConnected()
}

// This will either kick-off a new reconnection attempt or wait for an
// existing attempt. Returns the channel associated with an attempt.
func (c *Connection) getReconnectChan() chan struct{} {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	if c.reconnectChan == nil {
		var ctx context.Context
		// for canceling the reconnect loop via Shutdown()
		ctx, c.cancelFunc = context.WithCancel(context.Background())
		c.reconnectChan = make(chan struct{}, 20)
		go c.doReconnect(ctx, c.reconnectChan)
	}
	return c.reconnectChan
}

// doReconnect attempts a reconnection.
func (c *Connection) doReconnect(ctx context.Context, reconnectChan chan struct{}) {
	// retry w/exponential backoff
	backoff.RetryNotify(func() error {
		// try to connect
		err := c.connect(ctx)
		// context was canceled by Shutdown()
		if ctx.Err() != nil {
			c.handler = nil // drop the circular reference
			// short-circuit Retry
			return nil
		}
		return err
	}, backoff.NewExponentialBackOff(),
		// give the caller a chance to log any other error or adjust state
		c.handler.OnConnectError)

	// close the reconnect channel to signal we're connected.
	c.mutex.Lock()
	defer c.mutex.Unlock()
	close(reconnectChan)
	c.reconnectChan = nil
	c.cancelFunc = nil
}

// GetClient is called to retrieve an rpc client suitable for use by the caller.
func (c *Connection) GetClient() keybase1.GenericClient {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	return c.client
}

// Serve is called to act as a server for an upstream client.
func (c *Connection) Serve(server rpc2.Protocol) error {
	return c.transport.Serve(server)
}

// Shutdown cancels any reconnect loop in progress.
// Calling this invalidates the connection object.
func (c *Connection) Shutdown() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	// cancel any reconnect loop
	if c.cancelFunc != nil {
		c.cancelFunc()
	}
	if c.transport != nil {
		// close the connection
		c.transport.Close()
	}
}
