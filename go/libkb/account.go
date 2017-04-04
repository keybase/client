// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type timedGenericKey struct {
	Contextified
	key   GenericKey
	which string
	atime time.Time
}

func newTimedGenericKey(g *GlobalContext, k GenericKey, w string) *timedGenericKey {
	return &timedGenericKey{
		Contextified: NewContextified(g),
		key:          k,
		atime:        g.Clock().Now(),
		which:        w,
	}
}

func (t *timedGenericKey) getKey() GenericKey {
	t.atime = t.G().Clock().Now()
	return t.key
}

func (t *timedGenericKey) clean() {
	now := t.G().Clock().Now()
	if t.key != nil && (now.Sub(t.atime) > PaperKeyMemoryTimeout) {
		t.G().Log.Debug("Cleaned out key %q at %s", t.which, now)
		t.key = nil
	}
}

type Account struct {
	Contextified
	secretSyncer *SecretSyncer
	localSession *Session
	loginSession *LoginSession
	streamCache  *PassphraseStreamCache
	skbKeyring   *SKBKeyringFile
	secSigKey    GenericKey // cached secret signing key
	secEncKey    GenericKey // cached secret encryption key
	lksec        *LKSec     // local key security (this member not currently used)

	paperSigKey *timedGenericKey // cached, unlocked paper signing key
	paperEncKey *timedGenericKey // cached, unlocked paper encryption key

	secretPromptCanceledAt time.Time // when the secret prompt was last canceled

	testPostCleanHook func() // for testing, call this hook after cleaning
}

// Account implements a LoginContext
var _ LoginContext = (*Account)(nil)

func NewAccount(g *GlobalContext) *Account {
	return &Account{
		localSession: newSession(g),
		secretSyncer: NewSecretSyncer(g),
		Contextified: NewContextified(g),
	}
}

func (a *Account) LocalSession() *Session {
	return a.localSession
}

func (a *Account) GetUID() (ret keybase1.UID) {
	if a.localSession != nil {
		ret = a.localSession.GetUID()
	}
	return ret
}

func (a *Account) UnloadLocalSession() {
	a.localSession = newSession(a.G())
}

// LoggedIn returns true if the user is logged in.  It does not
// try to load the session.
func (a *Account) LoggedIn() bool {
	return a.LocalSession().IsLoggedIn()
}

func (a *Account) LoggedInAndProvisioned() bool {
	return a.LocalSession().IsLoggedInAndProvisioned()
}

// LoggedInLoad will load and check the session with the api server if necessary.
func (a *Account) LoggedInLoad() (bool, error) {
	return a.LocalSession().loadAndCheck()
}

func (a *Account) LoggedInProvisionedLoad() (bool, error) {
	return a.LocalSession().loadAndCheckProvisioned()
}

func (a *Account) LoadLoginSession(emailOrUsername string) error {
	if a.LoginSession().ExistsFor(emailOrUsername) && a.LoginSession().NotExpired() {
		return nil
	}

	ls := NewLoginSession(emailOrUsername, a.G())
	if err := ls.Load(); err != nil {
		return err
	}
	a.setLoginSession(ls)
	return nil
}

func (a *Account) CreateLoginSessionWithSalt(emailOrUsername string, salt []byte) error {
	if a.loginSessionExists() {
		return fmt.Errorf("CreateLoginSessionWithSalt called, but Account already has LoginSession")
	}

	ls := NewLoginSessionWithSalt(emailOrUsername, salt, a.G())
	a.setLoginSession(ls)
	return nil
}

func (a *Account) setLoginSession(ls *LoginSession) {
	if a.loginSession != nil {
		// this usually happens in tests that don't call G.Logout() to logout.
		// But it probably signifies an error.
		a.G().Log.Debug("Account: overwriting loginSession")
	}

	a.loginSession = ls
}

func (a *Account) loginSessionExists() bool {
	return a.LoginSession() != nil
}

func (a *Account) LoginSession() *LoginSession {
	return a.loginSession
}

func (a *Account) Logout() error {
	a.ClearStreamCache()

	if err := a.localSession.Logout(); err != nil {
		return err
	}

	a.UnloadLocalSession()
	a.loginSession = nil
	a.ClearKeyring()

	a.secretSyncer.Clear()
	a.secretSyncer = NewSecretSyncer(a.G())

	a.ClearCachedSecretKeys()

	a.lksec = nil

	return nil
}

func (a *Account) CreateStreamCache(tsec Triplesec, pps *PassphraseStream) {
	if a.streamCache != nil {
		a.G().Log.Warning("Account.CreateStreamCache overwriting existing StreamCache")
	}
	a.streamCache = NewPassphraseStreamCache(tsec, pps)
	a.SetLKSec(NewLKSec(pps, a.GetUID(), a.G()))
}

// SetStreamGeneration sets the passphrase generation on the cached stream
// if it exists, and otherwise will wind up warning of a problem.
func (a *Account) SetStreamGeneration(gen PassphraseGeneration, nilPPStreamOK bool) {
	ps := a.PassphraseStreamRef()
	if ps == nil {
		if !nilPPStreamOK {
			a.G().Log.Warning("Passphrase stream was nil; unexpected")
		}
	} else {
		ps.SetGeneration(gen)
	}
}

// GetStreamGeneration() gets the generation of the currently cached
// passphrase stream
func (a *Account) GetStreamGeneration() (ret PassphraseGeneration) {
	if ps := a.PassphraseStream(); ps != nil {
		ret = ps.Generation()
	}
	return
}

func (a *Account) CreateStreamCacheViaStretch(passphrase string) error {
	if a.streamCache.Valid() {
		return nil
	}

	salt, err := a.loginSession.Salt()
	if err != nil {
		return err
	}

	tsec, pps, err := StretchPassphrase(a.G(), passphrase, salt)
	if err != nil {
		return err
	}

	a.streamCache = NewPassphraseStreamCache(tsec, pps)

	a.SetLKSec(NewLKSec(pps, a.GetUID(), a.G()))

	return nil
}

func (a *Account) PassphraseStreamCache() *PassphraseStreamCache {
	return a.streamCache
}

// PassphraseStream returns a copy of the currently cached passphrase stream,
// or nil if none is there.
func (a *Account) PassphraseStream() *PassphraseStream {
	return a.PassphraseStreamCache().PassphraseStream()
}

// PassphraseStreamRef returns a reference to the actual passphrase stream, or
// nil if none is there.
func (a *Account) PassphraseStreamRef() *PassphraseStream {
	return a.PassphraseStreamCache().PassphraseStreamRef()
}

func (a *Account) ClearStreamCache() {
	a.streamCache.Clear()
	a.streamCache = nil
	a.lksec = nil
}

// ClearLoginSession clears out any cached login sessions with the account
// object
func (a *Account) ClearLoginSession() {
	if a.loginSession != nil {
		// calling this is pointless since setting to nil next:
		a.loginSession.Clear()
		a.loginSession = nil
	}
}

func (a *Account) SetLKSec(lks *LKSec) {
	a.lksec = lks
}

func (a *Account) LKSec() *LKSec {
	return a.lksec
}

// LKSecUnlock isn't used, but it could be.  It's here for a future
// refactoring of the key unlock mess.
func (a *Account) LKSecUnlock(locked []byte) ([]byte, PassphraseGeneration, error) {
	if a.lksec == nil {
		return nil, 0, errors.New("LKSecUnlock: no lksec in account")
	}
	key, gen, _, err := a.lksec.Decrypt(a, locked)
	return key, gen, err
}

func (a *Account) SecretSyncer() *SecretSyncer {
	return a.secretSyncer
}

func (a *Account) RunSecretSyncer(uid keybase1.UID) error {
	return RunSyncer(a.SecretSyncer(), uid, a.LoggedIn(), a.localSession)
}

func (a *Account) Keyring() (*SKBKeyringFile, error) {
	if a.localSession == nil {
		a.G().Log.Warning("local session is nil")
	}
	a.LocalSession().loadAndCheck()
	if a.localSession == nil {
		a.G().Log.Warning("local session after load is nil")
	}
	unp := a.localSession.GetUsername()
	// not sure how this could happen, but just in case:
	if unp == nil {
		return nil, NoUsernameError{}
	}

	if a.skbKeyring != nil && a.skbKeyring.IsForUsername(*unp) {
		a.G().Log.Debug("Account: found loaded keyring for %s", *unp)
		return a.skbKeyring, nil
	}

	a.skbKeyring = nil

	a.G().Log.Debug("Account: loading keyring for %s", *unp)
	kr, err := LoadSKBKeyring(*unp, a.G())
	if err != nil {
		return nil, err
	}
	a.skbKeyring = kr
	return a.skbKeyring, nil
}

func (a *Account) getDeviceKey(ckf *ComputedKeyFamily, secretKeyType SecretKeyType, nun NormalizedUsername) (GenericKey, error) {
	did := a.G().Env.GetDeviceIDForUsername(nun)
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
func (a *Account) LockedLocalSecretKey(ska SecretKeyArg) (*SKB, error) {
	var ret *SKB
	me := ska.Me
	a.EnsureUsername(me.GetNormalizedName())

	keyring, err := a.Keyring()
	if err != nil {
		return nil, err
	}
	if keyring == nil {
		a.G().Log.Debug("| No secret keyring found: %s", err)
		return nil, NoKeyringsError{}
	}

	ckf := me.GetComputedKeyFamily()
	if ckf == nil {
		a.G().Log.Warning("No ComputedKeyFamily found for %s", me.name)
		return nil, KeyFamilyError{Msg: "not found for " + me.name}
	}

	if (ska.KeyType == DeviceSigningKeyType) || (ska.KeyType == DeviceEncryptionKeyType) {
		key, err := a.getDeviceKey(ckf, ska.KeyType, me.GetNormalizedName())
		if err != nil {
			a.G().Log.Debug("| No key for current device: %s", err)
			return nil, err
		}

		if key == nil {
			a.G().Log.Debug("| Key for current device is nil")
			return nil, NoKeyError{Msg: "Key for current device is nil"}
		}

		kid := key.GetKID()
		a.G().Log.Debug("| Found KID for current device: %s", kid)
		ret = keyring.LookupByKid(kid)
		if ret != nil {
			a.G().Log.Debug("| Using device key: %s", kid)
		}
	} else {
		a.G().Log.Debug("| Looking up secret key in local keychain")
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

func (a *Account) Shutdown() error {
	return nil
}

func (a *Account) EnsureUsername(username NormalizedUsername) {
	su := a.LocalSession().GetUsername()
	if su == nil {
		a.LocalSession().SetUsername(username)
		return
	}
	if *su != username {
		a.Logout()
		a.LocalSession().SetUsername(username)
	}

}

func (a *Account) UserInfo() (uid keybase1.UID, username NormalizedUsername,
	token string, deviceSubkey, deviceSibkey GenericKey, err error) {
	if !a.LoggedIn() {
		err = LoginRequiredError{}
		return
	}

	arg := LoadUserArg{LoginContext: a, Contextified: NewContextified(a.G()), Self: true}
	err = a.G().GetFullSelfer().WithUser(arg, func(user *User) error {
		var err error
		deviceSubkey, err = user.GetDeviceSubkey()
		if err != nil {
			return err
		}
		deviceSibkey, err = user.GetDeviceSibkey()
		if err != nil {
			return err
		}
		uid = user.GetUID()
		username = user.GetNormalizedName()
		return nil

	})
	token = a.localSession.GetToken()
	return
}

// SaveState saves the logins state to memory, and to the user
// config file.
func (a *Account) SaveState(sessionID, csrf string, username NormalizedUsername, uid keybase1.UID, deviceID keybase1.DeviceID) error {
	if err := a.saveUserConfig(username, uid, deviceID); err != nil {
		return err
	}
	return a.LocalSession().SetLoggedIn(sessionID, csrf, username, uid, deviceID)
}

func (a *Account) saveUserConfig(username NormalizedUsername, uid keybase1.UID, deviceID keybase1.DeviceID) error {
	cw := a.G().Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}

	// XXX I don't understand the intent of clearing the login session here.
	// All tests pass with this removed, but I'm wary of making any changes.
	// The git history didn't help, and this is the only place this function
	// is used (where it matters).
	if err := a.LoginSession().Clear(); err != nil {
		return err
	}
	salt, err := a.LoginSession().Salt()
	if err != nil {
		return err
	}

	// Note that `true` here means that an existing user config entry will
	// be overwritten.
	return cw.SetUserConfig(NewUserConfig(uid, username, salt, deviceID), true /* overwrite */)
}

func (a *Account) Dump() {
	fmt.Printf("Account dump:\n")
	a.loginSession.Dump()
	a.streamCache.Dump()
}

func (a *Account) CachedSecretKey(ska SecretKeyArg) (GenericKey, error) {
	if ska.KeyType == DeviceSigningKeyType {
		if a.secSigKey != nil {
			return a.secSigKey, nil
		}
		return nil, NotFoundError{}
	}
	if ska.KeyType == DeviceEncryptionKeyType {
		if a.secEncKey != nil {
			return a.secEncKey, nil
		}
		return nil, NotFoundError{}
	}
	return nil, fmt.Errorf("invalid key type for cached secret key: %d", ska.KeyType)
}

func (a *Account) SetCachedSecretKey(ska SecretKeyArg, key GenericKey) error {
	if key == nil {
		return errors.New("cache of nil secret key attempted")
	}
	if ska.KeyType == DeviceSigningKeyType {
		a.G().Log.Debug("caching secret key for %d", ska.KeyType)
		a.secSigKey = key
		if err := a.G().ActiveDevice.setSigningKey(a.localSession.GetUID(), a.localSession.GetDeviceID(), key); err != nil {
			return err
		}
		return nil
	}
	if ska.KeyType == DeviceEncryptionKeyType {
		a.G().Log.Debug("caching secret key for %d", ska.KeyType)
		a.secEncKey = key
		if err := a.G().ActiveDevice.setEncryptionKey(a.localSession.GetUID(), a.localSession.GetDeviceID(), key); err != nil {
			return err
		}
		return nil
	}
	return fmt.Errorf("attempt to cache invalid key type: %d", ska.KeyType)
}

func (a *Account) SetUnlockedPaperKey(sig GenericKey, enc GenericKey) error {
	a.paperSigKey = newTimedGenericKey(a.G(), sig, "paper signing key")
	a.paperEncKey = newTimedGenericKey(a.G(), enc, "paper encryption key")
	return nil
}

func (a *Account) GetUnlockedPaperSigKey() GenericKey {
	if a.paperSigKey == nil {
		return nil
	}
	return a.paperSigKey.getKey()
}

func (a *Account) GetUnlockedPaperEncKey() GenericKey {
	if a.paperEncKey == nil {
		return nil
	}
	return a.paperEncKey.getKey()
}

func (a *Account) ClearCachedSecretKeys() {
	a.G().Log.Debug("clearing cached secret keys")
	a.secSigKey = nil
	a.secEncKey = nil
	a.ClearPaperKeys()
	a.G().ActiveDevice.clear()
}

func (a *Account) ClearPaperKeys() {
	a.G().Log.Debug("clearing cached paper keys")
	a.paperEncKey = nil
	a.paperSigKey = nil
}

func (a *Account) SetTestPostCleanHook(f func()) {
	a.testPostCleanHook = f
}

func (a *Account) clean() {
	if a.paperEncKey != nil {
		a.paperEncKey.clean()
	}
	if a.paperSigKey != nil {
		a.paperSigKey.clean()
	}
	if a.testPostCleanHook != nil {
		a.testPostCleanHook()
	}
}

func (a *Account) ClearKeyring() {
	a.skbKeyring = nil
}

func (a *Account) SkipSecretPrompt() bool {
	if a.secretPromptCanceledAt.IsZero() {
		return false
	}

	if a.G().Clock().Now().Sub(a.secretPromptCanceledAt) < SecretPromptCancelDuration {
		return true
	}

	a.secretPromptCanceledAt = time.Time{}
	return false
}

func (a *Account) SecretPromptCanceled() {
	a.secretPromptCanceledAt = a.G().Clock().Now()
}
