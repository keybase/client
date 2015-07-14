package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/net/context"
)

// KBPKIClient uses rpc calls to daemon
type KBPKIClient struct {
	ctx    *libkb.GlobalContext
	client keybase1.GenericClient
}

var _ KBPKI = (*KBPKIClient)(nil)

// NewKBPKIClient creates a KBPKIClient.
func NewKBPKIClient(ctx *libkb.GlobalContext) (*KBPKIClient, error) {
	_, xp, err := ctx.GetSocket()
	if err != nil {
		return nil, err
	}

	srv := rpc2.NewServer(xp, libkb.WrapError)

	protocols := []rpc2.Protocol{
		client.NewLogUIProtocol(),
		client.NewIdentifyUIProtocol(),
	}

	for _, p := range protocols {
		if err := srv.Register(p); err != nil {
			if _, ok := err.(rpc2.AlreadyRegisteredError); !ok {
				return nil, err
			}
		}
	}

	client := rpc2.NewClient(xp, libkb.UnwrapError)
	return newKBPKIClientWithClient(ctx, client), nil
}

// For testing.
func newKBPKIClientWithClient(ctx *libkb.GlobalContext, client keybase1.GenericClient) *KBPKIClient {
	return &KBPKIClient{ctx, client}
}

// ResolveAssertion implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) ResolveAssertion(ctx context.Context, username string) (
	*libkb.User, error) {
	arg := &engine.IDEngineArg{UserAssertion: username}
	// TODO: Consider caching the returned public key info from
	// identify instead of dropping them.
	user, _, err := k.identify(ctx, arg)
	return user, err
}

// GetUser implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetUser(ctx context.Context, uid keybase1.UID) (
	user *libkb.User, err error) {
	user, _, err = k.identifyByUID(ctx, uid)
	return user, err
}

// GetSession implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetSession(ctx context.Context) (*libkb.Session, error) {
	s, _, err := k.session(ctx)
	if err != nil {
		// XXX shouldn't ignore this...
		libkb.G.Log.Warning("error getting session: %q", err)
		return nil, err
	}
	return s, nil
}

// GetLoggedInUser implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetLoggedInUser(ctx context.Context) (
	uid keybase1.UID, error error) {
	s, _, err := k.session(ctx)
	if err != nil {
		// TODO: something more intelligent; maybe just shut down
		// unless we want anonymous browsing of public data
		return
	}
	uid = s.GetUID()
	libkb.G.Log.Info("logged in user uid = %s", uid)
	return
}

// HasVerifyingKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) HasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey) error {
	_, publicKeys, err := k.identifyByUID(ctx, uid)
	if err != nil {
		return err
	}

	for _, publicKey := range publicKeys {
		if !publicKey.IsSibkey || len(publicKey.PGPFingerprint) > 0 {
			continue
		}
		if verifyingKey.KID.Equal(publicKey.KID) {
			libkb.G.Log.Debug("found verifying key %s for user %s", verifyingKey.KID, uid)
			return nil
		}
	}

	return KeyNotFoundError{verifyingKey.KID}
}

// GetCryptPublicKeys implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCryptPublicKeys(ctx context.Context,
	uid keybase1.UID) (keys []CryptPublicKey, err error) {
	_, publicKeys, err := k.identifyByUID(ctx, uid)
	if err != nil {
		return nil, err
	}

	keys = make([]CryptPublicKey, 0, len(publicKeys))
	for _, publicKey := range publicKeys {
		if publicKey.IsSibkey || len(publicKey.PGPFingerprint) > 0 {
			continue
		}
		key, err := libkb.ImportKeypairFromKID(publicKey.KID)
		if err != nil {
			return nil, err
		}
		libkb.G.Log.Debug("got crypt public key %s for user %s", key.VerboseDescription(), uid)
		keys = append(keys, CryptPublicKey{key.GetKID()})
	}

	return keys, nil
}

// GetCurrentCryptPublicKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentCryptPublicKey(ctx context.Context) (
	CryptPublicKey, error) {
	_, deviceSubkey, err := k.session(ctx)
	if err != nil {
		return CryptPublicKey{}, err
	}
	libkb.G.Log.Debug("got device subkey %s", deviceSubkey.GetKID().ToShortIDString())
	return CryptPublicKey{deviceSubkey.GetKID()}, nil
}

func (k *KBPKIClient) identify(ctx context.Context, arg *engine.IDEngineArg) (
	*libkb.User, []keybase1.PublicKey, error) {

	ch := make(chan error, 1) // buffered, in case the request is canceled
	var res keybase1.IdentifyRes
	go func() {
		c := keybase1.IdentifyClient{Cli: k.client}
		var err error
		res, err = c.Identify(arg.Export())
		ch <- err
	}()

	select {
	case <-ctx.Done():
		return nil, nil, ctx.Err()
	case err := <-ch:
		if err != nil {
			return nil, nil, err
		}
	}

	return libkb.NewUserThin(res.User.Username, keybase1.UID(res.User.Uid)), res.User.PublicKeys, nil
}

func (k *KBPKIClient) identifyByUID(ctx context.Context, uid keybase1.UID) (
	*libkb.User, []keybase1.PublicKey, error) {
	arg := &engine.IDEngineArg{UserAssertion: fmt.Sprintf("uid:%s", uid)}
	return k.identify(ctx, arg)
}

func (k *KBPKIClient) session(ctx context.Context) (
	session *libkb.Session, deviceSubkey libkb.GenericKey, err error) {
	ch := make(chan error, 1) // buffered, in case the request is canceled
	var res keybase1.Session

	go func() {
		c := keybase1.SessionClient{Cli: k.client}
		const sessionID = 0
		var err error
		res, err = c.CurrentSession(sessionID)
		ch <- err
	}()

	select {
	case <-ctx.Done():
		err = ctx.Err()
		return
	case err = <-ch:
		if err != nil {
			return
		}
	}

	deviceSubkey, err = libkb.ImportKeypairFromKID(res.DeviceSubkeyKid)
	if err != nil {
		return
	}

	session = libkb.NewSessionThin(keybase1.UID(res.Uid), res.Username, res.Token)
	return
}
