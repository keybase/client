package libkb

import (
	"errors"
	"fmt"

	keybase1 "github.com/keybase/client/protocol/go"
	triplesec "github.com/keybase/go-triplesec"
)

type Account struct {
	Contextified
	secretSyncer *SecretSyncer
	localSession *Session
	loginSession *LoginSession
	streamCache  *PassphraseStreamCache
	skbKeyring   *SKBKeyringFile
}

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

func (a *Account) UnloadLocalSession() {
	a.localSession = newSession(a.G())
}

// LoggedIn returns true if the user is logged in.  It does not
// try to load the session.
func (a *Account) LoggedIn() bool {
	return a.LocalSession().IsLoggedIn()
}

func (a *Account) LoggedInAndProvisioined() bool {
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
	if a.LoginSession().ExistsFor(emailOrUsername) {
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
		a.G().Log.Warning("Account: overwriting loginSession")
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
	a.skbKeyring = nil

	a.secretSyncer.Clear()
	a.secretSyncer = NewSecretSyncer(a.G())

	return nil
}

func (a *Account) CreateStreamCache(tsec *triplesec.Cipher, pps *PassphraseStream) {
	if a.streamCache != nil {
		a.G().Log.Warning("Account.CreateStreamCache overwriting exisitng StreamCache")
	}
	a.streamCache = NewPassphraseStreamCache(tsec, pps)
}

// SetStreamGeneration sets the passphrase generation on the cached stream
// if it exists, and otherwise will wind up warning of a problem.
func (a *Account) SetStreamGeneration(gen PassphraseGeneration) {
	a.G().Log.Warning("set gen: %d", gen)
	ps := a.PassphraseStreamRef()
	if ps == nil {
		a.G().Log.Warning("Passphrase stream was nil; unexpected")
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

	tsec, pps, err := StretchPassphrase(passphrase, salt)
	if err != nil {
		return err
	}

	a.streamCache = NewPassphraseStreamCache(tsec, pps)

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
}

// ClearLoginSession clears out any cached login sessions with the account
// object
func (a *Account) ClearLoginSession() {
	if a.loginSession != nil {
		a.loginSession.Clear()
		a.loginSession = nil
	}
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
	kr := a.skbKeyring
	if kr != nil {
		return kr, nil
	}

	unp := a.localSession.GetUsername()
	// not sure how this could happen, but just in case:
	if unp == nil {
		return nil, NoUsernameError{}
	}
	kr, err := LoadSKBKeyring(*unp, a.G())
	if err != nil {
		return nil, err
	}
	a.skbKeyring = kr
	return a.skbKeyring, nil
}

func (a *Account) getDeviceKey(ckf *ComputedKeyFamily, secretKeyType SecretKeyType) (GenericKey, error) {
	did := a.G().Env.GetDeviceID()
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
func (a *Account) LockedLocalSecretKey(ska SecretKeyArg) *SKB {
	var ret *SKB
	me := ska.Me
	a.EnsureUsername(me.GetName())

	keyring, err := a.Keyring()
	if err != nil || keyring == nil {
		var s string
		if err != nil {
			s = " (" + err.Error() + ")"
		}
		a.G().Log.Debug("| No secret keyring found" + s)
		return nil
	}

	ckf := me.GetComputedKeyFamily()
	if ckf == nil {
		a.G().Log.Warning("No ComputedKeyFamily found for %s", me.name)
		return nil
	}

	if (ska.KeyType == DeviceSigningKeyType) || (ska.KeyType == DeviceEncryptionKeyType) {
		key, err := a.getDeviceKey(ckf, ska.KeyType)
		if err != nil {
			a.G().Log.Debug("| No key for current device: %s", err)
		}

		if key == nil {
			a.G().Log.Debug("| Key for current device is nil")
		} else {
			kid := key.GetKID()
			a.G().Log.Debug("| Found KID for current device: %s", kid)
			ret = keyring.LookupByKid(kid)
			if ret != nil {
				a.G().Log.Debug("| Using device key: %s", kid)
			}
		}
	} else {
		a.G().Log.Debug("| Looking up secret key in local keychain")
		ret = keyring.SearchWithComputedKeyFamily(ckf, ska)
	}

	if ret != nil {
		ret.SetUID(me.GetUID())
	}

	return ret
}

func (a *Account) Shutdown() error {
	return a.LocalSession().Write()
}

func (a *Account) EnsureUsername(username string) {
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

func (a *Account) UserInfo() (uid keybase1.UID, username, token string, deviceSubkey GenericKey, err error) {
	if !a.LoggedIn() {
		err = LoginRequiredError{}
		return
	}

	user, err := LoadMe(LoadUserArg{LoginContext: a})
	if err != nil {
		return
	}

	deviceSubkey, err = user.GetDeviceSubkey()
	if err != nil {
		return
	}

	uid = user.GetUID()
	username = user.GetName()
	token = a.localSession.GetToken()
	return
}

func (a *Account) SaveState(sessionID, csrf, username string, uid keybase1.UID) error {
	cw := a.G().Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}

	if err := a.LoginSession().Clear(); err != nil {
		return err
	}
	salt, err := a.LoginSession().Salt()
	if err != nil {
		return err
	}
	var nilDeviceID keybase1.DeviceID
	if err := cw.SetUserConfig(NewUserConfig(uid, username, salt, nilDeviceID), false); err != nil {
		return err
	}
	if err := cw.Write(); err != nil {
		return err
	}
	a.LocalSession().SetLoggedIn(sessionID, csrf, username, uid)
	if err := a.LocalSession().Write(); err != nil {
		return err
	}

	return nil
}

func (a *Account) Dump() {
	fmt.Printf("Account dump:\n")
	a.loginSession.Dump()
	a.streamCache.Dump()
}
