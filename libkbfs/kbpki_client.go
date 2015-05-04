package libkbfs

import (
	"fmt"
	"log"
	"sync"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// KBPKIClient uses rpc calls to daemon
type KBPKIClient struct {
	rpc  *rpc2.Client
	once sync.Once
}

// NewKBPKIClient creates a KBPKIClient.
func NewKBPKIClient() *KBPKIClient {
	return &KBPKIClient{}
}

// ResolveAssertion finds a user via assertion.
// TODO: fix me to call LUBA
func (k *KBPKIClient) ResolveAssertion(username string) (*libkb.User, error) {
	arg := &engine.IDEngineArg{UserAssertion: username}
	return k.identify(arg)
}

// GetUser finds a user via UID.
func (k *KBPKIClient) GetUser(uid libkb.UID) (user *libkb.User, err error) {
	arg := &engine.IDEngineArg{UserAssertion: fmt.Sprintf("uid:%s", uid)}
	return k.identify(arg)
}

// GetSession returns the current session.
func (k *KBPKIClient) GetSession() (*libkb.Session, error) {
	s, err := k.session()
	if err != nil {
		// XXX shouldn't ignore this...
		libkb.G.Log.Warning("error getting session: %q", err)
		return nil, err
	}
	return s, nil
}

// GetLoggedInUser returns the current logged in user.
func (k *KBPKIClient) GetLoggedInUser() (libkb.UID, error) {
	s, err := k.session()
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
	keys map[DeviceId]Key, err error) {
	keys = make(map[DeviceId]Key)
	// TODO: iterate through sibling keys
	keys[0] = NullKey
	err = nil
	return
}

func (k *KBPKIClient) GetDeviceSubKeys(user *libkb.User) (
	keys map[DeviceId]Key, err error) {
	return k.GetDeviceSibKeys(user)
}

func (k *KBPKIClient) GetPublicSigningKey(user *libkb.User) (Key, error) {
	return NullKey, nil
}

func (k *KBPKIClient) GetActiveDeviceId() (DeviceId, error) {
	return 0, nil
}

func (k *KBPKIClient) identify(arg *engine.IDEngineArg) (*libkb.User, error) {
	k.once.Do(k.client)
	c := keybase1.IdentifyClient{k.rpc}

	res, err := c.Identify(arg.Export())
	if err != nil {
		return nil, err
	}

	return libkb.NewUserThin(res.User.Username, libkb.UID(res.User.Uid)), nil
}

func (k *KBPKIClient) session() (*libkb.Session, error) {
	k.once.Do(k.client)
	c := keybase1.SessionClient{k.rpc}
	res, err := c.CurrentSession()
	if err != nil {
		return nil, err
	}

	return libkb.NewSessionThin(libkb.UID(res.Uid), res.Username, res.Token), nil
}

func (k *KBPKIClient) client() {
	var err error
	k.rpc, err = rpcClient()
	if err != nil {
		log.Fatal(err)
	}

	onceRegister.Do(serverProtocols)
}

var onceRegister sync.Once

func serverProtocols() {
	protocols := []rpc2.Protocol{
		newLogUIProtocol(),
		newIdentifyUIProtocol(),
	}
	if err := registerProtocols(protocols); err != nil {
		log.Fatal(err)
	}
}

func rpcClient() (*rpc2.Client, error) {
	_, xp, err := libkb.G.GetSocket()
	if err != nil {
		return nil, err
	}
	return rpc2.NewClient(xp, libkb.UnwrapError), nil
}

func rpcServer() (ret *rpc2.Server, err error) {
	_, xp, err := libkb.G.GetSocket()
	if err != nil {
		return nil, err
	}
	return rpc2.NewServer(xp, libkb.WrapError), nil
}

func registerProtocols(prots []rpc2.Protocol) (err error) {
	var srv *rpc2.Server
	if srv, err = rpcServer(); err != nil {
		return
	}
	for _, p := range prots {
		if err = srv.Register(p); err != nil {
			return
		}
	}
	return
}
