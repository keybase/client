package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// KBPKIClient uses rpc calls to daemon
type KBPKIClient struct {
	client keybase1.GenericClient
}

// NewKBPKIClient creates a KBPKIClient.
func NewKBPKIClient(ctx *libkb.GlobalContext) (*KBPKIClient, error) {
	_, xp, err := ctx.GetSocket()
	if err != nil {
		return nil, err
	}

	srv := rpc2.NewServer(xp, libkb.WrapError)

	protocols := []rpc2.Protocol{
		newLogUIProtocol(),
		newIdentifyUIProtocol(),
	}

	for _, p := range protocols {
		if err := srv.Register(p); err != nil {
			if _, ok := err.(rpc2.AlreadyRegisteredError); !ok {
				return nil, err
			}
		}
	}

	client := rpc2.NewClient(xp, libkb.UnwrapError)
	return newKBPKIClientWithClient(client), nil
}

// For testing.
func newKBPKIClientWithClient(client keybase1.GenericClient) *KBPKIClient {
	return &KBPKIClient{client}
}

// ResolveAssertion finds a user via assertion.
func (k *KBPKIClient) ResolveAssertion(username string) (*libkb.User, error) {
	arg := &engine.IDEngineArg{UserAssertion: username}
	// TODO: Consider caching the returned public key info from
	// identify instead of dropping them.
	user, _, err := k.identify(arg)
	return user, err
}

// GetUser finds a user via UID.
func (k *KBPKIClient) GetUser(uid libkb.UID) (user *libkb.User, err error) {
	arg := &engine.IDEngineArg{UserAssertion: fmt.Sprintf("uid:%s", uid)}
	user, _, err = k.identify(arg)
	return user, err
}

// GetSession returns the current session.
func (k *KBPKIClient) GetSession() (*libkb.Session, error) {
	s, _, err := k.session()
	if err != nil {
		// XXX shouldn't ignore this...
		libkb.G.Log.Warning("error getting session: %q", err)
		return nil, err
	}
	return s, nil
}

// GetLoggedInUser returns the current logged in user.
func (k *KBPKIClient) GetLoggedInUser() (libkb.UID, error) {
	s, _, err := k.session()
	if err != nil {
		// TODO: something more intelligent; maybe just shut down
		// unless we want anonymous browsing of public data
		return libkb.UID{0}, err
	}
	uid := s.GetUID()
	if uid == nil {
		// TODO: something more intelligent; maybe just shut down
		// unless we want anonymous browsing of public data
		return libkb.UID{0}, &LoggedInUserError{}
	}
	libkb.G.Log.Info("logged in user uid = %s", *uid)
	return *uid, nil
}

func (k *KBPKIClient) GetDeviceSibKeys(user *libkb.User) (
	keys []Key, err error) {
	return k.getDeviceKeysHelper(user, true /* isSibkey */)
}

func (k *KBPKIClient) GetDeviceSubKeys(user *libkb.User) (
	keys []Key, err error) {
	return k.getDeviceKeysHelper(user, false /* isSibkey */)
}

func (k *KBPKIClient) getDeviceKeysHelper(user *libkb.User, isSibkey bool) (
	keys []Key, err error) {
	arg := &engine.IDEngineArg{UserAssertion: fmt.Sprintf("uid:%s", user.GetUid())}
	_, publicKeys, err := k.identify(arg)
	if err != nil {
		return nil, err
	}

	keys = make([]Key, 0, len(publicKeys))
	for _, publicKey := range publicKeys {
		if (publicKey.IsSibkey != isSibkey) || len(publicKey.PGPFingerprint) > 0 {
			continue
		}
		kid, err := libkb.ImportKID(publicKey.KID)
		if err != nil {
			return nil, err
		}
		key, err := libkb.ImportKeypairFromKID(kid, nil)
		if err != nil {
			return nil, err
		}
		var keyType string
		if isSibkey {
			keyType = "sibkey"
		} else {
			keyType = "subkey"
		}
		libkb.G.Log.Debug("got %s %s for user %s", keyType, key.VerboseDescription(), user.GetName())
		keys = append(keys, key)
	}

	return keys, nil
}

func (k *KBPKIClient) GetPublicSigningKey(user *libkb.User) (Key, error) {
	return nil, nil
}

func (k *KBPKIClient) GetDeviceSubkeyKid() (KID, error) {
	_, deviceSubkeyKid, err := k.session()
	if err != nil {
		return KID{}, err
	}
	libkb.G.Log.Debug("got device kid %s", libkb.KID(deviceSubkeyKid).ToShortIdString())
	return deviceSubkeyKid, nil
}

func (k *KBPKIClient) identify(arg *engine.IDEngineArg) (*libkb.User, []keybase1.PublicKey, error) {
	c := keybase1.IdentifyClient{k.client}

	res, err := c.Identify(arg.Export())
	if err != nil {
		return nil, nil, err
	}

	return libkb.NewUserThin(res.User.Username, libkb.UID(res.User.Uid)), res.User.PublicKeys, nil
}

func (k *KBPKIClient) session() (*libkb.Session, KID, error) {
	c := keybase1.SessionClient{k.client}
	res, err := c.CurrentSession()
	if err != nil {
		return nil, KID{}, err
	}

	deviceSubkeyKid, err := libkb.ImportKID(res.DeviceSubkeyKid)
	if err != nil {
		return nil, KID{}, err
	}

	return libkb.NewSessionThin(libkb.UID(res.Uid), res.Username, res.Token), KID(deviceSubkeyKid), nil
}
