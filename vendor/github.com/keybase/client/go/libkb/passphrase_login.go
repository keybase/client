package libkb

import (
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func pplPromptCheckPreconditions(m MetaContext, usernameOrEmail string) (err error) {

	if m.LoginContext() == nil {
		return InternalError{"PassphraseLoginPrompt: need a non-nil LoginContext"}
	}
	if m.UIs().SecretUI == nil {
		return NoUIError{"secret"}
	}
	if m.UIs().LoginUI == nil && len(usernameOrEmail) == 0 {
		return NoUIError{"login"}
	}
	return nil
}

func pplGetEmailOrUsername(m MetaContext, usernameOrEmail string) (string, error) {
	var err error

	if len(usernameOrEmail) > 0 {
		return usernameOrEmail, nil
	}
	usernameOrEmail, err = m.UIs().LoginUI.GetEmailOrUsername(m.Ctx(), 0)
	if err != nil {
		return "", err
	}
	if len(usernameOrEmail) == 0 {
		return "", NewNoUsernameError()
	}
	return usernameOrEmail, nil
}

func pplGetLoginSession(m MetaContext, usernameOrEmail string) (*LoginSession, error) {
	ret := NewLoginSession(m.G(), usernameOrEmail)
	err := ret.Load(m)
	if err != nil {
		ret = nil
	}
	// Update the LoginContext() so that other downstream calls can use this LoginContext.
	// In particular, DeleteAccountWithContext needs this login context. We might choose
	// to plumb it all the way back, this system is way more convenient (though harder to
	// follow).
	if ret != nil {
		m.LoginContext().SetLoginSession(ret)
	}
	return ret, err
}

func pplPromptOnce(m MetaContext, usernameOrEmail string, ls *LoginSession, retryMsg string) (err error) {
	defer m.CTrace("pplPromptOnce", func() error { return err })()
	ppres, err := GetKeybasePassphrase(m, m.UIs().SecretUI, usernameOrEmail, retryMsg)
	if err != nil {
		return err
	}

	return pplGotPassphrase(m, usernameOrEmail, ppres.Passphrase, ls)
}

func pplGotPassphrase(m MetaContext, usernameOrEmail string, passphrase string, ls *LoginSession) (err error) {
	defer m.CTrace("pplGotPassphrase", func() error { return err })()

	tsec, pps, err := StretchPassphrase(m.G(), passphrase, ls.salt)
	if err != nil {
		return err
	}
	loginSessionBytes, err := ls.Session()
	if err != nil {
		return err
	}
	pdpka, err := computeLoginPackageFromEmailOrUsername(usernameOrEmail, pps, loginSessionBytes)
	if err != nil {
		return err
	}
	res, err := pplPost(m, usernameOrEmail, pdpka)
	if err != nil {
		return err
	}

	var nilDeviceID keybase1.DeviceID
	err = m.LoginContext().SaveState(
		res.sessionID,
		res.csrfToken,
		NewNormalizedUsername(res.username),
		res.uid,
		nilDeviceID,
	)
	if err != nil {
		return err
	}
	pps.SetGeneration(res.ppGen)
	m.LoginContext().CreateStreamCache(tsec, pps)

	return nil
}

func pplPromptLoop(m MetaContext, usernameOrEmail string, maxAttempts int, ls *LoginSession) (err error) {
	defer m.CTrace("pplPromptLoop", func() error { return err })()
	retryMsg := ""
	for i := 0; i < maxAttempts; i++ {
		if err = pplPromptOnce(m, usernameOrEmail, ls, retryMsg); err == nil {
			return nil
		}
		if _, badpw := err.(PassphraseError); !badpw {
			return err
		}
		retryMsg = err.Error()
	}
	return err
}

type loginReply struct {
	Status    AppStatus    `json:"status"`
	Session   string       `json:"session"`
	CsrfToken string       `json:"csrf_token"`
	UID       keybase1.UID `json:"uid"`
	Me        struct {
		Basics struct {
			Username             string               `json:"username"`
			PassphraseGeneration PassphraseGeneration `json:"passphrase_generation"`
		} `json:"basics"`
	} `json:"me"`
}

func (l *loginReply) GetAppStatus() *AppStatus {
	return &l.Status
}

func pplPost(m MetaContext, eOu string, lp PDPKALoginPackage) (*loginAPIResult, error) {

	arg := APIArg{
		Endpoint:    "login",
		SessionType: APISessionTypeNONE,
		Args: HTTPArgs{
			"email_or_username": S{eOu},
		},
		NetContext:     m.Ctx(),
		AppStatusCodes: []int{SCOk, SCBadLoginPassword, SCBadLoginUserNotFound},
	}
	lp.PopulateArgs(&arg.Args)
	var res loginReply
	err := m.G().API.PostDecode(arg, &res)
	if err != nil {
		return nil, err
	}
	if res.Status.Code == SCBadLoginPassword {
		err = PassphraseError{"server rejected login attempt"}
		return nil, err
	}
	if res.Status.Code == SCBadLoginUserNotFound {
		return nil, NotFoundError{}
	}
	return &loginAPIResult{
		sessionID: res.Session,
		csrfToken: res.CsrfToken,
		uid:       res.UID,
		username:  res.Me.Basics.Username,
		ppGen:     res.Me.Basics.PassphraseGeneration,
	}, nil
}

func PassphraseLoginNoPrompt(m MetaContext, usernameOrEmail string, passphrase string) (err error) {
	defer m.CTrace("PassphraseLoginNoPrompt", func() error { return err })()

	var loginSession *LoginSession
	if loginSession, err = pplGetLoginSession(m, usernameOrEmail); err != nil {
		return err
	}
	if err = pplGotPassphrase(m, usernameOrEmail, passphrase, loginSession); err != nil {
		return err
	}
	return nil
}

func PassphraseLoginNoPromptThenSecretStore(m MetaContext, usernameOrEmail string, passphrase string, failOnStoreError bool) (err error) {
	defer m.CTrace("PassphraseLoginNoPromptThenSecretStore", func() error { return err })()

	err = PassphraseLoginNoPrompt(m, usernameOrEmail, passphrase)
	if err != nil {
		return err
	}
	storeErr := pplSecretStore(m)
	if storeErr == nil {
		return nil
	}
	if failOnStoreError {
		return storeErr
	}
	m.CWarningf("Secret store failure: %s", storeErr)
	return nil
}

func PassphraseLoginPrompt(m MetaContext, usernameOrEmail string, maxAttempts int) (err error) {

	defer m.CTrace("PassphraseLoginPrompt", func() error { return err })()

	var loginSession *LoginSession

	if err = pplPromptCheckPreconditions(m, usernameOrEmail); err != nil {
		return err
	}
	if usernameOrEmail, err = pplGetEmailOrUsername(m, usernameOrEmail); err != nil {
		return err
	}
	if loginSession, err = pplGetLoginSession(m, usernameOrEmail); err != nil {
		return err
	}
	if err = pplPromptLoop(m, usernameOrEmail, maxAttempts, loginSession); err != nil {
		return err
	}
	return nil
}

func StoreSecretAfterLogin(m MetaContext, n NormalizedUsername, uid keybase1.UID, deviceID keybase1.DeviceID) (err error) {
	defer m.CTrace("StoreSecretAfterLogin", func() error { return err })()
	lksec := NewLKSecWithDeviceID(m.LoginContext().PassphraseStreamCache().PassphraseStream(), uid, deviceID)
	return StoreSecretAfterLoginWithLKS(m, n, lksec)
}

func pplSecretStore(m MetaContext) (err error) {
	lctx := m.LoginContext()
	uid := lctx.GetUID()
	if uid.IsNil() {
		return NoUIDError{}
	}
	deviceID := m.G().Env.GetDeviceIDForUID(uid)
	if deviceID.IsNil() {
		return NewNoDeviceError(fmt.Sprintf("UID=%s", uid))
	}
	return StoreSecretAfterLogin(m, lctx.GetUsername(), uid, deviceID)
}

func PassphraseLoginPromptThenSecretStore(m MetaContext, usernameOrEmail string, maxAttempts int, failOnStoreError bool) (err error) {
	defer m.CTrace("PassphraseLoginPromptThenSecretStore", func() error { return err })()

	err = PassphraseLoginPrompt(m, usernameOrEmail, maxAttempts)
	if err != nil {
		return err
	}

	storeErr := pplSecretStore(m)
	if storeErr == nil {
		return nil
	}
	if failOnStoreError {
		return storeErr
	}
	m.CDebugf("Secret store failure: %s", storeErr)
	return nil
}

func StoreSecretAfterLoginWithLKS(m MetaContext, n NormalizedUsername, lks *LKSec) (err error) {

	defer m.CTrace("StoreSecretAfterLoginWithLKS", func() error { return err })()

	secretStore := NewSecretStore(m.G(), n)
	if secretStore == nil {
		m.CDebugf("not storing secret; no secret store available")
		return nil
	}

	secret, err := lks.GetSecret(m)
	if err != nil {
		return err
	}

	err = secretStore.StoreSecret(m, secret)
	if err != nil {
		return err
	}

	return nil
}

func getStoredPassphraseStream(m MetaContext) (*PassphraseStream, error) {
	fullSecret, err := m.G().SecretStore().RetrieveSecret(m, m.CurrentUsername())
	if err != nil {
		return nil, err
	}
	lks := NewLKSecWithFullSecret(fullSecret, m.CurrentUID())
	if err = lks.LoadServerHalf(m); err != nil {
		return nil, err
	}
	stream, err := NewPassphraseStreamLKSecOnly(lks)
	if err != nil {
		return nil, err
	}
	return stream, nil
}

// GetPassphraseStreamStored either returns a cached, verified passphrase
// stream from a previous login, the secret store, or generates a new one via
// login. NOTE: this function can return a partial passphrase stream if it
// reads from the secret store. It won't have the material used to decrypt
// server-synced keys or to generate PDPKA material in that case.
func GetPassphraseStreamStored(m MetaContext) (pps *PassphraseStream, err error) {
	defer m.CTrace("GetPassphraseStreamStored", func() error { return err })()

	// 1. try cached
	m.CDebugf("| trying cached passphrase stream")
	if pps = m.PassphraseStream(); pps != nil {
		m.CDebugf("| cached passphrase stream ok, using it")
		return pps, nil
	}

	// 2. try from secret store
	if m.G().SecretStore() != nil {
		m.CDebugf("| trying to get passphrase stream from secret store")
		pps, err = getStoredPassphraseStream(m)
		if err == nil {
			m.CDebugf("| got passphrase stream from secret store")
			return pps, nil
		}
		m.CInfof("| failed to get passphrase stream from secret store: %s", err)
	}

	// 3. login and get it
	m.CDebugf("| using full GetPassphraseStream")
	pps, _, err = GetPassphraseStreamViaPrompt(m)
	if pps != nil {
		m.CDebugf("| success using full GetPassphraseStream")
	}
	return pps, err
}

// GetTriplesecMaybePrompt will try to get the user's current triplesec.
// It will either pluck it out of the environment or prompt the user for
// a passphrase if it can't be found. The secret store is of no use here,
// so skip it. Recall that the full passphrase stream isn't stored to
// the secret store, only the bits that encrypt local keys.
func GetTriplesecMaybePrompt(m MetaContext) (tsec Triplesec, ppgen PassphraseGeneration, err error) {
	defer m.CTrace("GetTriplesecMaybePrompt", func() error { return err })()

	// 1. try cached
	m.CDebugf("| trying cached triplesec")
	if tsec, ppgen = m.TriplesecAndGeneration(); tsec != nil && !ppgen.IsNil() {
		m.CDebugf("| cached trieplsec stream ok, using it")
		return tsec, ppgen, nil
	}

	// 2. login and get it
	m.CDebugf("| using full GetPassphraseStreamViaPrompt")
	var pps *PassphraseStream
	pps, tsec, err = GetPassphraseStreamViaPrompt(m)
	if err != nil {
		return nil, ppgen, err
	}
	if pps == nil {
		m.CDebugf("| Got back empty passphrase stream; returning nil")
		return nil, ppgen, NewNoTriplesecError()
	}
	if tsec == nil {
		m.CDebugf("| Got back empty triplesec")
		return nil, ppgen, NewNoTriplesecError()
	}
	ppgen = pps.Generation()
	if ppgen.IsNil() {
		m.CDebugf("| Got back a non-nill Triplesec but an invalid ppgen; returning nil")
		return nil, ppgen, NewNoTriplesecError()
	}
	m.CDebugf("| got non-nil Triplesec back from prompt")
	return tsec, ppgen, err
}

// GetPassphraseStreamViaPrompt prompts the user for a passphrase and on
// success returns a PassphraseStream and Triplesec derived from the user's
// passphrase. As a side effect, it stores the full LKSec in the secret store.
func GetPassphraseStreamViaPrompt(m MetaContext) (pps *PassphraseStream, tsec Triplesec, err error) {

	// We have to get the current username before we install the new provisional login context,
	// which will shadow the logged in username.
	nun := m.CurrentUsername()
	defer m.CTrace(fmt.Sprintf("GetPassphraseStreamViaPrompt(%s)", nun), func() error { return err })()

	m = m.WithNewProvisionalLoginContext()
	err = PassphraseLoginPromptThenSecretStore(m, nun.String(), 5, false /* failOnStoreError */)
	if err != nil {
		return nil, nil, err
	}
	pps, tsec = m.PassphraseStreamAndTriplesec()
	m.CommitProvisionalLogin()

	return pps, tsec, nil
}

// GetFullPassphraseStreamViaPrompt gets the user's passphrase stream either cached from the
// LoginContext or from the prompt. It doesn't involve the secret store at all, since
// the full passphrase stream isn't stored in the secret store. And also it doesn't
// write the secret store because this function is called right before the user
// changes to a new passphrase, so what's the point. It's assumed that the login context is
// set to non-nil by the caller.
func GetPassphraseStreamViaPromptInLoginContext(m MetaContext) (pps *PassphraseStream, err error) {
	defer m.CTrace("GetPassphraseStreamViaPromptInLoginContext", func() error { return err })()
	if pps = m.PassphraseStream(); pps != nil {
		return pps, nil
	}
	nun := m.CurrentUsername()
	if nun.IsNil() {
		return nil, NewNoUsernameError()
	}
	if err = PassphraseLoginPrompt(m, nun.String(), 5); err != nil {
		return nil, err
	}
	return m.PassphraseStream(), nil
}

// VerifyPassphraseGetFullStream verifies the current passphrase is a correct login
// and if so, will return a full passphrase stream derived from it. Assumes the caller
// made a non-nil LoginContext for us to operate in.
func VerifyPassphraseGetStreamInLoginContext(m MetaContext, passphrase string) (pps *PassphraseStream, err error) {
	defer m.CTrace("VerifyPassphraseGetStreamInLoginContext", func() error { return err })()
	nun := m.CurrentUsername()
	if nun.IsNil() {
		return nil, NewNoUsernameError()
	}
	if err = PassphraseLoginNoPrompt(m, nun.String(), passphrase); err != nil {
		return nil, err
	}
	return m.PassphraseStream(), nil
}

// VerifyPassphraseForLoggedInUser verifies that the current passphrase is correct for the logged
// in user, returning nil if correct, and an error if not. Only used in tests right now, but
// it's fine to use in production code if it seems appropriate.
func VerifyPassphraseForLoggedInUser(m MetaContext, pp string) (pps *PassphraseStream, err error) {
	defer m.CTrace("VerifyPassphraseForLoggedInUser", func() error { return err })()
	uid, un := m.ActiveDevice().GetUsernameAndUIDIfValid(m)
	if uid.IsNil() {
		return nil, NewLoginRequiredError("for VerifyPassphraseForLoggedInUser")
	}
	m = m.WithNewProvisionalLoginContextForUIDAndUsername(uid, un)
	pps, err = VerifyPassphraseGetStreamInLoginContext(m, pp)
	return pps, err
}

// ComputeLoginPackage2 computes the login package for the given UID as dictated by
// the context. It assumes that a passphrase stream has already been loaded. A LoginSession
// is optional. If not available, a new one is requested. Eventually we will kill ComputeLoginPackage
// and rename this to that.
func ComputeLoginPackage2(m MetaContext, pps *PassphraseStream) (ret PDPKALoginPackage, err error) {

	defer m.CTrace("ComputeLoginPackage2", func() error { return err })()
	var ls *LoginSession
	if m.LoginContext() != nil {
		ls = m.LoginContext().LoginSession()
	}
	if ls == nil {
		ls, err = pplGetLoginSession(m, m.CurrentUsername().String())
		if err != nil {
			return ret, err
		}
	}
	var loginSessionRaw []byte
	loginSessionRaw, err = ls.Session()
	if err != nil {
		return ret, err
	}
	return computeLoginPackageFromUID(m.CurrentUID(), pps, loginSessionRaw)
}

// UnverifiedPassphraseStream takes a passphrase as a parameter and
// also the salt from the Account and computes a Triplesec and
// a passphrase stream.  It's not verified through a Login.
func UnverifiedPassphraseStream(m MetaContext, uid keybase1.UID, passphrase string) (tsec Triplesec, ret *PassphraseStream, err error) {
	var salt []byte
	if lctx := m.LoginContext(); lctx != nil && lctx.GetUID().Equal(uid) {
		salt = lctx.Salt()
	}
	if salt == nil {
		salt, err = LookupSaltForUID(m, uid)
		if err != nil {
			return nil, nil, err
		}
	}
	return StretchPassphrase(m.G(), passphrase, salt)
}
