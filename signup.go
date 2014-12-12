package libkb

import (
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-triplesec"
)

type SignupEngine struct {
	loginState *LoginState
	salt       []byte
	pwh        []byte

	uid            UID
	session        string
	csrf           string
	lastPassphrase string
	username       string
}

func NewSignupEngine() *SignupEngine { return &SignupEngine{} }

func (s *SignupEngine) CheckRegistered() (err error) {
	if cr := G.Env.GetConfig(); cr == nil {
		err = fmt.Errorf("No configuration file available")
	} else if u := cr.GetUid(); u != nil {
		err = AlreadyRegisteredError{*u}
	}
	return err
}

func (s *SignupEngine) GenPwh(p string) (err error) {
	G.Log.Debug("+ GenPwh")
	defer G.Log.Debug("- GenPwh")
	if p == s.lastPassphrase && s.loginState != nil {
		return
	}
	state := NewLoginState()
	if err = state.GenerateNewSalt(); err != nil {
	} else if err = state.StretchKey(p); err != nil {
	} else {
		s.pwh = state.GetSharedSecret()
		s.salt, err = state.GetSalt()
		s.loginState = state
		s.lastPassphrase = p
	}
	return err
}

type SignupEnginePostArg struct {
	Username     string
	Email        string
	InvitationId string
}

func (s *SignupEngine) Post(arg SignupEnginePostArg) (err error) {
	var res *ApiRes
	res, err = G.API.Post(ApiArg{
		Endpoint: "signup",
		Args: HttpArgs{
			"salt":          S{hex.EncodeToString(s.salt)},
			"pwh":           S{hex.EncodeToString(s.pwh)},
			"username":      S{arg.Username},
			"email":         S{arg.Email},
			"invitation_id": S{arg.InvitationId},
			"pwh_version":   I{int(triplesec.Version)},
		}})
	if err == nil {
		s.username = arg.Username
		GetUidVoid(res.Body.AtKey("uid"), &s.uid, &err)
		res.Body.AtKey("session").GetStringVoid(&s.session, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&s.csrf, &err)

	}
	return

}

func (s *SignupEngine) WriteConfig() error {
	cw := G.Env.GetConfigWriter()
	if cw == nil {
		return fmt.Errorf("No configuration writer available")
	}
	cw.SetUsername(s.username)
	cw.SetUid(s.uid)
	cw.SetSalt(s.salt)
	return cw.Write()
}

func (s *SignupEngine) WriteSession() error {

	// First load up the Session file...
	if err := G.Session.Load(); err != nil {
		return err
	}

	lir := LoggedInResult{
		SessionId: s.session,
		CsrfToken: s.csrf,
		Uid:       s.uid,
		Username:  s.username,
	}
	sw := G.SessionWriter
	if sw == nil {
		return fmt.Errorf("No session writer available")
	}
	sw.SetLoggedIn(lir)
	return sw.Write()
}

func (s *SignupEngine) WriteOut() (err error) {
	err = s.WriteConfig()
	if err == nil {
		err = s.WriteSession()
	}
	return err
}

func (s *SignupEngine) PostInviteRequest(arg InviteRequestArg) error {
	return PostInviteRequest(arg)
}
