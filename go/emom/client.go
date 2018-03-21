package emom

import (
	emom1 "github.com/keybase/client/go/protocol/emom1"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	saltpack "github.com/keybase/saltpack"
	context "golang.org/x/net/context"
	sync "sync"
)

type ServerPublicKey struct {
	gen emom1.KeyGen
	key saltpack.BoxPublicKey
}

type User struct {
	uid            emom1.UID
	userSigningKey saltpack.SigningSecretKey
}

type Client struct {
	sync.Mutex
	user            User
	serverPublicKey ServerPublicKey
	cli             *rpc.Client
	aeClient        emom1.AeClient
	seqno           emom1.Seqno
	xp              rpc.Transporter
	sentChan        chan rpc.SeqNumber
}

func NewClient(xp rpc.Transporter, user User, server ServerPublicKey) *Client {
	ch := make(chan rpc.SeqNumber)
	f := func(s rpc.SeqNumber) {
		ch <- s
	}
	cli := rpc.NewClientWithSendNotifier(xp, nil, nil, f)
	return &Client{
		user:            user,
		serverPublicKey: server,
		cli:             cli,
		aeClient:        emom1.AeClient{Cli: cli},
		seqno:           emom1.Seqno(0),
		xp:              xp,
		sentChan:        ch,
	}
}

func (c *Client) encodeToBytes(arg interface{}) []byte {
	return []byte{'x'}
}

func (c *Client) encrypt(ctx context.Context, msgType emom1.MsgType, n emom1.Seqno, arg interface{}) emom1.AuthEnc {
	return emom1.AuthEnc{
		N: n,
	}
}

func (c *Client) decrypt(ctx context.Context, msgType emom1.MsgType, n emom1.Seqno, ae emom1.AuthEnc) ([]byte, error) {
	return nil, nil
}

func (c *Client) decodeFromBytes(res interface{}, b []byte) error {
	return nil
}

func (c *Client) Call(ctx context.Context, method string, arg interface{}, res interface{}) (err error) {
	var warg emom1.Arg
	var wres emom1.Res
	c.Lock()
	doneCh := make(chan struct{})
	seqno := c.seqno
	c.seqno++

	rp := emom1.RequestPlaintext{
		S: &seqno,
		N: method,
		A: c.encodeToBytes(arg),
	}

	if c.seqno == emom1.Seqno(0) {
		warg.H, rp.F, err = c.doHandshake(ctx)
		if err != nil {
			return err
		}
	}

	warg.A = c.encrypt(ctx, emom1.MsgType_CALL, seqno, rp)

	go func() {
		wres, err = c.aeClient.C(ctx, warg)
		doneCh <- struct{}{}
	}()
	<-c.sentChan
	c.Unlock()

	<-doneCh

	bres, err := c.decrypt(ctx, emom1.MsgType_REPLY, seqno, wres.A)
	if err != nil {
		return err
	}

	err = c.decodeFromBytes(res, bres)

	return err
}

func (c *Client) doHandshake(ctx context.Context) (*emom1.Handshake, *emom1.SignedAuthToken, error) {
	return nil, nil, nil
}

func (c *Client) Notify(ctx context.Context, method string, arg interface{}) error {
	return nil
}

var _ rpc.GenericClient = (*Client)(nil)
