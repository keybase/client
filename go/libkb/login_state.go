package libkb

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"fmt"

	keybase_1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	triplesec "github.com/keybase/go-triplesec"
)

type LoggedInResult struct {
	SessionId string
	CsrfToken string
	Uid       UID
	Username  string
}

type LoginState struct {
	Contextified
	Configured      bool
	SessionVerified bool

	salt             []byte
	loginSession     []byte
	loginSessionB64  string
	tsec             *triplesec.Cipher
	sessionFor       string
	passphraseStream PassphraseStream

	loggedInRes *LoggedInResult

	// session is contained in LoginState
	session       *Session      // The user's session cookie, &c
	sessionWriter SessionWriter // to write the session back out
}

func NewLoginState(g *GlobalContext) *LoginState {
	s := newSession(g)
	return &LoginState{
		Contextified:  Contextified{g},
		session:       s,
		sessionWriter: s,
	}
}

func (s *LoginState) Session() *Session            { return s.session }
func (s *LoginState) SessionWriter() SessionWriter { return s.sessionWriter }

func (s LoginState) IsLoggedIn() bool {
	return s.session.IsLoggedIn()
}

func (s *LoginState) LoginWithPrompt(username string, loginUI LoginUI, secretUI SecretUI) (err error) {
	G.Log.Debug("+ LoginWithPrompt(%s) called", username)
	defer func() { G.Log.Debug("- LoginWithPrompt -> %s", ErrToOk(err)) }()
	return s.loginWithPromptHelper(username, loginUI, secretUI, false)
}

func (s *LoginState) LoginWithStoredSecret(username string) (err error) {
	G.Log.Debug("+ LoginWithStoredSecret(%s) called", username)
	defer func() { G.Log.Debug("- LoginWithStoredSecret -> %s", ErrToOk(err)) }()

	var loggedIn bool
	if loggedIn, err = s.checkLoggedIn(username, false); err != nil || loggedIn {
		return
	}

	if err = s.switchUser(username); err != nil {
		return
	}

	getSecretKeyFn := func(keyrings *Keyrings, me *User) (GenericKey, error) {
		secretRetriever := NewSecretStore(me)
		return keyrings.GetSecretKeyWithStoredSecret(me, secretRetriever)
	}
	return s.pubkeyLoginHelper(username, getSecretKeyFn)
}

func (s *LoginState) LoginWithPassphrase(username, passphrase string, storeSecret bool) (err error) {
	G.Log.Debug("+ LoginWithPassphrase(%s) called", username)
	defer func() { G.Log.Debug("- LoginWithPassphrase -> %s", ErrToOk(err)) }()

	var loggedIn bool
	if loggedIn, err = s.checkLoggedIn(username, false); err != nil || loggedIn {
		return
	}

	if err = s.switchUser(username); err != nil {
		return
	}

	getSecretKeyFn := func(keyrings *Keyrings, me *User) (GenericKey, error) {
		var secretStorer SecretStorer
		if storeSecret {
			secretStorer = NewSecretStore(me)
		}
		return keyrings.GetSecretKeyWithPassphrase(me, passphrase, secretStorer)
	}
	if loggedIn, err = s.tryPubkeyLoginHelper(username, getSecretKeyFn); err != nil || loggedIn {
		return
	}

	return s.passphraseLogin(username, passphrase, nil, "")
}

func (s *LoginState) Logout() error {
	G.Log.Debug("+ Logout called")
	username := s.session.GetUsername()
	err := s.session.Logout()
	if err == nil {
		s.SessionVerified = false
		s.clearPassphrase()
	}
	if G.SecretSyncer != nil {
		G.SecretSyncer.Clear()
	}
	if username != nil {
		G.Keyrings.ClearSecretKeys(*username)
	}
	G.Log.Debug("- Logout called")
	return err
}

func (s *LoginState) GetCachedTriplesec() *triplesec.Cipher {
	return s.tsec
}

func (s LoginState) GetCachedPassphraseStream() PassphraseStream {
	return s.passphraseStream
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
	var salt []byte
	if salt, err = s.getSalt(); err != nil {
		return
	}
	return StretchPassphrase(passphrase, salt)
}

// SetPassphraseStream takes the Triplesec and PassphraseStream returned from
// GetUnverifiedPassphraseStream and commits it to the current LoginState.
// Do this after we've verified a PassphraseStream via successful LKS
// decryption.
func (s *LoginState) SetPassphraseStream(tsec *triplesec.Cipher, pps PassphraseStream) {
	s.tsec = tsec
	s.passphraseStream = pps
}

func (s LoginState) getCachedSharedSecret() []byte {
	return s.passphraseStream.PWHash()
}

func (s *LoginState) getSalt() (salt []byte, err error) {
	if s.salt == nil {
		s.salt = G.Env.GetSalt()
	}
	salt = s.salt
	return
}

func (s *LoginState) getSaltAndLoginSession(email_or_username string) error {

	if s.salt != nil && s.loginSession != nil && s.sessionFor == email_or_username {
		return nil
	}
	s.sessionFor = ""

	res, err := G.API.Get(ApiArg{
		Endpoint:    "getsalt",
		NeedSession: false,
		Args: HttpArgs{
			"email_or_username": S{email_or_username},
		},
	})
	if err != nil {
		return err
	}

	shex, err := res.Body.AtKey("salt").GetString()
	if err != nil {
		return err
	}

	s.salt, err = hex.DecodeString(shex)
	if err != nil {
		return err
	}

	ls_b64, err := res.Body.AtKey("login_session").GetString()
	if err != nil {
		return err
	}

	s.loginSession, err = base64.StdEncoding.DecodeString(ls_b64)
	if err != nil {
		return err
	}

	s.loginSessionB64 = ls_b64
	s.sessionFor = email_or_username

	return nil
}

func (s *LoginState) stretchPassphrase(passphrase string) (err error) {
	if s.tsec == nil {
		s.tsec, s.passphraseStream, err = StretchPassphrase(passphrase, s.salt)
	}
	return err
}

func (s *LoginState) computeLoginPw() ([]byte, error) {
	mac := hmac.New(sha512.New, s.getCachedSharedSecret())
	mac.Write(s.loginSession)
	return mac.Sum(nil), nil
}

func (s *LoginState) postLoginToServer(eOu string, lgpw []byte) error {
	res, err := G.API.Post(ApiArg{
		Endpoint:    "login",
		NeedSession: false,
		Args: HttpArgs{
			"email_or_username": S{eOu},
			"hmac_pwh":          S{hex.EncodeToString(lgpw)},
			"login_session":     S{s.loginSessionB64},
		},
		AppStatus: []string{"OK", "BAD_LOGIN_PASSWORD"},
	})
	if err != nil {
		return err
	}
	if res.AppStatus == "BAD_LOGIN_PASSWORD" {
		err = PassphraseError{"server rejected login attempt"}
		return err
	}

	b := res.Body
	sessionId, err := b.AtKey("session").GetString()
	if err != nil {
		return err
	}
	csrfToken, err := b.AtKey("csrf_token").GetString()
	if err != nil {
		return err
	}
	uid, err := GetUid(b.AtKey("uid"))
	if err != nil {
		return nil
	}
	uname, err := b.AtKey("me").AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil
	}

	s.loggedInRes = &LoggedInResult{sessionId, csrfToken, *uid, uname}
	return nil
}

func (s *LoginState) saveLoginState() (err error) {
	s.SessionVerified = true
	s.loginSession = nil
	s.loginSessionB64 = ""

	if cfg := G.Env.GetConfigWriter(); cfg != nil {

		if err = cfg.SetUserConfig(NewUserConfig(s.loggedInRes.Uid, s.loggedInRes.Username,
			s.salt, nil), false); err != nil {
			return err
		}

		if err = cfg.Write(); err != nil {
			return err
		}
	}

	if s.sessionWriter != nil {
		s.sessionWriter.SetLoggedIn(*s.loggedInRes)
		if err = s.sessionWriter.Write(); err != nil {
			return err
		}
	}

	return nil
}

func (s *LoginState) clearPassphrase() {
	if s.tsec != nil {
		s.tsec.Scrub()
		s.tsec = nil
	}
	s.passphraseStream = nil
	s.salt = nil
}

func (s *LoginState) ClearStoredSecret(username string) error {
	secretStore := NewSecretStore(NewUserThin(username, UID{}))
	if secretStore == nil {
		return nil
	}
	return secretStore.ClearSecret()
}

func (r PostAuthProofRes) toLoggedInResult() (ret *LoggedInResult, err error) {
	var uid *UID
	if uid, err = UidFromHex(r.UidHex); err != nil {
		return
	}
	ret = &LoggedInResult{
		SessionId: r.SessionId,
		CsrfToken: r.CsrfToken,
		Uid:       *uid,
		Username:  r.Username,
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

	G.Log.Debug("+ pubkeyLoginHelper()")
	defer func() {
		if err != nil && G.SecretSyncer != nil {
			G.SecretSyncer.Clear()
		}
		G.Log.Debug("- pubkeyLoginHelper() -> %s", ErrToOk(err))
	}()

	if _, err = G.Env.GetConfig().GetUserConfigForUsername(username); err != nil {
		G.Log.Debug("| No Userconfig for %s: %s", username, err.Error())
		return
	}

	if me, err = LoadUser(LoadUserArg{Name: username}); err != nil {
		return
	}

	// Need the loginSession; the salt doesn't really matter here.
	if err = s.getSaltAndLoginSession(username); err != nil {
		return
	}

	if key, err = getSecretKeyFn(G.Keyrings, me); err != nil {
		return err
	}

	if proof, err = me.AuthenticationProof(key, s.loginSessionB64, AUTH_EXPIRE_IN); err != nil {
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

	if s.loggedInRes, err = pres.toLoggedInResult(); err != nil {
		return
	}

	err = s.saveLoginState()
	return
}

func (s *LoginState) checkLoggedIn(username string, force bool) (loggedIn bool, err error) {

	G.Log.Debug("+ checkedLoggedIn()")
	defer func() { G.Log.Debug("- checkedLoggedIn() -> %t, %s", loggedIn, ErrToOk(err)) }()

	var loggedInTmp bool
	if loggedInTmp, err = s.session.LoadAndCheck(); err != nil {
		G.Log.Debug("| Session failed to load")
		return
	}

	un := s.session.GetUsername()
	if loggedInTmp && len(username) > 0 && un != nil && username != *un {
		err = LoggedInError{}
		return
	}

	if !force && loggedInTmp {
		s.SessionVerified = true
		G.Log.Debug("| Our session token is still valid; we're logged in")
		loggedIn = true
	}
	return
}

func (s *LoginState) switchUser(username string) error {
	if len(username) == 0 || !CheckUsername.F(username) {
	} else if err := G.Env.GetConfigWriter().SwitchUser(username); err != nil {
		G.Log.Debug("| Can't switch user to %s: %s", username, err.Error())
	} else {
		G.Log.Debug("| Successfully switched user to %s", username)
	}
	return nil
}

// Like pubkeyLoginHelper, but ignores most errors.
func (s *LoginState) tryPubkeyLoginHelper(username string, getSecretKeyFn getSecretKeyFn) (loggedIn bool, err error) {
	if err = s.pubkeyLoginHelper(username, getSecretKeyFn); err == nil {
		G.Log.Debug("| Pubkey login succeeded")
		loggedIn = true
		return
	}

	if _, ok := err.(CanceledError); ok {
		G.Log.Debug("| Canceled pubkey login, so cancel login")
		return
	}

	G.Log.Debug("| Public key login failed, falling back: %s", err.Error())
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

	*username = G.Env.GetEmailOrUsername()
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
	return
}

func (s *LoginState) passphraseLogin(username, passphrase string, secretUI SecretUI, retryMsg string) (err error) {
	G.Log.Debug("+ LoginState.passphraseLogin (username=%s)", username)
	defer func() {
		G.Log.Debug("- LoginState.passphraseLogin -> %s", ErrToOk(err))
	}()

	if err = s.getSaltAndLoginSession(username); err != nil {
		return
	}

	if _, err = s.getTriplesec(username, passphrase, secretUI, retryMsg); err != nil {
		return
	}

	var lgpw []byte
	lgpw, err = s.computeLoginPw()

	if err != nil {
		return
	}

	err = s.postLoginToServer(username, lgpw)
	if err != nil {
		s.tsec = nil
		s.passphraseStream = nil
		return err
	}

	err = s.saveLoginState()
	if err != nil {
		return err
	}

	return
}

func (s *LoginState) getTriplesec(un string, pp string, ui SecretUI, retry string) (ret *triplesec.Cipher, err error) {
	if s.tsec != nil {
		ret = s.tsec
		return
	}
	var salt []byte
	if salt, err = s.getSalt(); err != nil {
		return
	} else if salt == nil {
		err = fmt.Errorf("Cannot encrypt; no salt found")
	}

	arg := keybase_1.GetKeybasePassphraseArg{
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

	ret = s.tsec
	return
}

func (s *LoginState) verifyPassphrase(ui SecretUI) (err error) {
	return s.loginWithPromptHelper(G.Env.GetUsername(), nil, ui, true)
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
			All: true,
			Me:  me,
		}
		key, _, err := keyrings.GetSecretKeyWithPrompt(ska, secretUI, "Login")
		return key, err
	}

	if loggedIn, err = s.tryPubkeyLoginHelper(username, getSecretKeyFn); err != nil || loggedIn {
		return
	}

	return s.tryPassphrasePromptLogin(username, secretUI)
}
