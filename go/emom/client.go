package emom

import (
	context "golang.org/x/net/context"
	emom1 "github.com/keybase/client/go/protocol/emom1"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	saltpack "github.com/keybase/saltpack"
	sync "sync"
)

type ServerPublicKey struct {
	gen emom1.KeyGen
	key saltpack.BoxPublicKey
}

type User struct {
	uid             emom1.UID
	userSigningKey  saltpack.SigningSecretKey
}

type Client struct {
	sync.Mutex
	user  			User
	serverPublicKey ServerPublicKey
	cli  rpc.Client
	aeClient        emom1.AeClient
	seqno           emom1.Seqno
	xp				rpc.Transporter
    sentChan chan rpc.SeqNumber
}

func NewClient(xp rpc.Transporter, user User, server ServerPublicKey) *Client {
	ch := make(chan rpc.Seqno)
	f := func (s rpc.Seqno) {
    	ch <- s
    }
    cli := rpc.NewclientWithSendNotifier(xp, nil, nil, f)
	return &Client{
		user : user,
		serverPublicKey : server,
		cli : cli,
		aeClient : emom1.AeClient{Cli : cli},
		seqno : 0,
		xp : xp,
		sentChan : ch,
	}
}

func(c *Client) Call(ctx context.Context, method string, arg interface{}, res interface{}) (err error) {
        c.Lock()
        doneCh := make(chan struct{})
        seqno := c.seqno
        c.seqno++
        go func() {
                myArg := someFunc(seqno, arg)
                err = c.baseClient.Call(ctx, method, myArg, res)
                doneCh <- struct{}{}
        }()
        <-c.sentChan
        c.Unlock()
        <-doneCh
        return err
}


func (c *Client) Call(ctx context.Context, method string, arg interface{}, res interface{}) error {
	var arg emom1.Arg
	if seqno == emom1.Seqno(0) {
		arg.H, err = c.doHandshake(ctx)
		if err != nil {
			return err
		}
	}

	_, err := c.aeClient.C(ctx, arg)
	if err != nil {
		return err
	}
	return nil
}

func (c *Client) doHandshake(ctx context.Context) (*emom1.Handshake, error) {
	return nil, nil
}

func (c *Client) Notify(ctx context.Context, method string, arg interface{}) error {
	return nil
}

var _ rpc.GenericClient = (*Client)(nil)
