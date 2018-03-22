package emom

import (
	binary "encoding/binary"
	emom1 "github.com/keybase/client/go/protocol/emom1"
	clockwork "github.com/keybase/clockwork"
	saltpack "github.com/keybase/saltpack"
	context "golang.org/x/net/context"
	sync "sync"
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

func decrypt(ctx context.Context, msgType emom1.MsgType, ae emom1.AuthEnc, key saltpack.BoxPrecomputedSharedKey) ([]byte, error) {
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

type UsersCryptoPackage struct {
	user            User
	serverPublicKey ServerPublicKey
	sessionKey      saltpack.BoxPrecomputedSharedKey
	clock           clockwork.Clock
}

func (u *UsersCryptoPackage) InitClient(ctx context.Context, arg *emom1.Arg, rp *emom1.RequestPlaintext) error {

	if u.sessionKey == nil {
		return nil
	}

	ephemeralKey, err := u.serverPublicKey.key.CreateEphemeralKey()
	if err != nil {
		return err
	}
	ephemeralKID := emom1.KID(ephemeralKey.GetPublicKey().ToKID())

	u.sessionKey = ephemeralKey.Precompute(u.serverPublicKey.key)

	handshake := emom1.Handshake{
		V: 1,
		S: u.serverPublicKey.gen,
		K: ephemeralKID,
	}

	authToken := emom1.AuthToken{
		C: emom1.ToTime(u.clock.Now()),
		D: emom1.KID(u.user.userSigningKey.GetPublicKey().ToKID()),
		K: ephemeralKID,
		U: u.user.uid,
	}

	msg, err := encodeToBytes(authToken)
	if err != nil {
		return err
	}
	sig, err := u.user.userSigningKey.Sign(msg)
	if err != nil {
		return err
	}
	signedAuthToken := emom1.SignedAuthToken{
		T: authToken.Export(),
		S: sig,
	}

	arg.H = &handshake
	rp.F = &signedAuthToken

	return nil
}

func (u *UsersCryptoPackage) SessionKey() saltpack.BoxPrecomputedSharedKey {
	return u.sessionKey
}

func (u *UsersCryptoPackage) InitServerHandshake(_ context.Context, _ emom1.Arg) error {
	return nil
}

func (u *UsersCryptoPackage) InitUserAuth(_ context.Context, _ emom1.Arg, _ emom1.RequestPlaintext) error {
	return nil
}

var _ Cryptoer = (*UsersCryptoPackage)(nil)

type CloudCryptoPackage struct {
	sync.Mutex
	serverKeys           map[emom1.KeyGen]saltpack.BoxSecretKey
	userAuth             func(context.Context, emom1.UID, emom1.KID) error
	importSigningKey     func(context.Context, emom1.KID) (saltpack.SigningPublicKey, error)
	checkReplayAndImport func(context.Context, emom1.KID) (saltpack.BoxPublicKey, error)
	user                 emom1.UID
	sessionKey           saltpack.BoxPrecomputedSharedKey
	clock                clockwork.Clock
}

func (c *CloudCryptoPackage) SessionKey() saltpack.BoxPrecomputedSharedKey {
	c.Lock()
	defer c.Unlock()
	return c.sessionKey
}

func (c *CloudCryptoPackage) InitServerHandshake(ctx context.Context, arg emom1.Arg) error {
	c.Lock()
	defer c.Unlock()
	if c.sessionKey == nil {
		return nil
	}
	if arg.H == nil {
		return NewHandshakeError("expected a handshake, but none given")
	}
	if arg.H.V != 1 {
		return NewHandshakeError("Can only support V1, got %d", arg.H.V)
	}
	userEphemeralKey, err := c.checkReplayAndImport(ctx, arg.H.K)
	if err != nil {
		return err
	}

	key, found := c.serverKeys[arg.H.S]
	if !found {
		return NewHandshakeError("key generation %d not found", arg.H.S)
	}

	c.sessionKey = key.Precompute(userEphemeralKey)

	return nil
}

func (c *CloudCryptoPackage) InitClient(ctx context.Context, arg *emom1.Arg, rp *emom1.RequestPlaintext) error {
	return nil
}

func (c *CloudCryptoPackage) InitUserAuth(ctx context.Context, arg emom1.Arg, rp emom1.RequestPlaintext) error {

	// The user is authed and there's no more auth information coming down. Perfact!
	if c.user != nil && rp.F == nil {
		return nil
	}

	if c.user != nil && rp.F != nil {
		return newUserAuthError("attempt to reauth an already-authed session")
	}

	if arg.H == nil {
		return newUserAuthError("User auth must happen along with the handshake")
	}

	at := emom1.AuthToken{
		C: rp.F.T.C,
		K: arg.H.K,
		U: rp.F.T.U,
	}

	encodedAuthToken, err := encodeToBytes(at)
	if err != nil {
		return err
	}

	userKey, err := c.importSigningKey(ctx, rp.F.T.D)
	if err != nil {
		return err
	}

	err = userKey.Verify(encodedAuthToken, rp.F.S)
	if err != nil {
		return err
	}

	err = c.userAuth(ctx, rp.F.T.U, rp.F.T.D)
	if err != nil {
		return err
	}

	return nil
}

var _ Cryptoer = (*CloudCryptoPackage)(nil)
