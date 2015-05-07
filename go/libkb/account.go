package libkb

import (
	"errors"
	"fmt"
	"sync"
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
	if a.loginSessionExistsFor(emailOrUsername) {
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
	a.RLock()
	defer a.RUnlock()
	return a.loginSession != nil
}

func (a *Account) loginSessionExistsFor(emailOrUsername string) bool {
	a.RLock()
	defer a.RUnlock()
	if a.loginSession == nil {
		return false
	}
	return a.loginSession.ExistsFor(emailOrUsername)
}

func (a *Account) LoginSession() *LoginSession {
	a.RLock()
	defer a.RUnlock()
	return a.loginSession
}

func (a *Account) LoginSessionSalt() ([]byte, error) {
	ls := a.LoginSession()
	if ls == nil {
		return nil, errors.New("no login session")
	}
	return ls.Salt()
}

func (a *Account) LoginSessionClear() error {
	a.RLock()
	defer a.RUnlock()
	if a.loginSession == nil {
		// it's ok to call clear on a nil loginsession
		return nil
	}
	return a.loginSession.Clear()
}

func (a *Account) Logout() error {
	return nil
}
