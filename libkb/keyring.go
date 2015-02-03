package libkb

import (
	"fmt"
	"golang.org/x/crypto/openpgp"
	"io"
	"os"
)

type KeyringFile struct {
	filename         string
	Entities         openpgp.EntityList
	isPublic         bool
	indexId          map[string](*openpgp.Entity) // Map of 64-bit uppercase-hex KeyIds
	indexFingerprint map[PgpFingerprint](*openpgp.Entity)
}

type Keyrings struct {
	Public []*KeyringFile
	Secret []*KeyringFile
	P3SKB  *P3SKBKeyringFile
}

func (k Keyrings) MakeKeyrings(filenames []string, isPublic bool) []*KeyringFile {
	v := make([]*KeyringFile, len(filenames), len(filenames))
	for i, filename := range filenames {
		v[i] = &KeyringFile{filename, openpgp.EntityList{}, isPublic, nil, nil}
	}
	return v
}

func NewKeyrings(e Env, usage Usage) *Keyrings {
	ret := &Keyrings{}
	if usage.GpgKeyring {
		ret.Public = ret.MakeKeyrings(e.GetPublicKeyrings(), true)
		ret.Secret = ret.MakeKeyrings(e.GetPgpSecretKeyrings(), false)
	}
	if usage.KbKeyring {
		ret.P3SKB = NewP3SKBKeyringFile(e.GetSecretKeyring())
	}
	return ret
}

//===================================================================
//
// Make our Keryings struct meet the openpgp.KeyRing
// interface
//

func (k Keyrings) KeysById(id uint64) []openpgp.Key {
	out := make([]openpgp.Key, 10)
	for _, ring := range k.Public {
		out = append(out, ring.Entities.KeysById(id)...)
	}
	for _, ring := range k.Secret {
		out = append(out, ring.Entities.KeysById(id)...)
	}
	return out
}

func (k Keyrings) KeysByIdUsage(id uint64, usage byte) []openpgp.Key {
	out := make([]openpgp.Key, 10)
	for _, ring := range k.Public {
		out = append(out, ring.Entities.KeysByIdUsage(id, usage)...)
	}
	for _, ring := range k.Secret {
		out = append(out, ring.Entities.KeysByIdUsage(id, usage)...)
	}
	return out
}

func (k Keyrings) DecryptionKeys() []openpgp.Key {
	out := make([]openpgp.Key, 10)
	for _, ring := range k.Secret {
		out = append(out, ring.Entities.DecryptionKeys()...)
	}
	return out
}

//===================================================================

func (k Keyrings) FindKey(fp PgpFingerprint, secret bool) *openpgp.Entity {
	var l []*KeyringFile
	if secret {
		l = k.Secret
	} else {
		l = k.Public
	}
	for _, file := range l {
		key, found := file.indexFingerprint[fp]
		if found && key != nil && (!secret || key.PrivateKey != nil) {
			return key
		}
	}

	return nil
}

//===================================================================

func (k *Keyrings) Load() (err error) {
	G.Log.Debug("+ Loading keyrings")
	if k.Public != nil {
		err = k.LoadKeyrings(k.Public)
	}
	if err == nil && k.Secret != nil {
		k.LoadKeyrings(k.Secret)
	}
	if k.P3SKB != nil && err == nil {
		if e2 := k.P3SKB.LoadAndIndex(); e2 != nil && !os.IsNotExist(e2) {
			err = e2
		}
	}
	G.Log.Debug("- Loaded keyrings")
	return err
}

func (k *Keyrings) LoadKeyrings(v []*KeyringFile) (err error) {
	for _, k := range v {
		if err = k.LoadAndIndex(); err != nil {
			return err
		}
	}
	return nil
}

func (k *KeyringFile) LoadAndIndex() error {
	var err error
	G.Log.Debug("+ LoadAndIndex on %s", k.filename)
	if err = k.Load(); err == nil {
		err = k.Index()
	}
	G.Log.Debug("- LoadAndIndex on %s -> %s", k.filename, ErrToOk(err))
	return err
}

func (k *KeyringFile) Index() error {
	G.Log.Debug("+ Index on %s", k.filename)
	k.indexId = make(map[string](*openpgp.Entity))
	k.indexFingerprint = make(map[PgpFingerprint](*openpgp.Entity))
	p := 0
	s := 0
	for _, entity := range k.Entities {
		if entity.PrimaryKey != nil {
			id := entity.PrimaryKey.KeyIdString()
			k.indexId[id] = entity
			fp := PgpFingerprint(entity.PrimaryKey.Fingerprint)
			k.indexFingerprint[fp] = entity
			p++
		}
		for _, subkey := range entity.Subkeys {
			if subkey.PublicKey != nil {
				id := subkey.PublicKey.KeyIdString()
				k.indexId[id] = entity
				fp := PgpFingerprint(subkey.PublicKey.Fingerprint)
				k.indexFingerprint[fp] = entity
				s++
			}
		}
	}
	G.Log.Debug("| Indexed %d primary and %d subkeys", p, s)
	G.Log.Debug("- Index on %s -> %s", k.filename, "OK")
	return nil
}

func (k *KeyringFile) Load() error {
	G.Log.Debug(fmt.Sprintf("+ Loading PGP Keyring %s", k.filename))
	file, err := os.Open(k.filename)
	if os.IsNotExist(err) {
		G.Log.Warning(fmt.Sprintf("No PGP Keyring found at %s", k.filename))
		err = nil
	} else if err != nil {
		G.Log.Error(fmt.Sprintf("Cannot open keyring %s: %s\n", err.Error()))
		return err
	}
	if file != nil {
		k.Entities, err = openpgp.ReadKeyRing(file)
		if err != nil {
			G.Log.Error(fmt.Sprintf("Cannot parse keyring %s: %s\n", err.Error()))
			return err
		}
	}
	G.Log.Debug(fmt.Sprintf("- Successfully loaded PGP Keyring"))
	return nil
}

func (k KeyringFile) WriteTo(w io.Writer) error {
	for _, e := range k.Entities {
		if err := e.Serialize(w); err != nil {
			return err
		}
	}
	return nil
}

func (k KeyringFile) GetFilename() string { return k.filename }

func (k KeyringFile) Save() error {
	return SafeWriteToFile(k)
}

// GetSecretKeyLocked gets a secret key for the current user by first
// looking for keys synced from the server, and if that fails, tries
// those in the local Keyring that are also active for the user.
// In any case, the key will be locked.
func (k Keyrings) GetSecretKeyLocked() (ret *P3SKB, which string, err error) {
	var me *User

	G.Log.Debug("+ GetSecretKeyLocked()")
	defer func() {
		G.Log.Debug("- GetSecretKeyLocked() -> %s", ErrToOk(err))
	}()

	G.Log.Debug("| LoadMe w/ Secrets on")

	// Load our session in before we start to LoadMe; since loading me
	// might need to sync our Private key from the server
	if err = G.Session.Load(); err != nil {
		return
	}

	if me, err = LoadMe(LoadUserArg{}); err != nil {
		return
	}

	if ret, err = me.GetSyncedSecretKey(); err != nil {
		return
	} else if ret != nil {
		G.Log.Debug("| Found secret key in user object")
		which = "your Keybase.io login"
	} else {
		G.Log.Debug("| Getting local secret key")
		ret = k.GetLockedLocalSecretKey(me)
	}

	if ret == nil {
		err = NoSecretKeyError{}
	}
	return

}

// GetLockedLocalSecretKey looks in the local keyring to find a key
// for the given user.  Return non-nil if one was found, and nil
// otherwise.
func (k Keyrings) GetLockedLocalSecretKey(me *User) (ret *P3SKB) {
	if k.P3SKB == nil {
		G.Log.Debug("| No secret keyring found")
	} else if ckf := me.GetComputedKeyFamily(); ckf == nil {
		G.Log.Debug("| No ComputedKeyFamily found")
	} else {
		G.Log.Debug("| Looking up secret key in local keychain")
		ret = k.P3SKB.LookupWithComputedKeyFamily(ckf)
	}
	return ret
}

func (k Keyrings) GetSecretKey(reason string, ui SecretUI) (key GenericKey, err error) {
	G.Log.Debug("+ GetSecretKey(%s)", reason)
	defer func() {
		G.Log.Debug("- GetSecretKey() -> %s", ErrToOk(err))
	}()
	var p3skb *P3SKB
	var which string
	if p3skb, which, err = k.GetSecretKeyLocked(); err == nil && p3skb != nil {
		G.Log.Debug("| Prompt/Unlock key")
		key, err = p3skb.PromptAndUnlock(reason, which, ui)
	}
	return
}

type EmptyKeyRing struct{}

func (k EmptyKeyRing) KeysById(id uint64) []openpgp.Key {
	return []openpgp.Key{}
}
func (k EmptyKeyRing) KeysByIdUsage(id uint64, usage byte) []openpgp.Key {
	return []openpgp.Key{}
}
func (k EmptyKeyRing) DecryptionKeys() []openpgp.Key {
	return []openpgp.Key{}
}
