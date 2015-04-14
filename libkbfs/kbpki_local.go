package libkbfs

import (
	"errors"
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
	jsonw "github.com/keybase/go-jsonw"
)

// KBPKILocal just serves users from a static map in memory
type KBPKILocal struct {
	Users    map[libkb.UID]*libkb.User
	Asserts  map[string]libkb.UID
	LoggedIn libkb.UID
}

type LocalUser struct {
	Name    string
	Uid     libkb.UID
	Asserts []string
}

func NewKBPKILocal(loggedIn libkb.UID, users []*LocalUser) *KBPKILocal {
	k := &KBPKILocal{
		Users:    make(map[libkb.UID]*libkb.User),
		Asserts:  make(map[string]libkb.UID),
		LoggedIn: loggedIn,
	}
	for _, u := range users {
		uString :=
			fmt.Sprintf(`{"basics" : {"username" : "%s"}, "id" : "%s"}`,
				u.Name, u.Uid)
		jsonU, _ := jsonw.Unmarshal([]byte(uString))
		user, _ := libkb.NewUser(jsonU)
		k.Users[u.Uid] = user
		for _, a := range u.Asserts {
			k.Asserts[a] = u.Uid
		}
		k.Asserts[u.Name] = u.Uid
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
	if user, ok := k.Users[uid]; !ok {
		return nil, errors.New(
			fmt.Sprintf("No such user matching %s", uid))
	} else {
		return user, nil
	}
}

func (k *KBPKILocal) GetSession() (*libkb.Session, error) {
	return nil, nil
}

func (k *KBPKILocal) GetLoggedInUser() (libkb.UID, error) {
	return k.LoggedIn, nil
}

func (k *KBPKILocal) GetDeviceSibKeys(user *libkb.User) (
	keys map[DeviceId]Key, err error) {
	keys = make(map[DeviceId]Key)
	// TODO: iterate through sibling keys
	keys[0] = NullKey
	err = nil
	return
}

func (k *KBPKILocal) GetDeviceSubKeys(user *libkb.User) (
	keys map[DeviceId]Key, err error) {
	return k.GetDeviceSibKeys(user)
}

func (k *KBPKILocal) GetPublicSigningKey(user *libkb.User) (Key, error) {
	return NullKey, nil
}

func (k *KBPKILocal) GetActiveDeviceId() (DeviceId, error) {
	return 0, nil
}
