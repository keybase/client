package libkbfs

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
)

// KBPKINull is just a null passthrough
type KBPKINull struct {
}

func (k *KBPKINull) ResolveAssertion(input string) (*libkb.User, error) {
	eng := engine.NewIdentify(engine.NewIdentifyArg(input, false))
	ctx := &engine.Context{IdentifyUI: libkb.G.UI.GetIdentifyUI()}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.User(), nil
}

func (k *KBPKINull) GetUser(uid libkb.UID) (*libkb.User, error) {
	// load the user
	user, err := libkb.LoadUser(libkb.LoadUserArg{Uid: &uid})
	if err != nil {
		return nil, err
	}

	// check the assumptions (or use valid cached checks)
	arg := engine.NewIdentifyArg(user.GetName(), false)
	eng := engine.NewIdentify(arg)
	ctx := &engine.Context{IdentifyUI: libkb.G.UI.GetIdentifyUI()}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return user, nil
}

func (k *KBPKINull) GetSession() (*libkb.Session, error) {
	return nil, nil
}

func (k *KBPKINull) GetLoggedInUser() (libkb.UID, error) {
	p := libkb.G.LoginState().UID()
	if p == nil {
		// TODO: something more intelligent; maybe just shut down
		// unless we want anonymous browsing of public data
		return libkb.UID{0}, &LoggedInUserError{}
	} else {
		return *p, nil
	}
}

func (k *KBPKINull) GetDeviceSibKeys(user *libkb.User) (
	keys map[DeviceId]Key, err error) {
	keys = make(map[DeviceId]Key)
	// TODO: iterate through sibling keys
	keys[0] = NullKey
	err = nil
	return
}

func (k *KBPKINull) GetDeviceSubKeys(user *libkb.User) (
	keys map[DeviceId]Key, err error) {
	return k.GetDeviceSibKeys(user)
}

func (k *KBPKINull) GetPublicSigningKey(user *libkb.User) (Key, error) {
	return NullKey, nil
}

func (k *KBPKINull) GetActiveDeviceId() (DeviceId, error) {
	return 0, nil
}
