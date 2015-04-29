package libkb

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"

	"golang.org/x/crypto/openpgp"
)

type KeyringFile struct {
	filename         string
	Entities         openpgp.EntityList
	isPublic         bool
	indexId          map[string](*openpgp.Entity) // Map of 64-bit uppercase-hex KeyIds
	indexFingerprint map[PgpFingerprint](*openpgp.Entity)
	Contextified
}

type Keyrings struct {
	skbMap map[string]*SKBKeyringFile // map of usernames to keyring files
	sync.Mutex
	skbfile *SKBKeyringFile
	Contextified
}

func (k *Keyrings) MakeKeyrings(filenames []string, isPublic bool) []*KeyringFile {
	v := make([]*KeyringFile, len(filenames), len(filenames))
	for i, filename := range filenames {
		v[i] = &KeyringFile{filename, openpgp.EntityList{}, isPublic, nil, nil, Contextified{g: k.G()}}
	}
	return v
}

func NewKeyrings(g *GlobalContext) *Keyrings {
	ret := &Keyrings{
		skbMap:       make(map[string]*SKBKeyringFile),
		Contextified: Contextified{g: g},
	}
	return ret
}

//===================================================================

func (g *GlobalContext) SKBFilenameForUser(un string) string {
	tmp := g.Env.GetSecretKeyringTemplate()
	token := "%u"
	if strings.Index(tmp, token) < 0 {
		return tmp
	}

	return strings.Replace(tmp, token, un, -1)
}

// Note:  you need to be logged in as 'un' for this function to
// work.  Otherwise, it just silently returns nil, nil.
func (k *Keyrings) LoadSKBKeyring(un string) (f *SKBKeyringFile, err error) {
	k.Lock()
	defer k.Unlock()

	if k.skbfile == nil {
		if len(un) == 0 {
			return nil, NoUsernameError{}
		}

		k.skbfile = NewSKBKeyringFile(k.G().SKBFilenameForUser(un))
		err := k.skbfile.LoadAndIndex()
		if err != nil && !os.IsNotExist(err) {
			return nil, err
		}
	}
	return k.skbfile, nil
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
		G.Log.Errorf("Cannot open keyring %s: %s\n", k.filename, err.Error())
		return err
	}
	if file != nil {
		k.Entities, err = openpgp.ReadKeyRing(file)
		if err != nil {
			G.Log.Errorf("Cannot parse keyring %s: %s\n", k.filename, err.Error())
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

func (k KeyringFile) Save() error {
	return SafeWriteToFile(k)
}

// GetSecretKeyLocked gets a secret key for the current user by first
// looking for keys synced from the server, and if that fails, tries
// those in the local Keyring that are also active for the user.
// In any case, the key will be locked.
func (k *Keyrings) GetSecretKeyLocked(ska SecretKeyArg) (ret *SKB, which string, err error) {

	k.G().Log.Debug("+ GetSecretKeyLocked()")
	defer func() {
		k.G().Log.Debug("- GetSecretKeyLocked() -> %s", ErrToOk(err))
	}()

	k.G().Log.Debug("| LoadMe w/ Secrets on")

	if ska.Me == nil {
		if ska.Me, err = LoadMe(LoadUserArg{}); err != nil {
			return
		}
	}

	if ret = k.GetLockedLocalSecretKey(ska); ret != nil {
		k.G().Log.Debug("| Getting local secret key")
		return
	}

	var pub GenericKey

	if !ska.UseSyncedPGPKey() {
		k.G().Log.Debug("| Skipped Synced PGP key (via prefs)")
	} else if ret, err = ska.Me.GetSyncedSecretKey(); err != nil {
		k.G().Log.Warning("Error fetching synced PGP secret key: %s", err.Error())
		return
	} else if ret == nil {
	} else if pub, err = ret.GetPubKey(); err != nil {
	} else if len(ska.KeyQuery) > 0 && !KeyMatchesQuery(pub, ska.KeyQuery) {
		k.G().Log.Debug("| Can't use Synced PGP key; doesn't match query %s", ska.KeyQuery)
		ret = nil
	} else {
		which = "your Keybase.io passphrase"
	}

	if ret == nil {
		err = NoSecretKeyError{}
	}
	return

}

// GetLockedLocalSecretKey looks in the local keyring to find a key
// for the given user.  Return non-nil if one was found, and nil
// otherwise.
func (k *Keyrings) GetLockedLocalSecretKey(ska SecretKeyArg) (ret *SKB) {
	var keyring *SKBKeyringFile
	var err error
	var ckf *ComputedKeyFamily

	me := ska.Me

	k.G().Log.Debug("+ GetLockedLocalSecretKey(%s)", me.name)
	defer func() {
		k.G().Log.Debug("- GetLockedLocalSecretKey -> found=%v", ret != nil)
	}()

	if keyring, err = k.LoadSKBKeyring(me.name); err != nil || keyring == nil {
		var s string
		if err != nil {
			s = " (" + err.Error() + ")"
		}
		k.G().Log.Debug("| No secret keyring found" + s)
		return
	}

	if ckf = me.GetComputedKeyFamily(); ckf == nil {
		k.G().Log.Warning("No ComputedKeyFamily found for %s", me.name)
		return
	}

	var kid KID
	if !ska.UseDeviceKey() {
		k.G().Log.Debug("| not using device key; preferences have disabled it")
	} else if kid, err = ckf.GetActiveSibkeyKidForCurrentDevice(k.G()); err != nil {
		k.G().Log.Debug("| No key for current device: %s", err.Error())
	} else if kid != nil {
		k.G().Log.Debug("| Found KID for current device: %s", kid)
		ret = keyring.LookupByKid(kid)
		if ret != nil {
			k.G().Log.Debug("| Using device key: %s", kid)
		}
	} else {
		k.G().Log.Debug("| Empty kid for current device")
	}

	if ret == nil && ska.SearchForKey() {
		k.G().Log.Debug("| Looking up secret key in local keychain")
		ret = keyring.SearchWithComputedKeyFamily(ckf, ska)
	}
	return ret
}

type SecretKeyArg struct {

	// Which keys to search for
	All          bool // use all possible keys
	DeviceKey    bool // use the device key (on by default)
	SyncedPGPKey bool // use the sync'ed PGP key if there is one
	SearchKey    bool // search for any key that's active in the local keyring
	PGPOnly      bool // only PGP, but use the first valid PGP key we find

	Me *User // Whose keys

	KeyQuery string // a String to match the key prefix on
}

func (s SecretKeyArg) UseDeviceKey() bool    { return (s.All || s.DeviceKey) && !s.PGPOnly }
func (s SecretKeyArg) SearchForKey() bool    { return s.All || s.SearchKey || s.PGPOnly }
func (s SecretKeyArg) UseSyncedPGPKey() bool { return s.All || s.SyncedPGPKey }

// TODO: Figure out whether and how to dep-inject the SecretStore.
func (k *Keyrings) GetSecretKeyWithPrompt(ska SecretKeyArg, secretUI SecretUI, reason string) (key GenericKey, skb *SKB, err error) {
	k.G().Log.Debug("+ GetSecretKeyWithPrompt(%s)", reason)
	defer func() {
		k.G().Log.Debug("- GetSecretKeyWithPrompt() -> %s", ErrToOk(err))
	}()
	var which string
	if skb, which, err = k.GetSecretKeyLocked(ska); err != nil {
		skb = nil
		return
	}
	var secretStore SecretStore
	if ska.Me != nil {
		skb.SetUID(ska.Me.GetUid().P())
		secretStore = NewSecretStore(ska.Me.GetName())
	}
	if key, err = skb.PromptAndUnlock(reason, which, secretStore, secretUI); err != nil {
		key = nil
		skb = nil
		return
	}
	return
}

func (k *Keyrings) GetSecretKeyWithStoredSecret(me *User, secretRetriever SecretRetriever) (key GenericKey, err error) {
	k.G().Log.Debug("+ GetSecretKeyWithStoredSecret()")
	defer func() {
		k.G().Log.Debug("- GetSecretKeyWithStoredSecret() -> %s", ErrToOk(err))
	}()
	ska := SecretKeyArg{
		All: true,
		Me:  me,
	}
	var skb *SKB
	skb, _, err = k.GetSecretKeyLocked(ska)
	if err != nil {
		return
	}
	skb.SetUID(me.GetUid().P())
	return skb.UnlockWithStoredSecret(secretRetriever)
}

func (k *Keyrings) GetSecretKeyWithPassphrase(me *User, passphrase string, secretStorer SecretStorer) (key GenericKey, err error) {
	k.G().Log.Debug("+ GetSecretKeyWithPassphrase()")
	defer func() {
		k.G().Log.Debug("- GetSecretKeyWithPassphrase() -> %s", ErrToOk(err))
	}()
	ska := SecretKeyArg{
		All: true,
		Me:  me,
	}
	var skb *SKB
	skb, _, err = k.GetSecretKeyLocked(ska)
	if err != nil {
		return
	}
	skb.SetUID(me.GetUid().P())
	tsec := k.G().LoginState().GetCachedTriplesec()
	pps := k.G().LoginState().GetCachedPassphraseStream()
	return skb.UnlockSecretKey(passphrase, tsec, pps, secretStorer)
}

func (k *Keyrings) ClearSecretKeys(username string) {
	k.Lock()
	defer k.Unlock()

	k.skbfile = nil
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
