package libkbfs

import (
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

// NewKBPKILocal constructs a KBPKILocal object given a set of
// possible users, and one user that should be "logged in".
func NewKBPKILocal(loggedIn keybase1.UID, users []LocalUser) *KBPKILocal {
	k := &KBPKILocal{
		Users:    make(map[keybase1.UID]LocalUser),
		Asserts:  make(map[string]keybase1.UID),
		LoggedIn: loggedIn,
	}
	for _, u := range users {
		k.Users[u.UID] = u
		for _, a := range u.Asserts {
			k.Asserts[a] = u.UID
		}
		k.Asserts[u.Name] = u.UID
		k.Asserts["uid:"+u.UID.String()] = u.UID
	}
	return k
}

// ResolveAssertion implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) ResolveAssertion(input string) (*libkb.User, error) {
	uid, ok := k.Asserts[input]
	if !ok {
		return nil, fmt.Errorf("No such user matching %s", input)
	}
	return k.GetUser(uid)
}

// GetUser implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) GetUser(uid keybase1.UID) (*libkb.User, error) {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return nil, err
	}
	return libkb.NewUserThin(u.Name, u.UID), nil
}

// GetSession implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) GetSession() (*libkb.Session, error) {
	return nil, nil
}

// GetLoggedInUser implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) GetLoggedInUser() (keybase1.UID, error) {
	return k.LoggedIn, nil
}

// HasVerifyingKey implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) HasVerifyingKey(uid keybase1.UID, verifyingKey VerifyingKey) error {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return err
	}

	for _, k := range u.VerifyingKeys {
		if k.KID.Equal(verifyingKey.KID) {
			return nil
		}
	}
	return KeyNotFoundError{verifyingKey.KID}
}

// GetCryptPublicKeys implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) GetCryptPublicKeys(uid keybase1.UID) (
	keys []CryptPublicKey, err error) {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return nil, err
	}
	return u.CryptPublicKeys, nil
}

// GetCurrentCryptPublicKey implements the KBPKI interface for KBPKILocal
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
