package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/net/context"
)

// KBPKIClient uses rpc calls to daemon
type KBPKIClient struct {
	client keybase1.GenericClient
	log    logger.Logger
}

var _ KBPKI = (*KBPKIClient)(nil)

// NewKBPKIClient creates a KBPKIClient.
func NewKBPKIClient(ctx *libkb.GlobalContext, log logger.Logger) (
	*KBPKIClient, error) {
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
	return newKBPKIClientWithClient(client, log), nil
}

// For testing.
func newKBPKIClientWithClient(client keybase1.GenericClient,
	log logger.Logger) *KBPKIClient {
	return &KBPKIClient{client, log}
}

// GetCurrentToken implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentToken(ctx context.Context) (string, error) {
	s, _, err := k.session(ctx)
	if err != nil {
		// XXX shouldn't ignore this...
		k.log.CWarningf(ctx, "error getting session: %q", err)
		return "", err
	}
	return s.GetToken(), nil
}

// GetCurrentUID implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentUID(ctx context.Context) (keybase1.UID, error) {
	s, _, err := k.session(ctx)
	if err != nil {
		// TODO: something more intelligent; maybe just shut down
		// unless we want anonymous browsing of public data
		return keybase1.UID(""), err
	}
	uid := s.GetUID()
	k.log.CInfof(ctx, "logged in user uid = %s", uid)
	return uid, nil
}

// GetCurrentCryptPublicKey implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) GetCurrentCryptPublicKey(ctx context.Context) (
	CryptPublicKey, error) {
	_, deviceSubkey, err := k.session(ctx)
	if err != nil {
		return CryptPublicKey{}, err
	}
	k.log.CDebugf(ctx, "got device subkey %s",
		deviceSubkey.GetKID().ToShortIDString())
	return CryptPublicKey{deviceSubkey.GetKID()}, nil
}

// ResolveAssertion implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) ResolveAssertion(ctx context.Context, username string) (
	keybase1.UID, error) {
	arg := &engine.IDEngineArg{UserAssertion: username}
	// TODO: Consider caching the returned public key info from
	// identify instead of dropping them.
	user, _, err := k.identify(ctx, arg)
	if err != nil {
		return keybase1.UID(""), err
	}
	return user.GetUID(), nil
}

// GetNormalizedUsername implements the KBPKI interface for
// KBPKIClient.
func (k *KBPKIClient) GetNormalizedUsername(ctx context.Context, uid keybase1.UID) (
	libkb.NormalizedUsername, error) {
	user, _, err := k.identifyByUID(ctx, uid)
	if err != nil {
		return libkb.NormalizedUsername(""), err
	}
	return user.GetNormalizedName(), nil
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
			k.log.CDebugf(ctx, "found verifying key %s for user %s",
				verifyingKey.KID, uid)
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
		k.log.CDebugf(ctx, "got crypt public key %s for user %s",
			key.VerboseDescription(), uid)
		keys = append(keys, CryptPublicKey{key.GetKID()})
	}

	return keys, nil
}

func (k *KBPKIClient) identify(ctx context.Context, arg *engine.IDEngineArg) (
	*libkb.User, []keybase1.PublicKey, error) {
	var res keybase1.IdentifyRes
	f := func() error {
		c := keybase1.IdentifyClient{Cli: k.client}
		var err error
		res, err = c.Identify(arg.Export())
		return err
	}
	err := runUnlessCanceled(ctx, f)
	if err != nil {
		return nil, nil, err
	}

	return libkb.NewUserThin(res.User.Username, keybase1.UID(res.User.Uid)), res.PublicKeys, nil
}

func (k *KBPKIClient) identifyByUID(ctx context.Context, uid keybase1.UID) (
	*libkb.User, []keybase1.PublicKey, error) {
	arg := &engine.IDEngineArg{UserAssertion: fmt.Sprintf("uid:%s", uid)}
	return k.identify(ctx, arg)
}

func (k *KBPKIClient) session(ctx context.Context) (
	session *libkb.Session, deviceSubkey libkb.GenericKey, err error) {
	var res keybase1.Session
	f := func() error {
		c := keybase1.SessionClient{Cli: k.client}
		const sessionID = 0
		var err error
		res, err = c.CurrentSession(sessionID)
		return err
	}
	err = runUnlessCanceled(ctx, f)
	if err != nil {
		return
	}

	deviceSubkey, err = libkb.ImportKeypairFromKID(res.DeviceSubkeyKid)
	if err != nil {
		return
	}

	session = libkb.NewSessionThin(keybase1.UID(res.Uid), libkb.NewNormalizedUsername(res.Username), res.Token)
	return
}

// FavoriteAdd implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteAdd(ctx context.Context, folder keybase1.Folder) error {
	f := func() error {
		c := keybase1.FavoriteClient{Cli: k.client}
		return c.FavoriteAdd(keybase1.FavoriteAddArg{Folder: folder})
	}
	return runUnlessCanceled(ctx, f)
}

// FavoriteDelete implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteDelete(ctx context.Context, folder keybase1.Folder) error {
	f := func() error {
		c := keybase1.FavoriteClient{Cli: k.client}
		return c.FavoriteDelete(keybase1.FavoriteDeleteArg{Folder: folder})
	}
	return runUnlessCanceled(ctx, f)
}

// FavoriteList implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) FavoriteList(ctx context.Context) ([]keybase1.Folder, error) {
	var folders []keybase1.Folder
	f := func() error {
		c := keybase1.FavoriteClient{Cli: k.client}
		const sessionID = 0
		var err error
		folders, err = c.FavoriteList(sessionID)
		return err
	}
	if err := runUnlessCanceled(ctx, f); err != nil {
		return nil, err
	}
	return folders, nil
}

// Shutdown implements the KBPKI interface for KBPKIClient.
func (k *KBPKIClient) Shutdown() {
	// Nothing to do
}
