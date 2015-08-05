package libkbfs

import (
	"github.com/keybase/client/go/cache/favcache"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// KBPKILocal just serves users from a static map in memory
type KBPKILocal struct {
	Users     map[keybase1.UID]LocalUser
	Asserts   map[string]keybase1.UID
	LoggedIn  keybase1.UID
	Favorites *favcache.Cache
}

var _ KBPKI = (*KBPKILocal)(nil)

// NewKBPKILocal constructs a KBPKILocal object given a set of
// possible users, and one user that should be "logged in".
func NewKBPKILocal(loggedIn keybase1.UID, users []LocalUser) *KBPKILocal {
	k := &KBPKILocal{
		Users:     make(map[keybase1.UID]LocalUser),
		Asserts:   make(map[string]keybase1.UID),
		LoggedIn:  loggedIn,
		Favorites: favcache.New(),
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
func (k *KBPKILocal) ResolveAssertion(ctx context.Context, input string) (
	*libkb.User, error) {
	uid, ok := k.Asserts[input]
	if !ok {
		return nil, NoSuchUserError{input}
	}
	return k.GetUser(ctx, uid)
}

// GetUser implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) GetUser(ctx context.Context, uid keybase1.UID) (
	*libkb.User, error) {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return nil, err
	}
	return libkb.NewUserThin(u.Name, u.UID), nil
}

// GetSession implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) GetSession(ctx context.Context) (*libkb.Session, error) {
	return nil, nil
}

// GetLoggedInUser implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) GetLoggedInUser(ctx context.Context) (
	keybase1.UID, error) {
	return k.LoggedIn, nil
}

// HasVerifyingKey implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) HasVerifyingKey(ctx context.Context, uid keybase1.UID,
	verifyingKey VerifyingKey) error {
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
func (k *KBPKILocal) GetCryptPublicKeys(ctx context.Context, uid keybase1.UID) (
	keys []CryptPublicKey, err error) {
	u, err := k.getLocalUser(uid)
	if err != nil {
		return nil, err
	}
	return u.CryptPublicKeys, nil
}

// GetCurrentCryptPublicKey implements the KBPKI interface for KBPKILocal
func (k *KBPKILocal) GetCurrentCryptPublicKey(ctx context.Context) (
	CryptPublicKey, error) {
	u, err := k.getLocalUser(k.LoggedIn)
	if err != nil {
		return CryptPublicKey{}, err
	}
	return u.GetCurrentCryptPublicKey(), nil
}

func (k *KBPKILocal) getLocalUser(uid keybase1.UID) (LocalUser, error) {
	user, ok := k.Users[uid]
	if !ok {
		return LocalUser{}, NoSuchUserError{uid.String()}
	}
	return user, nil
}

// FavoriteAdd implements the KBPKI interface for KBPKILocal.
func (k *KBPKILocal) FavoriteAdd(ctx context.Context, folder keybase1.Folder) error {
	k.Favorites.Add(folder)
	return nil
}

// FavoriteDelete implements the KBPKI interface for KBPKILocal.
func (k *KBPKILocal) FavoriteDelete(ctx context.Context, folder keybase1.Folder) error {
	k.Favorites.Delete(folder)
	return nil
}

// FavoriteList implements the KBPKI interface for KBPKILocal.
func (k *KBPKILocal) FavoriteList(ctx context.Context) ([]keybase1.Folder, error) {
	return k.Favorites.List(), nil
}
