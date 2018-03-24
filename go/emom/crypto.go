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

func encrypt(ctx context.Context, msg []byte, msgType emom1.MsgType, n emom1.Seqno, keyer SessionKeyer) (emom1.AuthEnc, error) {
	key, seqno := keyer.LatestSessionKey()
	if key == nil {
		return emom1.AuthEnc{}, NoSessionKeyError
	}
	return emom1.AuthEnc{
		N: n,
		E: key.Box(makeNonce(msgType, n), msg),
		R: seqno,
	}, nil
}

type SessionKeyer interface {
	SessionKeyAt(q emom1.Seqno) saltpack.BoxPrecomputedSharedKey
	LatestSessionKey() (saltpack.BoxPrecomputedSharedKey, emom1.Seqno)
}

func decrypt(ctx context.Context, msgType emom1.MsgType, ae emom1.AuthEnc, keyer SessionKeyer) ([]byte, error) {
	key := keyer.SessionKeyAt(ae.R)
	if key == nil {
		return nil, NoSessionKeyError
	}
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

type BaseCryptoPackage struct {
	sync.Mutex
	// SessionKeys. Seqno=0 is with long-lived server public key. Seqno>0 are with
	// ratcheted server keys, which can later be thrown away.
	sessionKeys        map[emom1.Seqno]saltpack.BoxPrecomputedSharedKey
	ratchetSeqno       emom1.Seqno
	importBoxPublicKey func(context.Context, emom1.KID) (saltpack.BoxPublicKey, error)
}

func (b *BaseCryptoPackage) lockedKeyer() baseCryptoPackageLockedKeyer {
	return baseCryptoPackageLockedKeyer{b}
}

type baseCryptoPackageLockedKeyer struct {
	b *BaseCryptoPackage
}

var _ SessionKeyer = baseCryptoPackageLockedKeyer{}

func (b baseCryptoPackageLockedKeyer) SessionKeyAt(q emom1.Seqno) saltpack.BoxPrecomputedSharedKey {
	return b.b.sessionKeyAt(q)
}

func (b baseCryptoPackageLockedKeyer) LatestSessionKey() (saltpack.BoxPrecomputedSharedKey, emom1.Seqno) {
	return b.b.latestSessionKey()
}

type UsersCryptoPackage struct {
	BaseCryptoPackage
	user            User
	serverPublicKey ServerPublicKey
	clock           clockwork.Clock
	ephemeralKey    saltpack.BoxSecretKey
}

func (u *UsersCryptoPackage) InitClient(ctx context.Context, arg *emom1.Arg, rp *emom1.RequestPlaintext) error {
	u.Lock()
	defer u.Unlock()

	if u.hasSessionKey() {
		return nil
	}

	ephemeralKey, err := u.serverPublicKey.key.CreateEphemeralKey()
	if err != nil {
		return err
	}
	ephemeralKID := emom1.KID(ephemeralKey.GetPublicKey().ToKID())
	u.ephemeralKey = ephemeralKey

	u.setMasterSessionKey(ephemeralKey.Precompute(u.serverPublicKey.key))

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

func (u *BaseCryptoPackage) LatestSessionKey() (saltpack.BoxPrecomputedSharedKey, emom1.Seqno) {
	u.Lock()
	defer u.Unlock()
	return u.latestSessionKey()
}

func (u *BaseCryptoPackage) latestSessionKey() (saltpack.BoxPrecomputedSharedKey, emom1.Seqno) {
	return u.sessionKeys[u.ratchetSeqno], u.ratchetSeqno
}

func (u *BaseCryptoPackage) SessionKeyAt(q emom1.Seqno) saltpack.BoxPrecomputedSharedKey {
	u.Lock()
	defer u.Unlock()
	return u.sessionKeys[q]
}

func (u *BaseCryptoPackage) sessionKeyAt(q emom1.Seqno) saltpack.BoxPrecomputedSharedKey {
	return u.sessionKeys[q]
}

func (u *BaseCryptoPackage) hasSessionKey() bool {
	return u.sessionKeys[emom1.Seqno(0)] != nil
}

func (u *UsersCryptoPackage) ClientRatchet(ctx context.Context, encryptedRatchet emom1.AuthEnc) (err error) {
	u.Lock()
	defer u.Unlock()

	var encodedServerRatchet []byte
	var serverRatchet emom1.ServerRatchet
	var serverEphemeralKey saltpack.BoxPublicKey

	encodedServerRatchet, err = decrypt(ctx, emom1.MsgType_RATCHET, encryptedRatchet, u.lockedKeyer())
	if err != nil {
		return err
	}

	err = decodeFromBytes(&serverRatchet, encodedServerRatchet)
	if err != nil {
		return err
	}

	serverEphemeralKey, err = u.importBoxPublicKey(ctx, serverRatchet.K)
	if err != nil {
		return err
	}

	u.sessionKeys[serverRatchet.R] = u.ephemeralKey.Precompute(serverEphemeralKey)

	if serverRatchet.R > u.ratchetSeqno {
		u.ratchetSeqno = serverRatchet.R
	}

	return nil
}

func (u *UsersCryptoPackage) InitServerHandshake(_ context.Context, _ emom1.Arg) error {
	return nil
}

func (u *UsersCryptoPackage) InitUserAuth(_ context.Context, _ emom1.Arg, _ emom1.RequestPlaintext) error {
	return nil
}

func (c *UsersCryptoPackage) ServerRatchet(ctx context.Context, res *emom1.Res) error {
	return nil
}

var _ Cryptoer = (*UsersCryptoPackage)(nil)

type CloudCryptoPackage struct {
	BaseCryptoPackage
	serverKeys       map[emom1.KeyGen]saltpack.BoxSecretKey
	userAuth         func(context.Context, emom1.UID, emom1.KID) error
	importSigningKey func(context.Context, emom1.KID) (saltpack.SigningPublicKey, error)
	checkReplay      func(context.Context, emom1.KID) error
	user             emom1.UID
	clock            clockwork.Clock
	serverKeyInUse   saltpack.BoxSecretKey
	userKeyInUse     saltpack.BoxPublicKey
}

func (c *BaseCryptoPackage) setMasterSessionKey(k saltpack.BoxPrecomputedSharedKey) {
	c.sessionKeys[emom1.Seqno(0)] = k
}

func (c *CloudCryptoPackage) InitServerHandshake(ctx context.Context, arg emom1.Arg) (err error) {
	c.Lock()
	defer c.Unlock()
	if c.hasSessionKey() {
		return nil
	}
	if arg.H == nil {
		return NewHandshakeError("expected a handshake, but none given")
	}
	if arg.H.V != 1 {
		return NewHandshakeError("Can only support V1, got %d", arg.H.V)
	}
	err = c.checkReplay(ctx, arg.H.K)
	if err != nil {
		return err
	}

	userEphemeralKey, err := c.importBoxPublicKey(ctx, arg.H.K)
	if err != nil {
		return err
	}

	key, found := c.serverKeys[arg.H.S]
	if !found {
		return NewHandshakeError("key generation %d not found", arg.H.S)
	}

	c.serverKeyInUse = key
	c.userKeyInUse = userEphemeralKey
	c.setMasterSessionKey(key.Precompute(userEphemeralKey))

	return nil
}

func (c *CloudCryptoPackage) ServerRatchet(ctx context.Context, res *emom1.Res) error {
	c.Lock()
	defer c.Unlock()
	if c.ratchetSeqno > emom1.Seqno(0) {
		return nil
	}

	nextEphemeralKey, err := c.serverKeyInUse.GetPublicKey().CreateEphemeralKey()
	if err != nil {
		return err
	}
	nextSessionKey := nextEphemeralKey.Precompute(c.userKeyInUse)
	nextSeqno := c.ratchetSeqno + 1

	ratchet := emom1.ServerRatchet{
		K: emom1.KID(nextEphemeralKey.GetPublicKey().ToKID()),
		R: nextSeqno,
	}
	var encodedRatchet []byte
	var encryptedRatchet emom1.AuthEnc

	encodedRatchet, err = encodeToBytes(ratchet)
	if err != nil {
		return err
	}
	encryptedRatchet, err = encrypt(ctx, encodedRatchet, emom1.MsgType_RATCHET, nextSeqno, c.lockedKeyer())
	res.R = &encryptedRatchet
	c.ratchetSeqno = nextSeqno
	c.sessionKeys[nextSeqno] = nextSessionKey

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

func (c *CloudCryptoPackage) ClientRatchet(ctx context.Context, encryptedRatchet emom1.AuthEnc) error {
	return nil
}

var _ Cryptoer = (*CloudCryptoPackage)(nil)
