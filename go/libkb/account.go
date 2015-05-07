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
	secretSyncer *SecretSyncer
	skbKeyring   *SKBKeyringFile
	Contextified
	sync.RWMutex
}

func NewAccount(g *GlobalContext) *Account {
	return &Account{
		Contextified: NewContextified(g),
	}
}

func (a *Account) LoggedIn() bool {
	return false
}

func (a *Account) LoadLocalSession() error {
	return nil
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
		a.G().Log.Warning("Account: overwriting loginSession")
		// return
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
