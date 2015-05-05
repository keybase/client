package libkbfs

import (
	"errors"
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// KBPKILocal just serves users from a static map in memory
type KBPKILocal struct {
	Users    map[libkb.UID]LocalUser
	Asserts  map[string]libkb.UID
	LoggedIn libkb.UID
}

type LocalUser struct {
	Name            string
	Uid             libkb.UID
	Asserts         []string
	SibKeys         []Key
	SubKeys         []Key
	SigningKey      Key
	DeviceSubkeyKid KID
}

func keysToPublicKeys(keys []Key, isSibkey bool) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.GetKid().String(),
			IsSibkey: isSibkey,
		}
	}
	return publicKeys
}

func (lu *LocalUser) GetPublicKeys() []keybase1.PublicKey {
	sibKeys := keysToPublicKeys(lu.SibKeys, true)
	subKeys := keysToPublicKeys(lu.SubKeys, false)
	return append(sibKeys, subKeys...)
}

func NewKBPKILocal(loggedIn libkb.UID, users []LocalUser) *KBPKILocal {
	k := &KBPKILocal{
		Users:    make(map[libkb.UID]LocalUser),
		Asserts:  make(map[string]libkb.UID),
		LoggedIn: loggedIn,
	}
	for _, u := range users {
		k.Users[u.Uid] = u
		for _, a := range u.Asserts {
			k.Asserts[a] = u.Uid
		}
		k.Asserts[u.Name] = u.Uid
		k.Asserts["uid:"+u.Uid.String()] = u.Uid
	}
	return k
}

func (k *KBPKILocal) ResolveAssertion(input string) (*libkb.User, error) {
	if uid, ok := k.Asserts[input]; !ok {
		return nil, errors.New(fmt.Sprintf("No such user matching %s", input))
	} else {
		return k.GetUser(uid)
	}
}

func (k *KBPKILocal) GetUser(uid libkb.UID) (*libkb.User, error) {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return nil, err
	}
	return libkb.NewUserThin(u.Name, u.Uid), nil
}

func (k *KBPKILocal) GetSession() (*libkb.Session, error) {
	return nil, nil
}

func (k *KBPKILocal) GetLoggedInUser() (libkb.UID, error) {
	return k.LoggedIn, nil
}

func (k *KBPKILocal) GetDeviceSibKeys(user *libkb.User) (
	[]Key, error) {
	u, err := k.getLocalUser(user.GetUid())
	if err != nil {
		return nil, err
	}
	return u.SibKeys, nil
}

func (k *KBPKILocal) GetDeviceSubKeys(user *libkb.User) (
	keys []Key, err error) {
	u, err := k.getLocalUser(user.GetUid())
	if err != nil {
		return nil, err
	}
	return u.SubKeys, nil
}

func (k *KBPKILocal) GetPublicSigningKey(user *libkb.User) (Key, error) {
	u, err := k.getLocalUser(user.GetUid())
	if err != nil {
		return nil, err
	}
	return u.SigningKey, nil
}

func (k *KBPKILocal) GetDeviceSubkeyKid() (KID, error) {
	u, err := k.getLocalUser(k.LoggedIn)
	if err != nil {
		return KID{}, err
	}
	return u.DeviceSubkeyKid, nil
}

func (k *KBPKILocal) getLocalUser(uid libkb.UID) (LocalUser, error) {
	user, ok := k.Users[uid]
	if !ok {
		return LocalUser{}, fmt.Errorf("No such user matching %s", uid)
	}
	return user, nil
}
