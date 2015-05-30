package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// KBPKILocal just serves users from a static map in memory
type KBPKILocal struct {
	Users    map[keybase1.UID]LocalUser
	Asserts  map[string]keybase1.UID
	LoggedIn keybase1.UID
}

var _ KBPKI = (*KBPKILocal)(nil)

func NewKBPKILocal(loggedIn keybase1.UID, users []LocalUser) *KBPKILocal {
	k := &KBPKILocal{
		Users:    make(map[keybase1.UID]LocalUser),
		Asserts:  make(map[string]keybase1.UID),
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

func (k *KBPKILocal) GetUser(uid keybase1.UID) (*libkb.User, error) {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return nil, err
	}
	return libkb.NewUserThin(u.Name, u.Uid), nil
}

func (k *KBPKILocal) GetSession() (*libkb.Session, error) {
	return nil, nil
}

func (k *KBPKILocal) GetLoggedInUser() (keybase1.UID, error) {
	return k.LoggedIn, nil
}

func (k *KBPKILocal) HasVerifyingKey(uid keybase1.UID, verifyingKey VerifyingKey) error {
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

func (k *KBPKILocal) GetCryptPublicKeys(uid keybase1.UID) (
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

func (k *KBPKILocal) getLocalUser(uid keybase1.UID) (LocalUser, error) {
	user, ok := k.Users[uid]
	if !ok {
		return LocalUser{}, fmt.Errorf("No such user matching %s", uid)
	}
	return user, nil
}
