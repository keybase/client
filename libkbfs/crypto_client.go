package libkbfs

import (
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CryptoClient struct {
	CryptoCommon
	ctx    *libkb.GlobalContext
	client keybase1.GenericClient
}

var _ Crypto = (*CryptoClient)(nil)

func NewCryptoClient(codec Codec, ctx *libkb.GlobalContext) (*CryptoClient, error) {
	_, xp, err := ctx.GetSocket()
	if err != nil {
		return nil, err
	}

	srv := rpc2.NewServer(xp, libkb.WrapError)

	protocols := []rpc2.Protocol{
		client.NewSecretUIProtocol(),
	}

	for _, p := range protocols {
		if err := srv.Register(p); err != nil {
			if _, ok := err.(rpc2.AlreadyRegisteredError); !ok {
				return nil, err
			}
		}
	}

	client := rpc2.NewClient(xp, libkb.UnwrapError)
	return newCryptoClientWithClient(codec, ctx, client), nil
}

// For testing.
func newCryptoClientWithClient(codec Codec, ctx *libkb.GlobalContext, client keybase1.GenericClient) *CryptoClient {
	return &CryptoClient{CryptoCommon{codec}, ctx, client}
}

func (c *CryptoClient) Sign(msg []byte) (sig []byte, verifyingKey VerifyingKey, err error) {
	defer func() {
		libkb.G.Log.Debug("Signing %d-byte message with %d-byte signature and verifying key %s: err=%v", len(msg), len(sig), verifyingKey.KID, err)
	}()
	cc := keybase1.CryptoClient{Cli: c.client}
	sigInfo, err := cc.Sign(keybase1.SignArg{
		SessionID: 0,
		Msg:       msg,
		Reason:    "to use kbfs",
	})
	if err != nil {
		return
	}

	kid, err := libkb.ImportKID(sigInfo.VerifyingKeyKid)
	if err != nil {
		return
	}

	verifyingKey = VerifyingKey{kid}
	sig = sigInfo.Sig
	return
}

func (c *CryptoClient) Verify(sig []byte, msg []byte, verifyingKey VerifyingKey) (err error) {
	defer func() {
		libkb.G.Log.Debug("Verifying %d-byte message with %d-byte signature: err=%v", len(msg), len(sig), err)
	}()
	verifier, err := newVerifier(verifyingKey)
	if err != nil {
		return err
	}
	return verifier.VerifyBytes(sig, msg)
}
