package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// KBPKILocal just serves users from a static map in memory
type KBPKILocal struct {
	Users    map[libkb.UID]LocalUser
	Asserts  map[string]libkb.UID
	LoggedIn libkb.UID
}

var _ KBPKI = (*KBPKILocal)(nil)

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
	uid, ok := k.Asserts[input]
	if !ok {
		return nil, errors.New(fmt.Sprintf("No such user matching %s", input))
	}
	return k.GetUser(uid)
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

func (k *KBPKILocal) HasVerifyingKey(uid libkb.UID, verifyingKey VerifyingKey) error {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return err
	}
	for _, k := range u.VerifyingKeys {
		if k.KID.Eq(verifyingKey.KID) {
			return nil
		}
	}
	return KeyNotFoundError{verifyingKey.KID}
}

func (k *KBPKILocal) GetCryptPublicKeys(uid libkb.UID) (
	keys []CryptPublicKey, err error) {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return nil, err
	}
	return u.CryptPublicKeys, nil
}

func (k *KBPKILocal) GetCurrentCryptPublicKey() (CryptPublicKey, error) {
	u, err := k.getLocalUser(k.LoggedIn)
	if err != nil {
		return CryptPublicKey{}, err
	}
	return u.GetCurrentCryptPublicKey(), nil
}

func (k *KBPKILocal) getLocalUser(uid libkb.UID) (LocalUser, error) {
	user, ok := k.Users[uid]
	if !ok {
		return LocalUser{}, fmt.Errorf("No such user matching %s", uid)
	}
	return user, nil
}
