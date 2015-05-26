package libkb

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"runtime/debug"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	triplesec "github.com/keybase/go-triplesec"
)

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
	Logout() error

	CreateStreamCache(tsec *triplesec.Cipher, pps PassphraseStream)
	CreateStreamCacheViaStretch(passphrase string) error
	PassphraseStreamCache() *PassphraseStreamCache
	ClearStreamCache()

	CreateLoginSessionWithSalt(emailOrUsername string, salt []byte) error
	LoadLoginSession(emailOrUsername string) error
	LoginSession() *LoginSession

	LocalSession() *Session
	EnsureUsername(username string)
	SaveState(sessionID, csrf, username string, uid UID) error

	Keyring() (*SKBKeyringFile, error)
	LockedLocalSecretKey(ska SecretKeyArg) *SKB

	SecretSyncer() *SecretSyncer
	RunSecretSyncer(uid UID) error
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
	uid       UID
	username  string
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

func (s *LoginState) Logout() error {
	return s.loginHandle(func(a LoginContext) error {
		return s.logout(a)
	}, nil, "logout")
}

// ExternalFunc is for having the LoginState handler call a
// function outside of LoginState.  The current use case is
// for signup, so that no logins/logouts happen while a signup is
// happening.
func (s *LoginState) ExternalFunc(f loginHandler, name string) error {
	return s.loginHandle(f, nil, name)
}

func (s *LoginState) Shutdown() error {
	var err error
	s.Account(func(a *Account) {
		err = a.Shutdown()
	}, "LoginState - Shutdown")
	if err != nil {
		return err
	}

	close(s.loginReqs)
	close(s.acctReqs)

	return nil
}

// GetPassphraseStream either returns a cached, verified passphrase stream
// (maybe from a previous login) or generates a new one via Login. It will
// return the current Passphrase stream on success or an error on failure.
func (s *LoginState) GetPassphraseStream(ui SecretUI) (ret PassphraseStream, err error) {
	if ret = s.PassphraseStream(); ret != nil {
		return
	}
	if err = s.verifyPassphrase(ui); err != nil {
		return
	}
	if ret = s.PassphraseStream(); ret != nil {
		return
	}
	err = InternalError{"No cached keystream data after login attempt"}
	return
}

// GetVerifiedTripleSec either returns a cached, verified Triplesec
// or generates a new one that's verified via Login.
func (s *LoginState) GetVerifiedTriplesec(ui SecretUI) (ret *triplesec.Cipher, err error) {
	s.Account(func(a *Account) {
		ret = a.PassphraseStreamCache().Triplesec()
	}, "LoginState - GetVerifiedTriplesec - first")
	if ret != nil {
		return
	}

	if err = s.verifyPassphrase(ui); err != nil {
		return
	}

	s.Account(func(a *Account) {
		ret = a.PassphraseStreamCache().Triplesec()
	}, "LoginState - GetVerifiedTriplesec - second")
	if ret != nil {
		return
	}
	err = InternalError{"No cached keystream data after login attempt"}
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
	mac.Write(loginSession)
	macSum = mac.Sum(nil)
	return
}

func (s *LoginState) postLoginToServer(lctx LoginContext, eOu string, lgpw []byte) (*loginAPIResult, error) {
	loginSessionEncoded, err := lctx.LoginSession().SessionEncoded()
	if err != nil {
		return nil, err
	}
	res, err := s.G().API.Post(ApiArg{
		Endpoint:    "login",
		NeedSession: false,
		Args: HttpArgs{
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
	sessionId, err := b.AtKey("session").GetString()
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

	return &loginAPIResult{sessionId, csrfToken, uid, uname}, nil
}

func (s *LoginState) saveLoginState(lctx LoginContext, res *loginAPIResult) error {
	return lctx.SaveState(res.sessionID, res.csrfToken, res.username, res.uid)
}

func (r PostAuthProofRes) loginResult() (*loginAPIResult, error) {
	uid, err := UidFromHex(r.UidHex)
	if err != nil {
		return nil, err
	}
	ret := &loginAPIResult{
		sessionID: r.SessionId,
		csrfToken: r.CsrfToken,
		uid:       uid,
		username:  r.Username,
	}
	return ret, nil
}

// A function that takes a Keyrings object, a user, and returns a
// particular key for that user.
type getSecretKeyFn func(*Keyrings, *User) (GenericKey, error)

// pubkeyLoginHelper looks for a locally available private key and
// tries to establish a session via public key signature.
func (s *LoginState) pubkeyLoginHelper(lctx LoginContext, username string, getSecretKeyFn getSecretKeyFn) (err error) {
	var key GenericKey
	var me *User
	var proof *jsonw.Wrapper
	var sig string
	var pres *PostAuthProofRes

	s.G().Log.Debug("+ pubkeyLoginHelper()")
	defer func() {
		if err != nil {
			lctx.SecretSyncer().Clear()
		}
		s.G().Log.Debug("- pubkeyLoginHelper() -> %s", ErrToOk(err))
	}()

	if _, err = s.G().Env.GetConfig().GetUserConfigForUsername(username); err != nil {
		s.G().Log.Debug("| No Userconfig for %s: %s", username, err.Error())
		return
	}

	if me, err = LoadUser(LoadUserArg{Name: username, LoginContext: lctx}); err != nil {
		return
	}

	if err = lctx.LoadLoginSession(username); err != nil {
		return
	}

	loginSessionEncoded, err := lctx.LoginSession().SessionEncoded()
	if err != nil {
		return err
	}

	if key, err = getSecretKeyFn(s.G().Keyrings, me); err != nil {
		return err
	}

	if proof, err = me.AuthenticationProof(key, loginSessionEncoded, AUTH_EXPIRE_IN); err != nil {
		return
	}

	if sig, _, _, err = SignJson(proof, key); err != nil {
		return
	}

	arg := PostAuthProofArg{
		uid: me.id,
		sig: sig,
		key: key,
	}
	if pres, err = PostAuthProof(arg); err != nil {
		return
	}

	res, err := pres.loginResult()
	if err != nil {
		return err
	}

	return s.saveLoginState(lctx, res)
}

func (s *LoginState) checkLoggedIn(lctx LoginContext, username string, force bool) (loggedIn bool, err error) {
	s.G().Log.Debug("+ checkedLoggedIn()")
	defer func() { s.G().Log.Debug("- checkedLoggedIn() -> %t, %s", loggedIn, ErrToOk(err)) }()

	var loggedInTmp bool
	if loggedInTmp, err = lctx.LoggedInLoad(); err != nil {
		s.G().Log.Debug("| Session failed to load")
		return
	}

	un := lctx.LocalSession().GetUsername()
	if loggedInTmp && len(username) > 0 && un != nil && username != *un {
		err = LoggedInError{}
		return
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
	if err := s.G().Env.GetConfigWriter().SwitchUser(username); err != nil {
		s.G().Log.Debug("| Can't switch user to %s: %s", username, err)
		// apparently this isn't an error either
		return nil
	}

	lctx.EnsureUsername(username)

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

	s.G().Log.Debug("| Public key login failed, falling back: %s", err.Error())
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
		if *username, err = loginUI.GetEmailOrUsername(0); err != nil {
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
	s.G().ConfigureConfig()
	return s.switchUser(lctx, *username)
}

func (s *LoginState) passphraseLogin(lctx LoginContext, username, passphrase string, secretUI SecretUI, retryMsg string) (err error) {
	s.G().Log.Debug("+ LoginState.passphraseLogin (username=%s)", username)
	defer func() {
		s.G().Log.Debug("- LoginState.passphraseLogin -> %s", ErrToOk(err))
	}()

	if err = lctx.LoadLoginSession(username); err != nil {
		return
	}

	if err = s.stretchPassphraseIfNecessary(lctx, username, passphrase, secretUI, retryMsg); err != nil {
		return err
	}

	lgpw, err := s.computeLoginPw(lctx)
	if err != nil {
		return
	}

	res, err := s.postLoginToServer(lctx, username, lgpw)
	if err != nil {
		lctx.ClearStreamCache()
		return err
	}

	if err := s.saveLoginState(lctx, res); err != nil {
		return err
	}

	return nil
}

func (s *LoginState) stretchPassphraseIfNecessary(lctx LoginContext, un string, pp string, ui SecretUI, retry string) error {
	if lctx.PassphraseStreamCache().Valid() {
		// already have stretched passphrase cached
		return nil
	}

	arg := keybase1.GetKeybasePassphraseArg{
		Username: un,
		Retry:    retry,
	}

	if len(pp) == 0 {
		if ui == nil {
			return NoUiError{"secret"}
		}

		var err error
		if pp, err = ui.GetKeybasePassphrase(arg); err != nil {
			return err
		}
	}

	return lctx.CreateStreamCacheViaStretch(pp)
}

func (s *LoginState) verifyPassphrase(ui SecretUI) error {
	return s.loginHandle(func(lctx LoginContext) error {
		return s.loginWithPromptHelper(lctx, s.G().Env.GetUsername(), nil, ui, true)
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
			KeyType: AnySecretKeyType,
		}
		key, _, err := keyrings.GetSecretKeyWithPrompt(lctx, ska, secretUI, "Login")
		return key, err
	}

	if loggedIn, err = s.tryPubkeyLoginHelper(lctx, username, getSecretKeyFn); err != nil || loggedIn {
		return
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
func (s *LoginState) acctHandle(f acctHandler, name string) {
	req := acctReq{
		f:    f,
		done: make(chan struct{}),
		name: name,
	}
	select {
	case s.acctReqs <- req:
		// this is just during debugging:
	case <-time.After(5 * time.Second):
		s.G().Log.Warning("timed out sending acct request %q", name)
		s.G().Log.Warning("active request: %s", s.activeReq)
		debug.PrintStack()
		os.Exit(1)
	}

	<-req.done

	return
}

// requests runs in a single goroutine.  It selects login or
// account requests and handles them appropriately.  It runs until
// the loginReqs and acctReqs channels are closed.
func (s *LoginState) requests() {
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
				s.loginReqs = nil
			}
		case req, ok := <-s.acctReqs:
			if ok {
				s.activeReq = fmt.Sprintf("Account Request: %q", req.name)
				req.f(s.account)
				close(req.done)
			} else {
				s.acctReqs = nil
			}
		}
		if s.loginReqs == nil && s.acctReqs == nil {
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
		secretRetriever := NewSecretStore(me.GetName())
		return keyrings.GetSecretKeyWithStoredSecret(lctx, me, secretRetriever)
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
			secretStorer = NewSecretStore(me.GetName())
		}
		return keyrings.GetSecretKeyWithPassphrase(lctx, me, passphrase, secretStorer)
	}
	if loggedIn, err := s.tryPubkeyLoginHelper(lctx, username, getSecretKeyFn); err != nil {
		return err
	} else if loggedIn {
		return nil
	}

	return s.passphraseLogin(lctx, username, passphrase, nil, "")
}

func (s *LoginState) logout(a LoginContext) error {
	s.G().Log.Debug("+ Logout called")
	a.Logout()
	s.G().Log.Debug("- Logout called")
	return nil
}

// Account is a convenience function to allow access to
// LoginState's Account object.
// For example:
//
//     e.G().LoginState().Account(func (a *Account) {
//         skb = a.LockedLocalSecretKey(ska)
//     }, "LockedLocalSecretKey")
//
func (s *LoginState) Account(h acctHandler, name string) {
	s.G().Log.Debug("+ Account %q", name)
	s.acctHandle(h, name)
	s.G().Log.Debug("- Account %q", name)
}

func (s *LoginState) PassphraseStreamCache(h func(*PassphraseStreamCache), name string) {
	s.Account(func(a *Account) {
		h(a.PassphraseStreamCache())
	}, name)
}

func (s *LoginState) LocalSession(h func(*Session), name string) {
	s.Account(func(a *Account) {
		h(a.LocalSession())
	}, name)
}

func (s *LoginState) LoginSession(h func(*LoginSession), name string) {
	s.Account(func(a *Account) {
		h(a.LoginSession())
	}, name)
}

func (s *LoginState) SecretSyncer(h func(*SecretSyncer), name string) {
	s.Account(func(a *Account) {
		// SecretSyncer needs session loaded:
		a.localSession.Load()
		h(a.SecretSyncer())
	}, name)
}

func (s *LoginState) RunSecretSyncer(uid UID) error {
	var err error
	s.Account(func(a *Account) {
		err = a.RunSecretSyncer(uid)
	}, "RunSecretSyncer")
	return err
}

func (s *LoginState) Keyring(h func(*SKBKeyringFile), name string) error {
	var err error
	s.Account(func(a *Account) {
		var kr *SKBKeyringFile
		kr, err = a.Keyring()
		if err != nil {
			return
		}
		h(kr)
	}, name)
	return err
}

func (s *LoginState) LoggedIn() bool {
	var res bool
	s.Account(func(a *Account) {
		res = a.LoggedIn()
	}, "LoggedIn")
	return res
}

func (s *LoginState) LoggedInLoad() (lin bool, err error) {
	s.Account(func(a *Account) {
		lin, err = a.LoggedInLoad()
	}, "LoggedInLoad")
	return
}

func (s *LoginState) LoggedInProvisionedLoad() (lin bool, err error) {
	s.Account(func(a *Account) {
		lin, err = a.LoggedInProvisionedLoad()
	}, "LoggedInProvisionedLoad")
	return
}

func (s *LoginState) PassphraseStream() PassphraseStream {
	var pps PassphraseStream
	s.PassphraseStreamCache(func(c *PassphraseStreamCache) {
		pps = c.PassphraseStream()
	}, "PassphraseStream")
	return pps
}

func (s *LoginState) AccountDump() {
	s.Account(func(a *Account) {
		a.Dump()
	}, "LoginState - AccountDump")
}
