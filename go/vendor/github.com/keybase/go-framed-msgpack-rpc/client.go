package rpc

import (
	"errors"

	"golang.org/x/net/context"
)

// Client allows calls and notifies on the given transporter, or any protocol
// type. All will share the same ErrorUnwrapper hook for unwrapping incoming
// msgpack objects and converting to possible Go-native `Error` types
type Client struct {
	xp             Transporter
	errorUnwrapper ErrorUnwrapper
}

// NewClient constructs a new client from the given RPC Transporter and the
// ErrorUnwrapper.
func NewClient(xp Transporter, u ErrorUnwrapper) *Client {
	return &Client{xp, u}
}

// Call makes an msgpack RPC call over the transports that's bound to this
// client. The name of the method, and the argument are given. On reply,
// the result field will be populated (if applicable). It returns an Error
// on error, where the error might have been unwrapped from Msgpack via the
// UnwrapErrorFunc in this client.
func (c *Client) Call(ctx context.Context, method string, arg interface{}, res interface{}) (err error) {
	if ctx == nil {
		return errors.New("No Context provided for this call")
	}
	var d dispatcher
	c.xp.RunAsync()
	if d, err = c.xp.getDispatcher(); err == nil {
		err = d.Call(ctx, method, arg, res, c.errorUnwrapper)
	}
	return
}

// Notify notifies the server, with the given method and argument. It does not
// wait to hear back for an error. An error might happen in sending the call, in
// which case a native Go Error is returned. The UnwrapErrorFunc in the underlying
// client isn't relevant in this case.
func (c *Client) Notify(ctx context.Context, method string, arg interface{}) (err error) {
	if ctx == nil {
		return errors.New("No Context provided for this notification")
	}
	var d dispatcher
	c.xp.RunAsync()
	if d, err = c.xp.getDispatcher(); err == nil {
		err = d.Notify(ctx, method, arg)
	}
	return
}
