package libkbfs

import (
	"crypto/sha256"
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CryptoClient struct {
	ctx    *libkb.GlobalContext
	client keybase1.GenericClient
}

func NewCryptoClient(ctx *libkb.GlobalContext) (*CryptoClient, error) {
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
	return newCryptoClientWithClient(ctx, client), nil
}

// For testing.
func newCryptoClientWithClient(ctx *libkb.GlobalContext, client keybase1.GenericClient) *CryptoClient {
	return &CryptoClient{ctx, client}
}

func (c *CryptoClient) Sign(msg []byte) (sig []byte, verifyingKeyKid KID, err error) {
	defer func() {
		libkb.G.Log.Debug("Signing %d-byte message with %d-byte signature and verifying key %s: err=%v", len(msg), len(sig), libkb.KID(verifyingKeyKid), err)
	}()
	cc := keybase1.CryptoClient{c.client}
	sigInfo, err := cc.Sign(keybase1.SignArg{
		SessionID: 0,
		Msg:       msg,
		Reason:    "to use kbfs",
	})
	if err != nil {
		return
	}

	verifyingKeyLibkbKid, err := libkb.ImportKID(sigInfo.VerifyingKeyKid)
	if err != nil {
		return
	}

	sig = sigInfo.Sig
	verifyingKeyKid = KID(verifyingKeyLibkbKid)
	return
}

func (c *CryptoClient) Verify(sig []byte, msg []byte, verifyingKey Key) (err error) {
	defer func() {
		libkb.G.Log.Debug("Verifying %d-byte message with %d-byte signature: err=%v", len(msg), len(sig), err)
	}()
	return verifyingKey.VerifyBytes(sig, msg)
}

func (c *CryptoClient) Box(privkey Key, pubkey Key, buf []byte) ([]byte, error) {
	return buf, nil
}

func (c *CryptoClient) Unbox(pubkey Key, buf []byte) ([]byte, error) {
	return buf, nil
}

func (c *CryptoClient) Encrypt(buf []byte, key Key) ([]byte, error) {
	return buf, nil
}

func (c *CryptoClient) Decrypt(buf []byte, key Key) ([]byte, error) {
	return buf, nil
}

func (c *CryptoClient) Hash(buf []byte) (libkb.NodeHash, error) {
	h := sha256.New()
	h.Write(buf)
	var tmp libkb.NodeHashShort
	copy([]byte(tmp[:]), h.Sum(nil))
	return tmp, nil
}

func (c *CryptoClient) VerifyHash(buf []byte, hash libkb.NodeHash) error {
	// TODO: for now just call Hash and throw an error if it doesn't match hash
	return nil
}

func (c *CryptoClient) SharedSecret(key1 Key, key2 Key) (Key, error) {
	return nil, nil
}

func (c *CryptoClient) HMAC(secret Key, buf []byte) (HMAC, error) {
	return []byte{42}, nil
}

func (c *CryptoClient) VerifyHMAC(secret Key, buf []byte, hmac HMAC) error {
	return nil
}

func (c *CryptoClient) XOR(key1 Key, key2 Key) (Key, error) {
	return nil, nil
}

func (c *CryptoClient) GenRandomSecretKey() Key {
	return nil
}

func (c *CryptoClient) GenCurveKeyPair() (pubkey Key, privkey Key) {
	return nil, nil
}
