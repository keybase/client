// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"io"
	"os"
	"strings"
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
		return nil, NewNoUsernameError()
	}

	skbfile := NewSKBKeyringFile(g, un)
	err := skbfile.LoadAndIndex()
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return skbfile, nil
}

func LoadSKBKeyringFromMetaContext(m MetaContext) (*SKBKeyringFile, error) {
	return LoadSKBKeyring(m.CurrentUsername(), m.G())
}

func StatSKBKeyringMTime(un NormalizedUsername, g *GlobalContext) (mtime time.Time, err error) {
	if un.IsNil() {
		return mtime, NewNoUsernameError()
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
		k.G().Log.Warning(fmt.Sprintf("No PGP Keyring found at %s", k.filename))
		err = nil
	} else if err != nil {
		k.G().Log.Errorf("Cannot open keyring %s: %s\n", k.filename, err)
		return err
	}
	if file != nil {
		defer file.Close()
		k.Entities, err = openpgp.ReadKeyRing(file)
		if err != nil {
			k.G().Log.Errorf("Cannot parse keyring %s: %s\n", k.filename, err)
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
func (k *Keyrings) GetSecretKeyLocked(m MetaContext, ska SecretKeyArg) (ret *SKB, err error) {
	defer m.CTrace("Keyrings#GetSecretKeyLocked()", func() error { return err })()
	m.CDebugf("| LoadMe w/ Secrets on")

	if ska.Me == nil {
		if ska.Me, err = LoadMe(NewLoadUserArg(k.G())); err != nil {
			return nil, err
		}
	}

	if lctx := m.LoginContext(); lctx != nil {
		ret, err = lctx.LockedLocalSecretKey(ska)
		if err != nil {
			return ret, err
		}
	} else {
		aerr := m.G().LoginState().Account(func(a *Account) {
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
		m.CDebugf("| Getting local secret key")
		return ret, nil
	}

	var pub GenericKey

	if ska.KeyType != PGPKeyType {
		m.CDebugf("| Skipped Synced PGP key (via options)")
		err = NoSecretKeyError{}
		return nil, err
	}

	if ret, err = ska.Me.SyncedSecretKey(m); err != nil {
		m.CWarningf("Error fetching synced PGP secret key: %s", err)
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
		m.CDebugf("| Can't use Synced PGP key; doesn't match query %s", ska.KeyQuery)
		err = NoSecretKeyError{}
		return nil, err

	}

	return ret, nil
}

func (k *Keyrings) cachedSecretKey(m MetaContext, ska SecretKeyArg) GenericKey {
	key, err := m.G().ActiveDevice.KeyByType(ska.KeyType)

	if key != nil && err == nil {
		m.CDebugf("found cached secret key for ska: %+v", ska)
	} else if err != nil {
		if _, notFound := err.(NotFoundError); !notFound {
			m.CDebugf("error getting cached secret key: %s", err)
		}
	}

	return key
}

func (k *Keyrings) setCachedSecretKey(m MetaContext, ska SecretKeyArg, key GenericKey) {
	m.CDebugf("caching secret key for ska: %+v", ska)
	var setErr error
	if lctx := m.LoginContext(); lctx != nil {
		setErr = lctx.SetCachedSecretKey(ska, key, nil)
	} else {
		aerr := m.G().LoginState().Account(func(a *Account) {
			setErr = a.SetCachedSecretKey(ska, key, nil)
		}, "GetSecretKeyWithPrompt - SetCachedSecretKey")
		if aerr != nil {
			m.CDebugf("Account error: %s", aerr)
		}
	}
	if setErr != nil {
		m.CDebugf("SetCachedSecretKey error: %s", setErr)
	}
}

type SecretKeyPromptArg struct {
	Ska            SecretKeyArg
	SecretUI       SecretUI
	Reason         string
	UseCancelCache bool /* if true, when user cancels prompt, don't prompt again for 5m */
}

// TODO: Figure out whether and how to dep-inject the SecretStore.
func (k *Keyrings) GetSecretKeyWithPrompt(m MetaContext, arg SecretKeyPromptArg) (key GenericKey, err error) {
	defer m.CTrace(fmt.Sprintf("Keyrings#GetSecretKeyWithPrompt(%s)", arg.Reason), func() error { return err })()

	key = k.cachedSecretKey(m, arg.Ska)
	if key != nil {
		return key, err
	}

	key, _, err = k.GetSecretKeyAndSKBWithPrompt(m, arg)

	if key != nil && err == nil {
		k.setCachedSecretKey(m, arg.Ska, key)
	}

	return key, err
}

func (k *Keyrings) GetSecretKeyWithoutPrompt(m MetaContext, ska SecretKeyArg) (key GenericKey, err error) {
	defer m.CTrace("Keyrings#GetSecretKeyWithoutPrompt()", func() error { return err })()

	key = k.cachedSecretKey(m, ska)
	if key != nil {
		m.CDebugf("found cached secret key")
		return key, err
	}

	m.CDebugf("no cached secret key, trying via secretStore")

	// not cached, so try to unlock without prompting
	if ska.Me == nil {
		err = NewNoUsernameError()
		return nil, err
	}
	secretStore := NewSecretStore(m.G(), ska.Me.GetNormalizedName())

	skb, err := k.GetSecretKeyLocked(m, ska)
	if err != nil {
		return nil, err
	}

	key, err = skb.UnlockNoPrompt(m, secretStore)
	if key != nil && err == nil {
		k.setCachedSecretKey(m, ska, key)
	}

	return key, err
}

func (k *Keyrings) GetSecretKeyAndSKBWithPrompt(m MetaContext, arg SecretKeyPromptArg) (key GenericKey, skb *SKB, err error) {
	defer m.CTrace(fmt.Sprintf("GetSecretKeyAndSKBWithPrompt(%s)", arg.Reason), func() error { return err })()
	if skb, err = k.GetSecretKeyLocked(m, arg.Ska); err != nil {
		skb = nil
		return nil, nil, err
	}
	var secretStore SecretStore
	if arg.Ska.Me != nil {
		skb.SetUID(arg.Ska.Me.GetUID())
		secretStore = NewSecretStore(m.G(), arg.Ska.Me.GetNormalizedName())
	}
	if key, err = skb.PromptAndUnlock(m, arg, secretStore, arg.Ska.Me); err != nil {
		key = nil
		skb = nil
		return nil, nil, err
	}
	return key, skb, nil
}

func (k *Keyrings) GetSecretKeyWithStoredSecret(m MetaContext, ska SecretKeyArg, me *User, secretRetriever SecretRetriever) (key GenericKey, err error) {
	defer m.CTrace("Keyrings#GetSecretKeyWithStoredSecret()", func() error { return err })()
	var skb *SKB
	skb, err = k.GetSecretKeyLocked(m, ska)
	if err != nil {
		return
	}
	skb.SetUID(me.GetUID())
	return skb.UnlockWithStoredSecret(m, secretRetriever)
}

func (k *Keyrings) GetSecretKeyWithPassphrase(m MetaContext, me *User, passphrase string, secretStorer SecretStorer) (key GenericKey, err error) {
	defer m.CTrace("Keyrings#GetSecretKeyWithPassphrase()", func() error { return err })()
	ska := SecretKeyArg{
		Me:      me,
		KeyType: DeviceSigningKeyType,
	}
	var skb *SKB
	skb, err = k.GetSecretKeyLocked(m, ska)
	if err != nil {
		return
	}
	skb.SetUID(me.GetUID())
	var tsec Triplesec
	var pps *PassphraseStream
	if lctx := m.LoginContext(); lctx != nil {
		tsec = lctx.PassphraseStreamCache().Triplesec()
		pps = lctx.PassphraseStreamCache().PassphraseStream()
	} else {
		m.G().LoginState().PassphraseStreamCache(func(sc *PassphraseStreamCache) {
			tsec = sc.Triplesec()
			pps = sc.PassphraseStream()
		}, "StreamCache - tsec, pps")
	}
	return skb.UnlockSecretKey(m, passphrase, tsec, pps, secretStorer)
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
