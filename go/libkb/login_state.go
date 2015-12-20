// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"runtime/debug"
	"time"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol"
	triplesec "github.com/keybase/go-triplesec"
)

// PassphraseGeneration represents which generation of the passphrase is
// currently in use.  It's used to guard against race conditions in which
// the passphrase is changed on one device which the other still has it cached.
type PassphraseGeneration int

// LoginState controls the state of the current user's login
// session and associated variables.  It also serializes access to
// the various Login functions and requests for the Account
// object.
type LoginState struct {
	Contextified
	account   *Account
	loginReqs chan loginReq
	acctReqs  chan acctReq
	activeReq string
}

// LoginContext is passed to all loginHandler functions.  It
// allows them safe access to various parts of the LoginState during
// the login process.
type LoginContext interface {
	LoggedInLoad() (bool, error)
	LoggedInProvisionedLoad() (bool, error)
	Logout() error

	CreateStreamCache(tsec *triplesec.Cipher, pps *PassphraseStream)
	CreateStreamCacheViaStretch(passphrase string) error
	PassphraseStreamCache() *PassphraseStreamCache
	ClearStreamCache()
	SetStreamGeneration(gen PassphraseGeneration, nilPPStreamOK bool)
	GetStreamGeneration() PassphraseGeneration

	CreateLoginSessionWithSalt(emailOrUsername string, salt []byte) error
	LoadLoginSession(emailOrUsername string) error
	LoginSession() *LoginSession
	ClearLoginSession()

	LocalSession() *Session
	EnsureUsername(username NormalizedUsername)
	SaveState(sessionID, csrf string, username NormalizedUsername, uid keybase1.UID, deviceID keybase1.DeviceID) error

	Keyring() (*SKBKeyringFile, error)
	LockedLocalSecretKey(ska SecretKeyArg) (*SKB, error)

	SecretSyncer() *SecretSyncer
	RunSecretSyncer(uid keybase1.UID) error

	CachedSecretKey(ska SecretKeyArg) (GenericKey, error)
	SetCachedSecretKey(ska SecretKeyArg, key GenericKey) error
}

type loginHandler func(LoginContext) error
type acctHandler func(*Account)

type loginReq struct {
	f     loginHandler
	after afterFn
	res   chan error
	name  string
}

type acctReq struct {
	f    acctHandler
	done chan struct{}
	name string
}

type loginAPIResult struct {
	sessionID string
	csrfToken string
	uid       keybase1.UID
	username  string
	ppGen     PassphraseGeneration
}

type afterFn func(LoginContext) error

// NewLoginState creates a LoginState and starts the request
// handler goroutine.
func NewLoginState(g *GlobalContext) *LoginState {
	res := &LoginState{
		Contextified: NewContextified(g),
		account:      NewAccount(g),
		loginReqs:    make(chan loginReq),
		acctReqs:     make(chan acctReq),
	}
	go res.requests()
	return res
}

func (s *LoginState) LoginWithPrompt(username string, loginUI LoginUI, secretUI SecretUI, after afterFn) (err error) {
	s.G().Log.Debug("+ LoginWithPrompt(%s) called", username)
	defer func() { s.G().Log.Debug("- LoginWithPrompt -> %s", ErrToOk(err)) }()

	err = s.loginHandle(func(lctx LoginContext) error {
		return s.loginWithPromptHelper(lctx, username, loginUI, secretUI, false)
	}, after, "loginWithPromptHelper")
	return
}

func (s *LoginState) LoginWithStoredSecret(username string, after afterFn) (err error) {
	s.G().Log.Debug("+ LoginWithStoredSecret(%s) called", username)
	defer func() { s.G().Log.Debug("- LoginWithStoredSecret -> %s", ErrToOk(err)) }()

	err = s.loginHandle(func(lctx LoginContext) error {
		return s.loginWithStoredSecret(lctx, username)
	}, after, "loginWithStoredSecret")
	return
}

func (s *LoginState) LoginWithPassphrase(username, passphrase string, storeSecret bool, after afterFn) (err error) {
	s.G().Log.Debug("+ LoginWithPassphrase(%s) called", username)
	defer func() { s.G().Log.Debug("- LoginWithPassphrase -> %s", ErrToOk(err)) }()

	err = s.loginHandle(func(lctx LoginContext) error {
		return s.loginWithPassphrase(lctx, username, passphrase, storeSecret)
	}, after, "loginWithPassphrase")
	return
}

func (s *LoginState) LoginWithKey(lctx LoginContext, user *User, key GenericKey, after afterFn) (err error) {
	s.G().Log.Debug("+ LoginWithKey(%s) called", user.GetName())
	defer func() { s.G().Log.Debug("- LoginWithKey -> %s", ErrToOk(err)) }()

	err = s.loginHandle(func(lctx LoginContext) error {
		return s.loginWithKey(lctx, user, key)
	}, after, "loginWithKey")
	return
}

func (s *LoginState) Logout() error {
	err := s.loginHandle(func(a LoginContext) error {
		return s.logout(a)
	}, nil, "logout")
	return err
}

// ExternalFunc is for having the LoginState handler call a
// function outside of LoginState.  The current use case is
// for signup, so that no logins/logouts happen while a signup is
// happening.
func (s *LoginState) ExternalFunc(f loginHandler, name string) error {
	return s.loginHandle(f, nil, name)
}

func (s *LoginState) VerifyEmailAddress(email string, secretUI SecretUI, after afterFn) (err error) {
	defer Trace(s.G().Log, "VerifyEmailAddress", func() error { return err })()

	err = s.loginHandle(func(lctx LoginContext) error {
		return s.tryPassphrasePromptLogin(lctx, email, secretUI)
	}, after, "loginWithPassphrase")
	return err
}

func (s *LoginState) Shutdown() error {
	var err error
	aerr := s.Account(func(a *Account) {
		err = a.Shutdown()
	}, "LoginState - Shutdown")
	if aerr != nil {
		return aerr
	}
	if err != nil {
		return err
	}

	if s.loginReqs != nil {
		close(s.loginReqs)
	}
	if s.acctReqs != nil {
		close(s.acctReqs)
	}

	return nil
}

// GetPassphraseStream either returns a cached, verified passphrase stream
// (maybe from a previous login) or generates a new one via Login. It will
// return the current Passphrase stream on success or an error on failure.
func (s *LoginState) GetPassphraseStream(ui SecretUI) (pps *PassphraseStream, err error) {
	s.G().Log.Debug("+ GetPassphraseStream() called")
	defer func() { s.G().Log.Debug("- GetPassphraseStream() -> %s", ErrToOk(err)) }()

	pps, err = s.GetPassphraseStreamForUser(ui, string(s.G().Env.GetUsername()))
	return
}

// GetPassphraseStreamForUser either returns a cached, verified passphrase stream
// (maybe from a previous login) or generates a new one via Login. It will
// return the current Passphrase stream on success or an error on failure.
func (s *LoginState) GetPassphraseStreamForUser(ui SecretUI, username string) (pps *PassphraseStream, err error) {
	s.G().Log.Debug("+ GetPassphraseStreamForUser() called")
	defer func() { s.G().Log.Debug("- GetPassphraseStreamForUser() -> %s", ErrToOk(err)) }()

	pps, err = s.PassphraseStream()
	if err != nil {
		return nil, err
	}
	if pps != nil {
		return pps, nil
	}
	err = s.loginHandle(func(lctx LoginContext) error {
		return s.loginWithPromptHelper(lctx, username, nil, ui, true)
	}, nil, "LoginState - GetPassphraseStreamForUser")
	if err != nil {
		return nil, err
	}
	pps, err = s.PassphraseStream()
	if err != nil {
		return nil, err
	}
	if pps != nil {
		return pps, nil
	}
	err = InternalError{"No cached keystream data after login attempt"}
	return nil, err
}

// GetVerifiedTripleSec either returns a cached, verified Triplesec
// or generates a new one that's verified via Login.
func (s *LoginState) GetVerifiedTriplesec(ui SecretUI) (ret *triplesec.Cipher, gen PassphraseGeneration, err error) {
	err = s.Account(func(a *Account) {
		ret = a.PassphraseStreamCache().Triplesec()
		gen = a.GetStreamGeneration()
	}, "LoginState - GetVerifiedTriplesec - first")
	if err != nil || ret != nil {
		return
	}

	if err = s.verifyPassphraseWithServer(ui); err != nil {
		return
	}

	err = s.Account(func(a *Account) {
		ret = a.PassphraseStreamCache().Triplesec()
		gen = a.GetStreamGeneration()
	}, "LoginState - GetVerifiedTriplesec - second")
	if err != nil || ret != nil {
		return
	}
	err = InternalError{"No cached keystream data after login attempt"}
	return
}

// VerifyPlaintextPassphrase verifies that the supplied plaintext passphrase
// is indeed the correct passphrase for the logged in user.  This is accomplished
// via a login request.  The side effect will be that we'll retrieve the
// correct generation number of the current passphrase from the server.
func (s *LoginState) VerifyPlaintextPassphrase(pp string) (ppStream *PassphraseStream, err error) {
	err = s.loginHandle(func(lctx LoginContext) error {
		ret := s.verifyPlaintextPassphraseForLoggedInUser(lctx, pp)
		if ret == nil {
			ppStream = lctx.PassphraseStreamCache().PassphraseStream()
		}
		return ret
	}, nil, "VerifyPlaintextPassphrase")
	return
}

func (s *LoginState) computeLoginPw(lctx LoginContext) (macSum []byte, err error) {
	loginSession, e := lctx.LoginSession().Session()
	if e != nil {
		err = e
		return
	}
	if loginSession == nil {
		err = fmt.Errorf("nil login session")
		return
	}
	sec := lctx.PassphraseStreamCache().PassphraseStream().PWHash()
	mac := hmac.New(sha512.New, sec)
	if _, err = mac.Write(loginSession); err != nil {
		return
	}
	macSum = mac.Sum(nil)
	return
}

func (s *LoginState) postLoginToServer(lctx LoginContext, eOu string, lgpw []byte) (*loginAPIResult, error) {
	loginSessionEncoded, err := lctx.LoginSession().SessionEncoded()
	if err != nil {
		return nil, err
	}
	res, err := s.G().API.Post(APIArg{
		Endpoint:    "login",
		NeedSession: false,
		Args: HTTPArgs{
			"email_or_username": S{eOu},
			"hmac_pwh":          S{hex.EncodeToString(lgpw)},
			"login_session":     S{loginSessionEncoded},
		},
		AppStatus: []string{"OK", "BAD_LOGIN_PASSWORD"},
	})
	if err != nil {
		return nil, err
	}
	if res.AppStatus == "BAD_LOGIN_PASSWORD" {
		err = PassphraseError{"server rejected login attempt"}
		return nil, err
	}

	b := res.Body
	sessionID, err := b.AtKey("session").GetString()
	if err != nil {
		return nil, err
	}
	csrfToken, err := b.AtKey("csrf_token").GetString()
	if err != nil {
		return nil, err
	}
	uid, err := GetUID(b.AtKey("uid"))
	if err != nil {
		return nil, err
	}
	uname, err := b.AtKey("me").AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil, err
	}
	ppGen, err := b.AtPath("me.basics.passphrase_generation").GetInt()
	if err != nil {
		return nil, err
	}

	return &loginAPIResult{sessionID, csrfToken, uid, uname, PassphraseGeneration(ppGen)}, nil
}

func (s *LoginState) saveLoginState(lctx LoginContext, res *loginAPIResult, nilPPStreamOK bool) error {
	lctx.SetStreamGeneration(res.ppGen, nilPPStreamOK)
	return lctx.SaveState(res.sessionID, res.csrfToken, NewNormalizedUsername(res.username), res.uid, s.G().Env.GetDeviceID())
}

func (r PostAuthProofRes) loginResult() (*loginAPIResult, error) {
	uid, err := UIDFromHex(r.UIDHex)
	if err != nil {
		return nil, err
	}
	ret := &loginAPIResult{
		sessionID: r.SessionID,
		csrfToken: r.CSRFToken,
		uid:       uid,
		username:  r.Username,
		ppGen:     PassphraseGeneration(r.PPGen),
	}
	return ret, nil
}

// A function that takes a Keyrings object, a user, and returns a
// particular key for that user.
type getSecretKeyFn func(*Keyrings, *User) (GenericKey, error)

// pubkeyLoginHelper looks for a locally available private key and
// tries to establish a session via public key signature.
func (s *LoginState) pubkeyLoginHelper(lctx LoginContext, username string, getSecretKeyFn getSecretKeyFn) (err error) {
	s.G().Log.Debug("+ pubkeyLoginHelper()")
	defer func() {
		if err != nil {
			if e := lctx.SecretSyncer().Clear(); e != nil {
				s.G().Log.Info("error clearing secret syncer: %s", e)
			}
		}
		s.G().Log.Debug("- pubkeyLoginHelper() -> %s", ErrToOk(err))
	}()

	nu := NewNormalizedUsername(username)

	if _, err = s.G().Env.GetConfig().GetUserConfigForUsername(nu); err != nil {
		s.G().Log.Debug("| No Userconfig for %s: %s", username, err)
		return
	}

	var me *User
	if me, err = LoadUser(LoadUserArg{Name: username, LoginContext: lctx, Contextified: NewContextified(s.G())}); err != nil {
		return
	}

	lctx.RunSecretSyncer(me.GetUID())
	if !lctx.SecretSyncer().HasDevices() {
		s.G().Log.Debug("| No synced devices, pubkey login impossible.")
		err = NoDeviceError{Reason: "no synced devices during pubkey login"}
		return err
	}

	var key GenericKey
	if key, err = getSecretKeyFn(s.G().Keyrings, me); err != nil {
		return err
	}

	return s.pubkeyLoginWithKey(lctx, me, key)
}

func (s *LoginState) pubkeyLoginWithKey(lctx LoginContext, me *User, key GenericKey) error {
	if err := lctx.LoadLoginSession(me.GetName()); err != nil {
		return err
	}

	loginSessionEncoded, err := lctx.LoginSession().SessionEncoded()
	if err != nil {
		return err
	}

	proof, err := me.AuthenticationProof(key, loginSessionEncoded, AuthExpireIn)
	if err != nil {
		return err
	}

	sig, _, _, err := SignJSON(proof, key)
	if err != nil {
		return err
	}

	arg := PostAuthProofArg{
		uid: me.id,
		sig: sig,
		key: key,
	}
	pres, err := PostAuthProof(arg)
	if err != nil {
		return err
	}

	res, err := pres.loginResult()
	if err != nil {
		return err
	}

	return s.saveLoginState(lctx, res, true)
}

func (s *LoginState) checkLoggedIn(lctx LoginContext, username string, force bool) (loggedIn bool, err error) {
	s.G().Log.Debug("+ checkedLoggedIn()")
	defer func() { s.G().Log.Debug("- checkedLoggedIn() -> %t, %s", loggedIn, ErrToOk(err)) }()

	var loggedInTmp bool
	if loggedInTmp, err = lctx.LoggedInLoad(); err != nil {
		s.G().Log.Debug("| Session failed to load")
		return
	}

	nu1 := lctx.LocalSession().GetUsername()
	nu2 := NewNormalizedUsername(username)
	if loggedInTmp && len(nu2) > 0 && nu1 != nil && !nu1.Eq(nu2) {
		err = LoggedInWrongUserError{ExistingName: *nu1, AttemptedName: nu2}
		return false, err
	}

	if !force && loggedInTmp {
		s.G().Log.Debug("| Our session token is still valid; we're logged in")
		loggedIn = true
	}
	return
}

func (s *LoginState) switchUser(lctx LoginContext, username string) error {
	if len(username) == 0 {
		// this isn't an error
		return nil
	}
	if !CheckUsername.F(username) {
		return errors.New("invalid username provided to switchUser")
	}
	nu := NewNormalizedUsername(username)
	if err := s.G().Env.GetConfigWriter().SwitchUser(nu); err != nil {
		s.G().Log.Debug("| Can't switch user to %s: %s", username, err)
		// apparently this isn't an error either
		return nil
	}

	lctx.EnsureUsername(nu)

	s.G().Log.Debug("| Successfully switched user to %s", username)
	return nil
}

// Like pubkeyLoginHelper, but ignores most errors.
func (s *LoginState) tryPubkeyLoginHelper(lctx LoginContext, username string, getSecretKeyFn getSecretKeyFn) (loggedIn bool, err error) {
	if err = s.pubkeyLoginHelper(lctx, username, getSecretKeyFn); err == nil {
		s.G().Log.Debug("| Pubkey login succeeded")
		loggedIn = true
		return
	}

	if _, ok := err.(CanceledError); ok {
		s.G().Log.Debug("| Canceled pubkey login, so cancel login")
		return
	}

	s.G().Log.Debug("| Public key login failed, falling back: %s", err)
	err = nil
	return
}

func (s *LoginState) tryPassphrasePromptLogin(lctx LoginContext, username string, secretUI SecretUI) (err error) {
	retryMsg := ""
	retryCount := 3
	for i := 0; i < retryCount; i++ {
		err = s.passphraseLogin(lctx, username, "", secretUI, retryMsg)

		if err == nil {
			return
		}

		if _, badpw := err.(PassphraseError); !badpw {
			return
		}

		retryMsg = err.Error()
	}
	return
}

func (s *LoginState) getEmailOrUsername(lctx LoginContext, username *string, loginUI LoginUI) (err error) {
	if len(*username) != 0 {
		return
	}

	*username = s.G().Env.GetEmailOrUsername()
	if len(*username) != 0 {
		return
	}

	if loginUI != nil {
		if *username, err = loginUI.GetEmailOrUsername(context.TODO(), 0); err != nil {
			*username = ""
			return
		}
	}

	if len(*username) == 0 {
		err = NoUsernameError{}
	}

	if err != nil {
		return err
	}

	// username set, so redo config
	if err = s.G().ConfigureConfig(); err != nil {
		return
	}
	return s.switchUser(lctx, *username)
}

func (s *LoginState) verifyPlaintextPassphraseForLoggedInUser(lctx LoginContext, passphrase string) (err error) {
	s.G().Log.Debug("+ LoginState.verifyPlaintextPassphraseForLoggedInUser")
	defer func() {
		s.G().Log.Debug("- LoginState.verifyPlaintextPassphraseForLoggedInUser -> %s", ErrToOk(err))
	}()

	var username string
	if err = s.getEmailOrUsername(lctx, &username, nil); err != nil {
		return
	}

	// For a login reattempt
	lctx.ClearStreamCache()

	// Since a login session is likely stale by now (if we still have one)
	lctx.ClearLoginSession()

	// Pass nil SecretUI (since we don't want to trigger the UI)
	// and also no retry message.
	err = s.passphraseLogin(lctx, username, passphrase, nil, "")

	return
}

func (s *LoginState) passphraseLogin(lctx LoginContext, username, passphrase string, secretUI SecretUI, retryMsg string) (err error) {
	s.G().Log.Debug("+ LoginState.passphraseLogin (username=%s)", username)
	defer func() {
		s.G().Log.Debug("- LoginState.passphraseLogin -> %s", ErrToOk(err))
	}()

	if err = lctx.LoadLoginSession(username); err != nil {
		return
	}

	storeSecret, err := s.stretchPassphraseIfNecessary(lctx, username, passphrase, secretUI, retryMsg)
	if err != nil {
		return err
	}

	lgpw, err := s.computeLoginPw(lctx)
	if err != nil {
		return err
	}

	res, err := s.postLoginToServer(lctx, username, lgpw)
	if err != nil {
		lctx.ClearStreamCache()
		return err
	}

	if err := s.saveLoginState(lctx, res, false); err != nil {
		return err
	}

	s.G().Log.Debug("passphraseLogin success")

	// If storeSecret is set and there is a device ID, then try to store the secret.
	//
	// Ignore most of the errors.
	//
	// Can get here without a device ID during device provisioning as this is used to establish a login
	// session before the device keys are generated.
	if storeSecret && !s.G().Env.GetDeviceID().IsNil() {
		s.G().Log.Debug("passphraseLogin: storeSecret set, so saving secret in secret store")
		pps := lctx.PassphraseStreamCache().PassphraseStream()
		if pps == nil {
			return errors.New("nil passphrase stream")
		}
		lks := NewLKSec(pps, res.uid, s.G())
		secret, err := lks.GetSecret(lctx)
		if err != nil {
			// Ignore any errors storing the secret.
			s.G().Log.Debug("(ignoring) error getting lksec secret for SecretStore: %s", err)
			return nil
		}
		secretStore := NewSecretStore(s.G(), NewNormalizedUsername(username))
		storeSecretErr := secretStore.StoreSecret(secret)
		if storeSecretErr != nil {
			// Ignore any errors storing the secret.
			s.G().Log.Debug("(ignoring) StoreSecret error: %s", storeSecretErr)
			return nil
		}
	}

	return nil
}

func (s *LoginState) stretchPassphraseIfNecessary(lctx LoginContext, un string, pp string, ui SecretUI, retry string) (storeSecret bool, err error) {
	s.G().Log.Debug("+ stretchPassphraseIfNecessary (%s)", un)
	defer s.G().Log.Debug("- stretchPassphraseIfNecessary")
	if lctx.PassphraseStreamCache().Valid() {
		s.G().Log.Debug("| stretchPassphraseIfNecessary: passphrase stream cached")
		// already have stretched passphrase cached
		return false, nil
	}

	if len(pp) == 0 {
		if ui == nil {
			return false, NoUIError{"secret"}
		}

		s.G().Log.Debug("| stretchPassphraseIfNecessary: getting keybase passphrase via ui")
		res, err := GetKeybasePassphrase(ui, un, retry)
		if err != nil {
			return false, err
		}

		pp = res.Passphrase
		storeSecret = res.StoreSecret
	}

	if err = lctx.CreateStreamCacheViaStretch(pp); err != nil {
		return false, err
	}

	return storeSecret, nil
}

func (s *LoginState) verifyPassphraseWithServer(ui SecretUI) error {
	return s.loginHandle(func(lctx LoginContext) error {
		return s.loginWithPromptHelper(lctx, s.G().Env.GetUsername().String(), nil, ui, true)
	}, nil, "LoginState - verifyPassphrase")
}

func (s *LoginState) loginWithPromptHelper(lctx LoginContext, username string, loginUI LoginUI, secretUI SecretUI, force bool) (err error) {
	var loggedIn bool
	if loggedIn, err = s.checkLoggedIn(lctx, username, force); err != nil || loggedIn {
		return
	}

	if err = s.switchUser(lctx, username); err != nil {
		return
	}

	if err = s.getEmailOrUsername(lctx, &username, loginUI); err != nil {
		return
	}

	getSecretKeyFn := func(keyrings *Keyrings, me *User) (GenericKey, error) {
		ska := SecretKeyArg{
			Me:      me,
			KeyType: DeviceSigningKeyType,
		}
		return keyrings.GetSecretKeyWithoutPrompt(lctx, ska)
	}

	// If we're forcing a login to check our passphrase (as in when we're called
	// from verifyPassphraseWithServer), then don't use public key login at all. See issue #510.
	if !force {
		if loggedIn, err = s.tryPubkeyLoginHelper(lctx, username, getSecretKeyFn); err != nil || loggedIn {
			return
		}
	}
	return s.tryPassphrasePromptLogin(lctx, username, secretUI)
}

// loginHandle creates a loginReq from a loginHandler and puts it
// in the loginReqs channel.  The requests goroutine will handle
// it, calling f and putting the error on the request res channel.
// Once the error is on the res channel, loginHandle returns it.
func (s *LoginState) loginHandle(f loginHandler, after afterFn, name string) error {
	req := loginReq{
		f:     f,
		after: after,
		res:   make(chan error),
		name:  name,
	}
	s.G().Log.Debug("+ Login %q", name)
	s.loginReqs <- req

	err := <-req.res
	s.G().Log.Debug("- Login %q", name)

	return err
}

// acctHandle creates an acctReq from an acctHandler and puts it
// in the acctReqs channel.  It waits for the request handler to
// close the done channel in the acctReq before returning.
// For debugging purposes, there is a 10s timeout to help find any
// cases where an account or login request is attempted while
// another account or login request is in process.
func (s *LoginState) acctHandle(f acctHandler, name string) error {
	req := acctReq{
		f:    f,
		done: make(chan struct{}),
		name: name,
	}
	select {
	case s.acctReqs <- req:
		// this is just during debugging:
	case <-time.After(5 * time.Second):
		s.G().Log.Debug("timed out sending acct request %q", name)
		s.G().Log.Debug("active request: %s", s.activeReq)
		debug.PrintStack()
		return TimeoutError{}
	}

	// wait for request to finish
	<-req.done

	return nil
}

// requests runs in a single goroutine.  It selects login or
// account requests and handles them appropriately.  It runs until
// the loginReqs and acctReqs channels are closed.
func (s *LoginState) requests() {
	var loginReqsClosed, acctReqsClosed bool
	for {
		select {
		case req, ok := <-s.loginReqs:
			if ok {
				s.activeReq = fmt.Sprintf("Login Request: %q", req.name)
				err := req.f(s.account)
				if err == nil && req.after != nil {
					// f ran without error, so call after function
					req.res <- req.after(s.account)
				} else {
					// either f returned an error, or there's no after function
					req.res <- err
				}
			} else {
				loginReqsClosed = true
			}
		case req, ok := <-s.acctReqs:
			if ok {
				s.activeReq = fmt.Sprintf("Account Request: %q", req.name)
				req.f(s.account)
				close(req.done)
			} else {
				acctReqsClosed = true
			}
		}
		if loginReqsClosed && acctReqsClosed {
			break
		}
	}
}

func (s *LoginState) loginWithStoredSecret(lctx LoginContext, username string) error {
	if loggedIn, err := s.checkLoggedIn(lctx, username, false); err != nil {
		return err
	} else if loggedIn {
		return nil
	}

	if err := s.switchUser(lctx, username); err != nil {
		return err
	}

	getSecretKeyFn := func(keyrings *Keyrings, me *User) (GenericKey, error) {
		secretRetriever := NewSecretStore(s.G(), me.GetNormalizedName())
		ska := SecretKeyArg{
			Me:      me,
			KeyType: DeviceSigningKeyType,
		}
		key, err := keyrings.GetSecretKeyWithStoredSecret(lctx, ska, me, secretRetriever)
		if err != nil {
			return nil, SecretStoreError{Msg: err.Error()}
		}
		return key, nil
	}
	return s.pubkeyLoginHelper(lctx, username, getSecretKeyFn)
}

func (s *LoginState) loginWithPassphrase(lctx LoginContext, username, passphrase string, storeSecret bool) error {
	if loggedIn, err := s.checkLoggedIn(lctx, username, false); err != nil {
		return err
	} else if loggedIn {
		return nil
	}

	if err := s.switchUser(lctx, username); err != nil {
		return err
	}

	getSecretKeyFn := func(keyrings *Keyrings, me *User) (GenericKey, error) {
		var secretStorer SecretStorer
		if storeSecret {
			secretStorer = NewSecretStore(s.G(), me.GetNormalizedName())
		}
		key, err := keyrings.GetSecretKeyWithPassphrase(lctx, me, passphrase, secretStorer)
		if err != nil {
			return nil, SecretStoreError{Msg: err.Error()}
		}
		return key, nil
	}
	if loggedIn, err := s.tryPubkeyLoginHelper(lctx, username, getSecretKeyFn); err != nil {
		return err
	} else if loggedIn {
		return nil
	}

	return s.passphraseLogin(lctx, username, passphrase, nil, "")
}

func (s *LoginState) loginWithKey(lctx LoginContext, user *User, key GenericKey) error {
	if loggedIn, err := s.checkLoggedIn(lctx, user.GetName(), false); err != nil {
		return err
	} else if loggedIn {
		return nil
	}

	if err := s.switchUser(lctx, user.GetName()); err != nil {
		return err
	}

	return s.pubkeyLoginWithKey(lctx, user, key)
}

func (s *LoginState) logout(a LoginContext) error {
	return a.Logout()
}

// Account is a convenience function to allow access to
// LoginState's Account object.
// For example:
//
//     e.G().LoginState().Account(func (a *Account) {
//         skb = a.LockedLocalSecretKey(ska)
//     }, "LockedLocalSecretKey")
//
func (s *LoginState) Account(h acctHandler, name string) error {
	s.G().Log.Debug("+ Account %q", name)
	defer s.G().Log.Debug("- Account %q", name)
	return s.acctHandle(h, name)
}

func (s *LoginState) PassphraseStreamCache(h func(*PassphraseStreamCache), name string) error {
	return s.Account(func(a *Account) {
		h(a.PassphraseStreamCache())
	}, name)
}

func (s *LoginState) LocalSession(h func(*Session), name string) error {
	return s.Account(func(a *Account) {
		h(a.LocalSession())
	}, name)
}

func (s *LoginState) LoginSession(h func(*LoginSession), name string) error {
	return s.Account(func(a *Account) {
		h(a.LoginSession())
	}, name)
}

func (s *LoginState) SecretSyncer(h func(*SecretSyncer), name string) error {
	var err error
	aerr := s.Account(func(a *Account) {
		// SecretSyncer needs session loaded:
		err = a.localSession.Load()
		if err != nil {
			return
		}
		h(a.SecretSyncer())
	}, name)
	if aerr != nil {
		return aerr
	}
	return err
}

func (s *LoginState) RunSecretSyncer(uid keybase1.UID) error {
	var err error
	aerr := s.Account(func(a *Account) {
		err = a.RunSecretSyncer(uid)
	}, "RunSecretSyncer")
	if aerr != nil {
		return aerr
	}
	return err
}

func (s *LoginState) Keyring(h func(*SKBKeyringFile), name string) error {
	var err error
	aerr := s.Account(func(a *Account) {
		var kr *SKBKeyringFile
		kr, err = a.Keyring()
		if err != nil {
			return
		}
		h(kr)
	}, name)
	if aerr != nil {
		return aerr
	}
	return err
}

func (s *LoginState) LoggedIn() bool {
	var res bool
	err := s.Account(func(a *Account) {
		res = a.LoggedIn()
	}, "LoggedIn")
	if err != nil {
		s.G().Log.Warning("error getting Account: %s", err)
		return false
	}
	return res
}

func (s *LoginState) LoggedInLoad() (lin bool, err error) {
	aerr := s.Account(func(a *Account) {
		lin, err = a.LoggedInLoad()
	}, "LoggedInLoad")
	if aerr != nil {
		return false, aerr
	}
	return
}

func (s *LoginState) LoggedInProvisionedLoad() (lin bool, err error) {
	aerr := s.Account(func(a *Account) {
		lin, err = a.LoggedInProvisionedLoad()
	}, "LoggedInProvisionedLoad")
	if aerr != nil {
		return false, aerr
	}
	return
}

func (s *LoginState) PassphraseStream() (*PassphraseStream, error) {
	var pps *PassphraseStream
	err := s.PassphraseStreamCache(func(c *PassphraseStreamCache) {
		pps = c.PassphraseStream()
	}, "PassphraseStream")
	return pps, err
}

func (s *LoginState) PassphraseStreamGeneration() (PassphraseGeneration, error) {
	var gen PassphraseGeneration
	err := s.Account(func(a *Account) {
		gen = a.GetStreamGeneration()
	}, "PassphraseStreamGeneration")
	return gen, err
}

func (s *LoginState) AccountDump() {
	err := s.Account(func(a *Account) {
		a.Dump()
	}, "LoginState - AccountDump")
	if err != nil {
		s.G().Log.Warning("error getting account for AccountDump: %s", err)
	}
}
