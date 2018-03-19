package emom

import (
	emom1 "github.com/keybase/client/go/protocol/emom1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/saltpack"
	context "golang.org/x/net/context"
)

type Client struct {
	uid             emom1.UID
	userSigningKey  saltpack.SigningSecretKey
	serverPublicKey saltpack.BoxPublicKey
	aeClient        emom1.AeClient
	seqno           emom1.Seqno
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
