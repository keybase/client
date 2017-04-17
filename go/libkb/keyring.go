// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/keybase/go-crypto/openpgp"
)

type KeyringFile struct {
	filename         string
	Entities         openpgp.EntityList
	isPublic         bool
	indexID          map[string](*openpgp.Entity) // Map of 64-bit uppercase-hex KeyIds
	indexFingerprint map[PGPFingerprint](*openpgp.Entity)
	Contextified
}

type Keyrings struct {
	Contextified
	sync.Mutex
}

func NewKeyrings(g *GlobalContext) *Keyrings {
	ret := &Keyrings{
		Contextified: Contextified{g: g},
	}
	return ret
}

//===================================================================

func (g *GlobalContext) SKBFilenameForUser(un NormalizedUsername) string {
	tmp := g.Env.GetSecretKeyringTemplate()
	token := "%u"
	if strings.Index(tmp, token) < 0 {
		return tmp
	}

	return strings.Replace(tmp, token, un.String(), -1)
}

func LoadSKBKeyring(un NormalizedUsername, g *GlobalContext) (*SKBKeyringFile, error) {
	if un.IsNil() {
		return nil, NoUsernameError{}
	}

	skbfile := NewSKBKeyringFile(g, un)
	err := skbfile.LoadAndIndex()
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return skbfile, nil
}

func StatSKBKeyringMTime(un NormalizedUsername, g *GlobalContext) (mtime time.Time, err error) {
	if un.IsNil() {
		return mtime, NoUsernameError{}
	}
	return NewSKBKeyringFile(g, un).MTime()
}

func (k *KeyringFile) LoadAndIndex() error {
	var err error
	k.G().Log.Debug("+ LoadAndIndex on %s", k.filename)
	if err = k.Load(); err == nil {
		err = k.Index()
	}
	k.G().Log.Debug("- LoadAndIndex on %s -> %s", k.filename, ErrToOk(err))
	return err
}

func (k *KeyringFile) Index() error {
	k.G().Log.Debug("+ Index on %s", k.filename)
	k.indexID = make(map[string](*openpgp.Entity))
	k.indexFingerprint = make(map[PGPFingerprint](*openpgp.Entity))
	p := 0
	s := 0
	for _, entity := range k.Entities {
		if entity.PrimaryKey != nil {
			id := entity.PrimaryKey.KeyIdString()
			k.indexID[id] = entity
			fp := PGPFingerprint(entity.PrimaryKey.Fingerprint)
			k.indexFingerprint[fp] = entity
			p++
		}
		for _, subkey := range entity.Subkeys {
			if subkey.PublicKey != nil {
				id := subkey.PublicKey.KeyIdString()
				k.indexID[id] = entity
				fp := PGPFingerprint(subkey.PublicKey.Fingerprint)
				k.indexFingerprint[fp] = entity
				s++
			}
		}
	}
	k.G().Log.Debug("| Indexed %d primary and %d subkeys", p, s)
	k.G().Log.Debug("- Index on %s -> %s", k.filename, "OK")
	return nil
}

func (k *KeyringFile) Load() error {
	k.G().Log.Debug(fmt.Sprintf("+ Loading PGP Keyring %s", k.filename))
	file, err := os.Open(k.filename)
	if os.IsNotExist(err) {
		G.Log.Warning(fmt.Sprintf("No PGP Keyring found at %s", k.filename))
		err = nil
	} else if err != nil {
		G.Log.Errorf("Cannot open keyring %s: %s\n", k.filename, err)
		return err
	}
	if file != nil {
		defer file.Close()
		k.Entities, err = openpgp.ReadKeyRing(file)
		if err != nil {
			G.Log.Errorf("Cannot parse keyring %s: %s\n", k.filename, err)
			return err
		}
	}
	k.G().Log.Debug(fmt.Sprintf("- Successfully loaded PGP Keyring"))
	return nil
}

func (k KeyringFile) WriteTo(w io.Writer) (int64, error) {
	for _, e := range k.Entities {
		if err := e.Serialize(w); err != nil {
			return 0, err
		}
	}
	return 0, nil
}

func (k KeyringFile) GetFilename() string { return k.filename }

func (k KeyringFile) Save(g *GlobalContext) error {
	return SafeWriteToFile(g.Log, k, 0)
}

type SecretKeyType int

const (
	// The current device signing key.
	DeviceSigningKeyType SecretKeyType = iota
	// The current device encryption key.
	DeviceEncryptionKeyType
	// A PGP key (including the synced PGP key, if there is one).
	PGPKeyType
)

func (t SecretKeyType) String() string {
	switch t {
	case DeviceSigningKeyType:
		return "DeviceSigningKeyType"
	case DeviceEncryptionKeyType:
		return "DeviceEncryptionKeyType"
	case PGPKeyType:
		return "PGPKeyType"
	default:
		return "<Unknown secret key type>"
	}
}

func (t SecretKeyType) nonDeviceKeyMatches(key GenericKey) bool {
	if IsPGP(key) && (t == PGPKeyType) {
		return true
	}

	return false
}

type SecretKeyArg struct {
	// Whose keys to use. Must be non-nil.
	Me *User

	// The allowed key types.
	KeyType SecretKeyType

	// For non-device keys, a string that the key has to match. If
	// empty, any valid key is allowed.
	KeyQuery   string
	ExactMatch bool // if set, full equality required
}

// GetSecretKeyLocked gets a secret key for the current user by first
// looking for keys synced from the server, and if that fails, tries
// those in the local Keyring that are also active for the user.
// In any case, the key will be locked.
func (k *Keyrings) GetSecretKeyLocked(lctx LoginContext, ska SecretKeyArg) (ret *SKB, err error) {
	k.G().Log.Debug("+ GetSecretKeyLocked()")
	defer func() {
		k.G().Log.Debug("- GetSecretKeyLocked() -> %s", ErrToOk(err))
	}()

	k.G().Log.Debug("| LoadMe w/ Secrets on")

	if ska.Me == nil {
		if ska.Me, err = LoadMe(NewLoadUserArg(k.G())); err != nil {
			return
		}
	}

	if lctx != nil {
		ret, err = lctx.LockedLocalSecretKey(ska)
		if err != nil {
			return ret, err
		}
	} else {
		aerr := k.G().LoginState().Account(func(a *Account) {
			ret, err = a.LockedLocalSecretKey(ska)
		}, "LockedLocalSecretKey")
		if err != nil {
			return ret, err
		}
		if aerr != nil {
			return nil, aerr
		}
	}

	if ret != nil {
		k.G().Log.Debug("| Getting local secret key")
		return ret, nil
	}

	var pub GenericKey

	if ska.KeyType != PGPKeyType {
		k.G().Log.Debug("| Skipped Synced PGP key (via options)")
		err = NoSecretKeyError{}
		return nil, err
	}

	if ret, err = ska.Me.SyncedSecretKey(lctx); err != nil {
		k.G().Log.Warning("Error fetching synced PGP secret key: %s", err)
		return nil, err
	}
	if ret == nil {
		err = NoSecretKeyError{}
		return nil, err
	}

	if pub, err = ret.GetPubKey(); err != nil {
		return nil, err
	}

	if !KeyMatchesQuery(pub, ska.KeyQuery, ska.ExactMatch) {
		k.G().Log.Debug("| Can't use Synced PGP key; doesn't match query %s", ska.KeyQuery)
		err = NoSecretKeyError{}
		return nil, err

	}

	return ret, nil
}

func (k *Keyrings) cachedSecretKey(lctx LoginContext, ska SecretKeyArg) GenericKey {
	key, err := k.G().ActiveDevice.KeyByType(ska.KeyType)

	if key != nil && err == nil {
		k.G().Log.Debug("found cached secret key for ska: %+v", ska)
	} else if err != nil {
		if _, notFound := err.(NotFoundError); !notFound {
			k.G().Log.Debug("error getting cached secret key: %s", err)
		}
	}

	return key
}

func (k *Keyrings) setCachedSecretKey(lctx LoginContext, ska SecretKeyArg, key GenericKey) {
	k.G().Log.Debug("caching secret key for ska: %+v", ska)
	var setErr error
	if lctx != nil {
		setErr = lctx.SetCachedSecretKey(ska, key)
	} else {
		aerr := k.G().LoginState().Account(func(a *Account) {
			setErr = a.SetCachedSecretKey(ska, key)
		}, "GetSecretKeyWithPrompt - SetCachedSecretKey")
		if aerr != nil {
			k.G().Log.Debug("Account error: %s", aerr)
		}
	}
	if setErr != nil {
		k.G().Log.Debug("SetCachedSecretKey error: %s", setErr)
	}
}

type SecretKeyPromptArg struct {
	LoginContext   LoginContext
	Ska            SecretKeyArg
	SecretUI       SecretUI
	Reason         string
	UseCancelCache bool /* if true, when user cancels prompt, don't prompt again for 5m */
}

// TODO: Figure out whether and how to dep-inject the SecretStore.
func (k *Keyrings) GetSecretKeyWithPrompt(arg SecretKeyPromptArg) (key GenericKey, err error) {
	k.G().Log.Debug("+ GetSecretKeyWithPrompt(%s)", arg.Reason)
	defer func() {
		k.G().Log.Debug("- GetSecretKeyWithPrompt() -> %s", ErrToOk(err))
	}()

	key = k.cachedSecretKey(arg.LoginContext, arg.Ska)
	if key != nil {
		return key, err
	}

	key, _, err = k.GetSecretKeyAndSKBWithPrompt(arg)

	if key != nil && err == nil {
		k.setCachedSecretKey(arg.LoginContext, arg.Ska, key)
	}

	return key, err
}

func (k *Keyrings) GetSecretKeyWithoutPrompt(lctx LoginContext, ska SecretKeyArg) (key GenericKey, err error) {
	k.G().Log.Debug("+ GetSecretKeyWithoutPrompt()")
	defer func() {
		k.G().Log.Debug("- GetSecretKeyWithoutPrompt() -> %s", ErrToOk(err))
	}()

	key = k.cachedSecretKey(lctx, ska)
	if key != nil {
		k.G().Log.Debug("  found cached secret key")
		return key, err
	}

	k.G().Log.Debug("  no cached secret key, trying via secretStore")

	// not cached, so try to unlock without prompting
	if ska.Me == nil {
		err = NoUsernameError{}
		return nil, err
	}
	secretStore := NewSecretStore(k.G(), ska.Me.GetNormalizedName())

	skb, err := k.GetSecretKeyLocked(lctx, ska)
	if err != nil {
		return nil, err
	}

	key, err = skb.UnlockNoPrompt(lctx, secretStore)
	if key != nil && err == nil {
		k.setCachedSecretKey(lctx, ska, key)
	}

	return key, err
}

func (k *Keyrings) GetSecretKeyAndSKBWithPrompt(arg SecretKeyPromptArg) (key GenericKey, skb *SKB, err error) {
	k.G().Log.Debug("+ GetSecretKeyAndSKBWithPrompt(%s)", arg.Reason)
	defer func() {
		k.G().Log.Debug("- GetSecretKeyAndSKBWithPrompt() -> %s", ErrToOk(err))
	}()
	if skb, err = k.GetSecretKeyLocked(arg.LoginContext, arg.Ska); err != nil {
		skb = nil
		return
	}
	var secretStore SecretStore
	if arg.Ska.Me != nil {
		skb.SetUID(arg.Ska.Me.GetUID())
		secretStore = NewSecretStore(k.G(), arg.Ska.Me.GetNormalizedName())
	}
	if key, err = skb.PromptAndUnlock(arg, secretStore, arg.Ska.Me); err != nil {
		key = nil
		skb = nil
		return
	}
	return
}

func (k *Keyrings) GetSecretKeyWithStoredSecret(lctx LoginContext, ska SecretKeyArg, me *User, secretRetriever SecretRetriever) (key GenericKey, err error) {
	k.G().Log.Debug("+ GetSecretKeyWithStoredSecret()")
	defer func() {
		k.G().Log.Debug("- GetSecretKeyWithStoredSecret() -> %s", ErrToOk(err))
	}()
	var skb *SKB
	skb, err = k.GetSecretKeyLocked(lctx, ska)
	if err != nil {
		return
	}
	skb.SetUID(me.GetUID())
	return skb.UnlockWithStoredSecret(lctx, secretRetriever)
}

func (k *Keyrings) GetSecretKeyWithPassphrase(lctx LoginContext, me *User, passphrase string, secretStorer SecretStorer) (key GenericKey, err error) {
	k.G().Log.Debug("+ GetSecretKeyWithPassphrase()")
	defer func() {
		k.G().Log.Debug("- GetSecretKeyWithPassphrase() -> %s", ErrToOk(err))
	}()
	ska := SecretKeyArg{
		Me:      me,
		KeyType: DeviceSigningKeyType,
	}
	var skb *SKB
	skb, err = k.GetSecretKeyLocked(lctx, ska)
	if err != nil {
		return
	}
	skb.SetUID(me.GetUID())
	var tsec Triplesec
	var pps *PassphraseStream
	if lctx != nil {
		tsec = lctx.PassphraseStreamCache().Triplesec()
		pps = lctx.PassphraseStreamCache().PassphraseStream()
	} else {
		k.G().LoginState().PassphraseStreamCache(func(sc *PassphraseStreamCache) {
			tsec = sc.Triplesec()
			pps = sc.PassphraseStream()
		}, "StreamCache - tsec, pps")
	}
	return skb.UnlockSecretKey(lctx, passphrase, tsec, pps, secretStorer)
}

type EmptyKeyRing struct{}

func (k EmptyKeyRing) KeysById(id uint64, fp []byte) []openpgp.Key {
	return []openpgp.Key{}
}
func (k EmptyKeyRing) KeysByIdUsage(id uint64, fp []byte, usage byte) []openpgp.Key {
	return []openpgp.Key{}
}
func (k EmptyKeyRing) DecryptionKeys() []openpgp.Key {
	return []openpgp.Key{}
}
