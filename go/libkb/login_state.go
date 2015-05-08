package libkb

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"sync"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	triplesec "github.com/keybase/go-triplesec"
)

type loginReq struct {
	f   func() error
	res chan error
}

type LoginState struct {
	Contextified

	requests chan loginReq
	session  *Session // The user's session cookie, &c

	secretSyncer *SecretSyncer // For syncing secrets between the server and client

	mu               sync.RWMutex // protects the following variables:
	salt             []byte
	loginSession     []byte
	loginSessionB64  string
	tsec             *triplesec.Cipher
	sessionFor       string
	passphraseStream PassphraseStream
}

type loginAPIResult struct {
	sessionID string
	csrfToken string
	uid       UID
	username  string
}

func NewLoginState(g *GlobalContext) *LoginState {
	s := newSession(g)
	res := &LoginState{
		Contextified: Contextified{g},
		session:      s,
		requests:     make(chan loginReq),
	}
	go res.handleRequests()
	return res
}

func (s *LoginState) SessionArgs() (token, csrf string) {
	return s.session.GetToken(), s.session.GetCsrf()
}

func (s *LoginState) UserInfo() (uid UID, username, token string, deviceSubkeyKid KID, err error) {
	user, err := LoadMe(LoadUserArg{})
	if err != nil {
		return
	}
	deviceSubkeyKid, err = user.GetDeviceSubkeyKid(s.G())
	if err != nil {
		deviceSubkeyKid = KID{}
		return
	}

	uid = user.GetUid()
	username = user.GetName()
	// TODO: Make sure token is consistent with other return
	// values (i.e., make this not racy).
	token = s.session.GetToken()
	return
}

func (s *LoginState) UID() *UID {
	return s.session.GetUID()
}

func (s *LoginState) SessionLoad() error {
	return s.session.Load()
}

// IsLoggedIn returns true if the user is logged in.  It does not
// try to load the session.
func (s *LoginState) IsLoggedIn() bool {
	return s.session.IsLoggedIn()
}

// IsLoggedInLoad will load and check the session of necessary.
func (s *LoginState) IsLoggedInLoad() (bool, error) {
	return s.session.loadAndCheck()
}

func (s *LoginState) AssertLoggedIn() error {
	if err := s.checkSession(); err != nil {
		return err
	}
	if !s.IsLoggedIn() {
		return LoginRequiredError{}
	}
	return nil
}

func (s *LoginState) AssertLoggedOut() error {
	if err := s.checkSession(); err != nil {
		return err
	}
	if s.IsLoggedIn() {
		return LogoutError{}
	}
	return nil
}

func (s *LoginState) checkSession() error {
	return s.session.Check()
}

// SetSignupRes should only be called by the signup engine, and
// within an ExternalFunc handler.
func (s *LoginState) SetSignupRes(sessionID, csrfToken, username string, uid UID, salt []byte) error {
	if err := s.session.Load(); err != nil {
		return err
	}

	s.setSalt(salt)

	return s.saveLoginState(&loginAPIResult{
		sessionID: sessionID,
		csrfToken: csrfToken,
		username:  username,
		uid:       uid,
	})
}

func (s *LoginState) GetConfiguredAccounts() ([]keybase1.ConfiguredAccount, error) {
	usernames, err := GetUsersWithStoredSecrets()
	if err != nil {
		return nil, err
	}
	configuredAccounts := make([]keybase1.ConfiguredAccount, len(usernames))

	for i, username := range usernames {
		configuredAccounts[i] = keybase1.ConfiguredAccount{
			Username:        username,
			HasStoredSecret: true,
		}
	}

	return configuredAccounts, nil
}

func (s *LoginState) LoginWithPrompt(username string, loginUI LoginUI, secretUI SecretUI) (err error) {
	s.G().Log.Debug("+ LoginWithPrompt(%s) called", username)
	defer func() { s.G().Log.Debug("- LoginWithPrompt -> %s", ErrToOk(err)) }()

	err = s.handle(func() error {
		return s.loginWithPromptHelper(username, loginUI, secretUI, false)
	})
	return
}

func (s *LoginState) LoginWithStoredSecret(username string) (err error) {
	s.G().Log.Debug("+ LoginWithStoredSecret(%s) called", username)
	defer func() { s.G().Log.Debug("- LoginWithStoredSecret -> %s", ErrToOk(err)) }()

	err = s.handle(func() error {
		return s.loginWithStoredSecret(username)
	})
	return
}

func (s *LoginState) LoginWithPassphrase(username, passphrase string, storeSecret bool) (err error) {
	s.G().Log.Debug("+ LoginWithPassphrase(%s) called", username)
	defer func() { s.G().Log.Debug("- LoginWithPassphrase -> %s", ErrToOk(err)) }()

	err = s.handle(func() error {
		return s.loginWithPassphrase(username, passphrase, storeSecret)
	})
	return
}

func (s *LoginState) Logout() error {
	return s.handle(func() error {
		return s.logout()
	})
}

// ExternalFunc is for having the LoginState handler call a
// function outside of LoginState.  The current use case is
// for signup, so that no logins/logouts happen while a signup is
// happening.
func (s *LoginState) ExternalFunc(f func() error) error {
	return s.handle(f)
}

func (s *LoginState) Shutdown() error {
	close(s.requests)
	return s.session.Write()
}

func (s *LoginState) GetCachedTriplesec() *triplesec.Cipher {
	return s.getTsec()
}

func (s *LoginState) GetCachedPassphraseStream() PassphraseStream {
	return s.getPassphraseStream()
}

// GetPassphraseStream either returns a cached, verified passphrase stream
// (maybe from a previous login) or generates a new one via Login. It will
// return the current Passphrase stream on success or an error on failure.
func (s *LoginState) GetPassphraseStream(ui SecretUI) (ret PassphraseStream, err error) {
	if ret = s.GetCachedPassphraseStream(); ret != nil {
		return
	}
	if err = s.verifyPassphrase(ui); err != nil {
		return
	}
	if ret = s.GetCachedPassphraseStream(); ret == nil {
		err = InternalError{"No cached keystream data after login attempt"}
	}
	return
}

// GetVerifiedTripleSec either returns a cached, verified Triplesec
// or generates a new one that's verified via Login.
func (s *LoginState) GetVerifiedTriplesec(ui SecretUI) (ret *triplesec.Cipher, err error) {
	if ret = s.GetCachedTriplesec(); ret != nil {
		return
	}
	if err = s.verifyPassphrase(ui); err != nil {
		return
	}
	if ret = s.GetCachedTriplesec(); ret == nil {
		err = InternalError{"No cached keystream data after login attempt"}
	}
	return
}

// GetUnverifiedPassphraseStream takes a passphrase as a parameter and
// also the salt from the LoginState and computes a Triplesec and
// a passphrase stream.  It's not verified through a Login.
func (s *LoginState) GetUnverifiedPassphraseStream(passphrase string) (tsec *triplesec.Cipher, ret PassphraseStream, err error) {
	return StretchPassphrase(passphrase, s.getSalt())
}

// SetPassphraseStream takes the Triplesec and PassphraseStream returned from
// GetUnverifiedPassphraseStream and commits it to the current LoginState.
// Do this after we've verified a PassphraseStream via successful LKS
// decryption.
func (s *LoginState) SetPassphraseStream(tsec *triplesec.Cipher, pps PassphraseStream) {
	s.setTsec(tsec)
	s.setPassphraseStream(pps)
}

func (s *LoginState) getCachedSharedSecret() []byte {
	return s.getPassphraseStream().PWHash()
}

func (s *LoginState) getSaltAndLoginSession(emailOrUsername string) error {
	if s.getSalt() != nil && s.getLoginSession() != nil && s.getSessionFor() == emailOrUsername {
		return nil
	}

	s.setSessionFor("")

	res, err := s.G().API.Get(ApiArg{
		Endpoint:    "getsalt",
		NeedSession: false,
		Args: HttpArgs{
			"email_or_username": S{emailOrUsername},
		},
	})
	if err != nil {
		return err
	}

	shex, err := res.Body.AtKey("salt").GetString()
	if err != nil {
		return err
	}

	salt, err := hex.DecodeString(shex)
	if err != nil {
		return err
	}
	s.setSalt(salt)

	b64, err := res.Body.AtKey("login_session").GetString()
	if err != nil {
		return err
	}

	if err := s.setLoginSession(b64); err != nil {
		return err
	}

	s.setSessionFor(emailOrUsername)

	return nil
}

func (s *LoginState) stretchPassphrase(passphrase string) error {
	if s.getTsec() != nil && s.getPassphraseStream() != nil {
		return nil
	}

	tsec, passphraseStream, err := StretchPassphrase(passphrase, s.getSalt())
	if err != nil {
		return err
	}
	s.setTsec(tsec)
	s.setPassphraseStream(passphraseStream)

	return nil
}

func (s *LoginState) computeLoginPw() ([]byte, error) {
	mac := hmac.New(sha512.New, s.getCachedSharedSecret())
	mac.Write(s.getLoginSession())
	return mac.Sum(nil), nil
}

func (s *LoginState) postLoginToServer(eOu string, lgpw []byte) (*loginAPIResult, error) {
	res, err := s.G().API.Post(ApiArg{
		Endpoint:    "login",
		NeedSession: false,
		Args: HttpArgs{
			"email_or_username": S{eOu},
			"hmac_pwh":          S{hex.EncodeToString(lgpw)},
			"login_session":     S{s.getLoginSessionEncoded()},
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
	uid, err := GetUid(b.AtKey("uid"))
	if err != nil {
		return nil, err
	}
	uname, err := b.AtKey("me").AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil, err
	}

	return &loginAPIResult{sessionId, csrfToken, *uid, uname}, nil
}

func (s *LoginState) saveLoginState(res *loginAPIResult) error {
	s.clearLoginSession()

	cw := s.G().Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}

	if err := cw.SetUserConfig(NewUserConfig(res.uid, res.username, s.getSalt(), nil), false); err != nil {
		return err
	}

	if err := cw.Write(); err != nil {
		return err
	}

	s.session.SetLoggedIn(res.sessionID, res.csrfToken, res.username, res.uid)
	if err := s.session.Write(); err != nil {
		return err
	}
	// Set up our SecretSyncer to work on the logged in user from here on
	// out.
	s.SecretSyncer().SetUID(&res.uid)

	return nil
}

func (s *LoginState) clearPassphrase() {
	s.clearTsec()
	s.setPassphraseStream(nil)
	s.setSalt(nil)
}

func (s *LoginState) ClearStoredSecret(username string) error {
	secretStore := NewSecretStore(username)
	if secretStore == nil {
		return nil
	}
	return secretStore.ClearSecret()
}

func (r PostAuthProofRes) loginResult() (ret *loginAPIResult, err error) {
	var uid *UID
	if uid, err = UidFromHex(r.UidHex); err != nil {
		return
	}
	ret = &loginAPIResult{
		sessionID: r.SessionId,
		csrfToken: r.CsrfToken,
		uid:       *uid,
		username:  r.Username,
	}
	return
}

// A function that takes a Keyrings object, a user, and returns a
// particular key for that user.
type getSecretKeyFn func(*Keyrings, *User) (GenericKey, error)

// pubkeyLoginHelper looks for a locally available private key and
// tries to establish a session via public key signature.
func (s *LoginState) pubkeyLoginHelper(username string, getSecretKeyFn getSecretKeyFn) (err error) {
	var key GenericKey
	var me *User
	var proof *jsonw.Wrapper
	var sig string
	var pres *PostAuthProofRes

	s.G().Log.Debug("+ pubkeyLoginHelper()")
	defer func() {
		if err != nil && s.secretSyncer != nil {
			s.secretSyncer.Clear()
		}
		s.G().Log.Debug("- pubkeyLoginHelper() -> %s", ErrToOk(err))
	}()

	if _, err = s.G().Env.GetConfig().GetUserConfigForUsername(username); err != nil {
		s.G().Log.Debug("| No Userconfig for %s: %s", username, err.Error())
		return
	}

	if me, err = LoadUser(LoadUserArg{Name: username}); err != nil {
		return
	}

	// Need the loginSession; the salt doesn't really matter here.
	if err = s.getSaltAndLoginSession(username); err != nil {
		return
	}

	if key, err = getSecretKeyFn(s.G().Keyrings, me); err != nil {
		return err
	}

	if proof, err = me.AuthenticationProof(key, s.getLoginSessionEncoded(), AUTH_EXPIRE_IN); err != nil {
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

	return s.saveLoginState(res)
}

func (s *LoginState) checkLoggedIn(username string, force bool) (loggedIn bool, err error) {
	s.G().Log.Debug("+ checkedLoggedIn()")
	defer func() { s.G().Log.Debug("- checkedLoggedIn() -> %t, %s", loggedIn, ErrToOk(err)) }()

	var loggedInTmp bool
	if loggedInTmp, err = s.IsLoggedInLoad(); err != nil {
		s.G().Log.Debug("| Session failed to load")
		return
	}

	un := s.session.GetUsername()
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

func (s *LoginState) switchUser(username string) error {
	if len(username) == 0 || !CheckUsername.F(username) {
	} else if err := s.G().Env.GetConfigWriter().SwitchUser(username); err != nil {
		s.G().Log.Debug("| Can't switch user to %s: %s", username, err.Error())
	} else {
		s.G().Log.Debug("| Successfully switched user to %s", username)
	}
	return nil
}

// Like pubkeyLoginHelper, but ignores most errors.
func (s *LoginState) tryPubkeyLoginHelper(username string, getSecretKeyFn getSecretKeyFn) (loggedIn bool, err error) {
	if err = s.pubkeyLoginHelper(username, getSecretKeyFn); err == nil {
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

func (s *LoginState) tryPassphrasePromptLogin(username string, secretUI SecretUI) (err error) {
	retryMsg := ""
	retryCount := 3
	for i := 0; i < retryCount; i++ {
		err = s.passphraseLogin(username, "", secretUI, retryMsg)

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

func (s *LoginState) getEmailOrUsername(username *string, loginUI LoginUI) (err error) {
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
	return s.switchUser(*username)
}

func (s *LoginState) passphraseLogin(username, passphrase string, secretUI SecretUI, retryMsg string) (err error) {
	s.G().Log.Debug("+ LoginState.passphraseLogin (username=%s)", username)
	defer func() {
		s.G().Log.Debug("- LoginState.passphraseLogin -> %s", ErrToOk(err))
	}()

	if err = s.getSaltAndLoginSession(username); err != nil {
		return
	}

	if _, err = s.getTriplesec(username, passphrase, secretUI, retryMsg); err != nil {
		return
	}

	lgpw, err := s.computeLoginPw()
	if err != nil {
		return
	}

	res, err := s.postLoginToServer(username, lgpw)
	if err != nil {
		s.clearTsec()
		s.setPassphraseStream(nil)
		return err
	}

	if err := s.saveLoginState(res); err != nil {
		return err
	}

	return nil
}

func (s *LoginState) getTriplesec(un string, pp string, ui SecretUI, retry string) (ret *triplesec.Cipher, err error) {
	ret = s.getTsec()
	if ret != nil {
		return
	}

	arg := keybase1.GetKeybasePassphraseArg{
		Username: un,
		Retry:    retry,
	}

	if len(pp) > 0 {
	} else if ui == nil {
		err = NoUiError{"secret"}
	} else if pp, err = ui.GetKeybasePassphrase(arg); err != nil {
		return
	}

	if err = s.stretchPassphrase(pp); err != nil {
		return
	}

	ret = s.getTsec()

	return
}

func (s *LoginState) verifyPassphrase(ui SecretUI) (err error) {
	return s.handle(func() error {
		return s.loginWithPromptHelper(s.G().Env.GetUsername(), nil, ui, true)
	})
}

func (s *LoginState) loginWithPromptHelper(username string, loginUI LoginUI, secretUI SecretUI, force bool) (err error) {
	var loggedIn bool
	if loggedIn, err = s.checkLoggedIn(username, force); err != nil || loggedIn {
		return
	}

	if err = s.switchUser(username); err != nil {
		return
	}

	if err = s.getEmailOrUsername(&username, loginUI); err != nil {
		return
	}

	getSecretKeyFn := func(keyrings *Keyrings, me *User) (GenericKey, error) {
		ska := SecretKeyArg{
			KeyType: AllSecretKeyTypes,
			Me:      me,
		}
		key, _, err := keyrings.GetSecretKeyWithPrompt(ska, secretUI, "Login")
		return key, err
	}

	if loggedIn, err = s.tryPubkeyLoginHelper(username, getSecretKeyFn); err != nil || loggedIn {
		return
	}

	return s.tryPassphrasePromptLogin(username, secretUI)
}

func (s *LoginState) handle(f func() error) error {
	req := loginReq{
		f:   f,
		res: make(chan error),
	}
	s.requests <- req

	return <-req.res
}

func (s *LoginState) handleRequests() {
	for req := range s.requests {
		s.handleRequest(req)
	}
}

func (s *LoginState) handleRequest(req loginReq) {
	requestFinished := false
	var err error
	// Defer this, so that it runs even when req.f() calls
	// runtime.Goexit(); otherwise, this would deadlock. (One case
	// where req.f() would call runtime.Goexit() is if it
	// (erroneously) calls testing.T.FailNow().)
	defer func() {
		if !requestFinished {
			err = fmt.Errorf("Request did not finish")
		}
		req.res <- err
	}()

	err = req.f()
	requestFinished = true
}

func (s *LoginState) loginWithStoredSecret(username string) error {
	if loggedIn, err := s.checkLoggedIn(username, false); err != nil {
		return err
	} else if loggedIn {
		return nil
	}

	if err := s.switchUser(username); err != nil {
		return err
	}

	getSecretKeyFn := func(keyrings *Keyrings, me *User) (GenericKey, error) {
		secretRetriever := NewSecretStore(me.GetName())
		return keyrings.GetSecretKeyWithStoredSecret(me, secretRetriever)
	}
	return s.pubkeyLoginHelper(username, getSecretKeyFn)
}

func (s *LoginState) loginWithPassphrase(username, passphrase string, storeSecret bool) error {
	if loggedIn, err := s.checkLoggedIn(username, false); err != nil {
		return err
	} else if loggedIn {
		return nil
	}

	if err := s.switchUser(username); err != nil {
		return err
	}

	getSecretKeyFn := func(keyrings *Keyrings, me *User) (GenericKey, error) {
		var secretStorer SecretStorer
		if storeSecret {
			secretStorer = NewSecretStore(me.GetName())
		}
		return keyrings.GetSecretKeyWithPassphrase(me, passphrase, secretStorer)
	}
	if loggedIn, err := s.tryPubkeyLoginHelper(username, getSecretKeyFn); err != nil {
		return err
	} else if loggedIn {
		return nil
	}

	return s.passphraseLogin(username, passphrase, nil, "")
}

func (s *LoginState) logout() error {
	s.G().Log.Debug("+ Logout called")
	err := s.session.Logout()
	if err == nil {
		s.clearPassphrase()
	}
	if s.secretSyncer != nil {
		s.secretSyncer.Clear()
	}

	if kr := s.G().Keyrings; kr != nil {
		kr.ClearSecretKeys()
	}

	s.G().Log.Debug("- Logout called")
	return err
}

func (s *LoginState) setSalt(salt []byte) {
	s.mu.Lock()
	s.salt = salt
	s.mu.Unlock()
}

func (s *LoginState) getSalt() []byte {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.salt == nil {
		s.salt = s.G().Env.GetSalt()
	}
	return s.salt
}

func (s *LoginState) setLoginSession(b64 string) error {
	ls, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return err
	}

	s.mu.Lock()
	s.loginSession = ls
	s.loginSessionB64 = b64
	s.mu.Unlock()

	return nil
}

func (s *LoginState) clearLoginSession() {
	s.mu.Lock()
	s.loginSession = nil
	s.loginSessionB64 = ""
	s.mu.Unlock()
}

func (s *LoginState) getLoginSession() []byte {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.loginSession
}

func (s *LoginState) getLoginSessionEncoded() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.loginSessionB64
}

func (s *LoginState) setSessionFor(name string) {
	s.mu.Lock()
	s.sessionFor = name
	s.mu.Unlock()
}

func (s *LoginState) getSessionFor() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.sessionFor
}

func (s *LoginState) setTsec(ts *triplesec.Cipher) {
	s.mu.Lock()
	s.tsec = ts
	s.mu.Unlock()
}

func (s *LoginState) clearTsec() {
	s.mu.Lock()
	if s.tsec != nil {
		s.tsec.Scrub()
		s.tsec = nil
	}
	s.mu.Unlock()
}

func (s *LoginState) getTsec() *triplesec.Cipher {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.tsec
}

func (s *LoginState) setPassphraseStream(p PassphraseStream) {
	s.mu.Lock()
	s.passphraseStream = p
	s.mu.Unlock()
}

func (s *LoginState) getPassphraseStream() PassphraseStream {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.passphraseStream
}

func (s *LoginState) SecretSyncer() *SecretSyncer {
	if s.secretSyncer == nil {
		s.secretSyncer = &SecretSyncer{Contextified: Contextified{s.g}}
	}
	return s.secretSyncer
}

func (s *LoginState) RunSecretSyncer() error {
	return RunSyncer(s.SecretSyncer(), s.UID())
}

func (s *LoginState) LoadSKBKeyring() (*SKBKeyringFile, error) {
	if !s.IsLoggedIn() {
		return nil, LoginRequiredError{}
	}
	unp := s.session.GetUsername()
	// not sure how this could happen, but just in case:
	if unp == nil {
		return nil, NoUsernameError{}
	}

	return s.G().Keyrings.LoadSKBKeyring(*unp)
}
