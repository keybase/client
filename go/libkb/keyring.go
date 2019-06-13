// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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

func getDeviceKey(m MetaContext, ckf *ComputedKeyFamily, secretKeyType SecretKeyType, nun NormalizedUsername) (GenericKey, error) {
	did := m.G().Env.GetDeviceIDForUsername(nun)
	if did.IsNil() {
		return nil, errors.New("Could not get device id")
	}

	switch secretKeyType {
	case DeviceSigningKeyType:
		return ckf.GetSibkeyForDevice(did)
	case DeviceEncryptionKeyType:
		return ckf.GetEncryptionSubkeyForDevice(did)
	default:
		return nil, fmt.Errorf("Invalid type %v", secretKeyType)
	}
}

// LockedLocalSecretKey looks in the local keyring to find a key
// for the given user.  Returns non-nil if one was found, and nil
// otherwise.
func LockedLocalSecretKey(m MetaContext, ska SecretKeyArg) (*SKB, error) {
	var ret *SKB
	me := ska.Me

	keyring, err := m.Keyring()
	if err != nil {
		return nil, err
	}
	if keyring == nil {
		m.Debug("| No secret keyring found: %s", err)
		return nil, NoKeyringsError{}
	}

	ckf := me.GetComputedKeyFamily()
	if ckf == nil {
		m.Warning("No ComputedKeyFamily found for %s", me.name)
		return nil, KeyFamilyError{Msg: "not found for " + me.name}
	}

	if (ska.KeyType == DeviceSigningKeyType) || (ska.KeyType == DeviceEncryptionKeyType) {
		key, err := getDeviceKey(m, ckf, ska.KeyType, me.GetNormalizedName())
		if err != nil {
			m.Debug("| No key for current device: %s", err)
			return nil, err
		}

		if key == nil {
			m.Debug("| Key for current device is nil")
			return nil, NoKeyError{Msg: "Key for current device is nil"}
		}

		kid := key.GetKID()
		m.Debug("| Found KID for current device: %s", kid)
		ret = keyring.LookupByKid(kid)
		if ret != nil {
			m.Debug("| Using device key: %s", kid)
		}
	} else {
		m.Debug("| Looking up secret key in local keychain")
		blocks := keyring.SearchWithComputedKeyFamily(ckf, ska)
		if len(blocks) > 0 {
			ret = blocks[0]
		}
	}

	if ret != nil {
		ret.SetUID(me.GetUID())
	}

	return ret, nil
}

// GetSecretKeyLocked gets a secret key for the current user by first
// looking for keys synced from the server, and if that fails, tries
// those in the local Keyring that are also active for the user.
// In any case, the key will be locked.
func (k *Keyrings) GetSecretKeyLocked(m MetaContext, ska SecretKeyArg) (ret *SKB, err error) {
	defer m.Trace("Keyrings#GetSecretKeyLocked()", func() error { return err })()
	m.Debug("| LoadMe w/ Secrets on")

	if ska.Me == nil {
		if ska.Me, err = LoadMe(NewLoadUserArg(k.G())); err != nil {
			return nil, err
		}
	}

	ret, err = LockedLocalSecretKey(m, ska)
	if err != nil {
		return nil, err
	}

	if ret != nil {
		m.Debug("| Getting local secret key")
		return ret, nil
	}

	// Try to get server synced key.

	if ska.KeyType != PGPKeyType {
		m.Debug("| Skipped Synced PGP key (via options)")
		err = NoSecretKeyError{}
		return nil, err
	}

	if ret, err = ska.Me.SyncedSecretKeyWithSka(m, ska); err != nil {
		if _, ok := err.(NoSecretKeyError); !ok {
			m.Warning("Error fetching synced PGP secret key: %s", err)
		} else {
			m.Debug("| Can't find synced PGP key matching query %s", ska.KeyQuery)
		}
		return nil, err
	}

	return ret, nil
}

func (k *Keyrings) cachedSecretKey(m MetaContext, ska SecretKeyArg) GenericKey {
	key, err := m.G().ActiveDevice.KeyByType(ska.KeyType)

	if key != nil && err == nil {
		m.Debug("found cached secret key for ska: %+v", ska)
	} else if err != nil {
		if _, notFound := err.(NotFoundError); !notFound {
			m.Debug("error getting cached secret key: %s", err)
		}
	}

	return key
}

func deviceIDFromDevice(m MetaContext, uid keybase1.UID, device *Device) keybase1.DeviceID {
	if device != nil {
		return device.ID
	}
	return m.G().Env.GetDeviceIDForUID(uid)
}
func deviceNameLookup(m MetaContext, device *Device, me *User, key GenericKey) string {
	if device != nil {
		if device.Description != nil && *device.Description != "" {
			m.Debug("deviceNameLookup: using device name from device: %q", *device.Description)
			return *device.Description
		}
	}

	m.Debug("deviceNameLookup: no device name passed in, checking user")

	if me == nil {
		m.Debug("deviceNameLookup: me is nil, skipping device name lookup")
		return ""
	}
	m.Debug("deviceNameLookup: looking for device name for device signing key")
	ckf := me.GetComputedKeyFamily()
	device, err := ckf.GetDeviceForKey(key)
	if err != nil {
		// not fatal
		m.Debug("deviceNameLookup: error getting device for key: %s", err)
		return ""
	}
	if device == nil {
		m.Debug("deviceNameLookup: device for key is nil")
		return ""
	}
	if device.Description == nil {
		m.Debug("deviceNameLookup: device description is nil")
		return ""
	}

	m.Debug("deviceNameLookup: found device name %q", *device.Description)

	return *device.Description
}

func setCachedSecretKey(m MetaContext, ska SecretKeyArg, key GenericKey, device *Device) error {
	if key == nil {
		return errors.New("cache of nil secret key attempted")
	}

	uid := ska.Me.GetUID()
	uv := ska.Me.ToUserVersion()
	deviceID := deviceIDFromDevice(m, uid, device)
	if deviceID.IsNil() {
		m.Debug("SetCachedSecretKey with nil deviceID (%+v)", ska)
	}

	switch ska.KeyType {
	case DeviceSigningKeyType:
		deviceName := deviceNameLookup(m, device, ska.Me, key)
		m.Debug("caching secret device signing key (%q/%d)", deviceName, deviceID)
		return m.SetSigningKey(uv, deviceID, key, deviceName)
	case DeviceEncryptionKeyType:
		m.Debug("caching secret device encryption key")
		return m.SetEncryptionKey(uv, deviceID, key)
	default:
		return fmt.Errorf("attempt to cache invalid key type: %d", ska.KeyType)
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
	defer m.Trace(fmt.Sprintf("Keyrings#GetSecretKeyWithPrompt(%s)", arg.Reason), func() error { return err })()

	key = k.cachedSecretKey(m, arg.Ska)
	if key != nil {
		return key, err
	}

	key, _, err = k.GetSecretKeyAndSKBWithPrompt(m, arg)

	if key != nil && err == nil {
		setCachedSecretKey(m, arg.Ska, key, nil)
	}

	return key, err
}

func (k *Keyrings) GetSecretKeyAndSKBWithPrompt(m MetaContext, arg SecretKeyPromptArg) (key GenericKey, skb *SKB, err error) {
	defer m.Trace(fmt.Sprintf("GetSecretKeyAndSKBWithPrompt(%s)", arg.Reason), func() error { return err })()
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
	defer m.Trace("Keyrings#GetSecretKeyWithStoredSecret()", func() error { return err })()
	var skb *SKB
	skb, err = k.GetSecretKeyLocked(m, ska)
	if err != nil {
		return
	}
	skb.SetUID(me.GetUID())
	return skb.UnlockWithStoredSecret(m, secretRetriever)
}

func (k *Keyrings) GetSecretKeyWithPassphrase(m MetaContext, me *User, passphrase string, secretStorer SecretStorer) (key GenericKey, err error) {
	defer m.Trace("Keyrings#GetSecretKeyWithPassphrase()", func() error { return err })()
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
	pps, tsec := m.PassphraseStreamAndTriplesec()
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
