package libkb

import (
	"fmt"
	"sync"

	triplesec "github.com/keybase/go-triplesec"
)

type Account struct {
	localSession *Session
	loginSession *LoginSession
	streamCache  *StreamCache
	skbKeyring   *SKBKeyringFile
	Contextified
	sync.RWMutex
	secretSyncerMu sync.RWMutex
	secretSyncer   *SecretSyncer
}

func NewAccount(g *GlobalContext) *Account {
	return &Account{
		localSession: newSession(g),
		secretSyncer: NewSecretSyncer(g),
		Contextified: NewContextified(g),
	}
}

func (a *Account) LocalSession() *Session {
	a.RLock()
	defer a.RUnlock()
	return a.localSession
}

// LoggedIn returns true if the user is logged in.  It does not
// try to load the session.
func (a *Account) LoggedIn() bool {
	return a.LocalSession().IsLoggedIn()
}

// LoggedInLoad will load and check the session with the api server if necessary.
func (a *Account) LoggedInLoad() (bool, error) {
	return a.LocalSession().loadAndCheck()
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
	a.Lock()
	defer a.Unlock()
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
	a.RLock()
	defer a.RUnlock()
	return a.loginSession
}

func (a *Account) Logout() error {
	a.ClearStreamCache()

	a.RLock()
	if err := a.localSession.Logout(); err != nil {
		a.RUnlock()
		return err
	}
	a.RUnlock()

	a.Lock()
	a.localSession = newSession(a.G())
	a.loginSession = nil
	a.skbKeyring = nil
	a.Unlock()

	a.secretSyncerMu.Lock()
	a.secretSyncer.Clear()
	a.secretSyncer = NewSecretSyncer(a.G())
	a.secretSyncerMu.Unlock()

	return nil
}

func (a *Account) CreateStreamCache(tsec *triplesec.Cipher, pps PassphraseStream) {
	a.Lock()
	defer a.Unlock()
	if a.streamCache != nil {
		a.G().Log.Warning("Account.CreateStreamCache overwriting exisitng StreamCache")
	}
	a.streamCache = NewStreamCache(tsec, pps)
}

func (a *Account) StreamCache() *StreamCache {
	a.RLock()
	defer a.RUnlock()
	return a.streamCache
}

func (a *Account) ClearStreamCache() {
	a.Lock()
	defer a.Unlock()
	a.streamCache.Clear()
	a.streamCache = nil
}

func (a *Account) SecretSyncer() *SecretSyncer {
	a.secretSyncerMu.RLock()
	defer a.secretSyncerMu.RUnlock()
	return a.secretSyncer
}

func (a *Account) RunSecretSyncer(uid *UID) error {
	return RunSyncer(a.SecretSyncer(), uid)
}

func (a *Account) Shutdown() error {
	return a.LocalSession().Write()
}

func (a *Account) UserInfo() (uid UID, username, token string, deviceSubkeyKid KID, err error) {

	if !a.LoggedIn() {
		err = LoginRequiredError{}
		return
	}

	user, err := LoadMe(LoadUserArg{})
	if err != nil {
		return
	}
	// lock everything to make sure the values refer to same user
	a.RLock()
	defer a.RUnlock()
	deviceSubkeyKid, err = user.GetDeviceSubkeyKid(a.G())
	if err != nil {
		deviceSubkeyKid = KID{}
		return
	}

	uid = user.GetUid()
	username = user.GetName()
	token = a.localSession.GetToken()
	return
}
