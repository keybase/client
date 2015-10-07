package rpc2

type Client struct {
	xp          Transporter
	unwrapError UnwrapErrorFunc
}

func NewClient(xp Transporter, f UnwrapErrorFunc) *Client {
	return &Client{xp, f}
}

func (c *Client) Call(method string, arg interface{}, res interface{}) (err error) {
	var d Dispatcher
	if d, err = c.xp.GetDispatcher(); err == nil {
		err = d.Call(method, arg, res, c.unwrapError)
	}
	return
}
