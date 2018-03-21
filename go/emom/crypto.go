package emom

import (
	binary "encoding/binary"
	emom1 "github.com/keybase/client/go/protocol/emom1"
	clockwork "github.com/keybase/clockwork"
	saltpack "github.com/keybase/saltpack"
	context "golang.org/x/net/context"
)

func makeNonce(msgType emom1.MsgType, n emom1.Seqno) saltpack.Nonce {
	var out saltpack.Nonce
	copy(out[0:16], "encrypted_fmprpc")
	binary.BigEndian.PutUint32(out[12:16], uint32(msgType))
	binary.BigEndian.PutUint64(out[16:], uint64(n))
	return out
}

func encrypt(ctx context.Context, msg []byte, msgType emom1.MsgType, n emom1.Seqno, key saltpack.BoxPrecomputedSharedKey) (emom1.AuthEnc, error) {
	return emom1.AuthEnc{
		N: n,
		E: key.Box(makeNonce(msgType, n), msg),
	}, nil
}

func (c *Client) decrypt(ctx context.Context, msgType emom1.MsgType, ae emom1.AuthEnc, key saltpack.BoxPrecomputedSharedKey) ([]byte, error) {
	return key.Unbox(makeNonce(msgType, ae.N), ae.E)
}

type ServerPublicKey struct {
	gen emom1.KeyGen
	key saltpack.BoxPublicKey
}

type User struct {
	uid            emom1.UID
	userSigningKey saltpack.SigningSecretKey
}

type ClientCryptoPackage struct {
	user            User
	serverPublicKey ServerPublicKey
	sessionKey      saltpack.BoxPrecomputedSharedKey
	clock           clockwork.Clock
}

func (c *ClientCryptoPackage) InitClient(ctx context.Context, arg *emom1.Arg, rp *emom1.RequestPlaintext) error {

	if c.sessionKey == nil {
		return nil
	}

	ephemeralKey, err := c.serverPublicKey.key.CreateEphemeralKey()
	if err != nil {
		return err
	}
	ephemeralKID := emom1.KID(ephemeralKey.GetPublicKey().ToKID())

	c.sessionKey = ephemeralKey.Precompute(c.serverPublicKey.key)

	handshake := emom1.Handshake{
		V: 1,
		S: c.serverPublicKey.gen,
		K: ephemeralKID,
	}

	authToken := emom1.AuthToken{
		C: emom1.ToTime(c.clock.Now()),
		K: ephemeralKID,
		U: c.user.uid,
	}

	msg, err := encodeToBytes(authToken)
	if err != nil {
		return err
	}
	sig, err := c.user.userSigningKey.Sign(msg)
	if err != nil {
		return err
	}
	signedAuthToken := emom1.SignedAuthToken{
		T: authToken,
		D: emom1.KID(c.user.userSigningKey.GetPublicKey().ToKID()),
		S: sig,
	}

	arg.H = &handshake
	rp.F = &signedAuthToken

	return nil
}

func (c *ClientCryptoPackage) SessionKey() saltpack.BoxPrecomputedSharedKey {
	return c.sessionKey
}

var _ Cryptoer = (*ClientCryptoPackage)(nil)
