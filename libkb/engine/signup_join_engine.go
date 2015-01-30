package engine

import (
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-triplesec"
	"github.com/keybase/go/libkb"
)

type SignupJoinEngine struct {
	signupState *SignupState

	uid            libkb.UID
	session        string
	csrf           string
	lastPassphrase string
	username       string
}

func NewSignupJoinEngine() *SignupJoinEngine { return &SignupJoinEngine{} }

func CheckUsernameAvailable(s string) (err error) {
	_, err = G.API.Get(libkb.ApiArg{
		Endpoint:    "user/lookup",
		NeedSession: false,
		Args: libkb.HttpArgs{
			"username": libkb.S{s},
			"fields":   libkb.S{"basics"},
		},
	})
	if err == nil {
		err = libkb.AppStatusError{
			Code: libkb.SC_BAD_SIGNUP_USERNAME_TAKEN,
			Name: "BAD_SIGNUP_USERNAME_TAKEN",
			Desc: fmt.Sprintf("Username '%s' is taken", s),
		}
	} else if ase, ok := err.(libkb.AppStatusError); ok && ase.Name == "NOT_FOUND" {
		err = nil
	}
	return
}

func (s *SignupJoinEngine) Init() error {
	return nil
}

func (s *SignupJoinEngine) CheckRegistered() (err error) {
	G.Log.Debug("+ libkb.SignupJoinEngine::CheckRegistered")
	if cr := G.Env.GetConfig(); cr == nil {
		err = fmt.Errorf("No configuration file available")
	} else if u := cr.GetUid(); u != nil {
		err = libkb.AlreadyRegisteredError{*u}
	}
	G.Log.Debug("- libkb.SignupJoinEngine::CheckRegistered -> %s", libkb.ErrToOk(err))
	return err
}

type SignupJoinEngineRunArg struct {
	Username   string
	Email      string
	InviteCode string
	PWHash     []byte
	PWSalt     []byte
}

func (s *SignupJoinEngine) Post(arg SignupJoinEngineRunArg) (err error) {
	var res *libkb.ApiRes
	res, err = G.API.Post(libkb.ApiArg{
		Endpoint: "signup",
		Args: libkb.HttpArgs{
			"salt":          libkb.S{hex.EncodeToString(arg.PWSalt)},
			"pwh":           libkb.S{hex.EncodeToString(arg.PWHash)},
			"username":      libkb.S{arg.Username},
			"email":         libkb.S{arg.Email},
			"invitation_id": libkb.S{arg.InviteCode},
			"pwh_version":   libkb.I{int(triplesec.Version)},
		}})
	if err == nil {
		s.username = arg.Username
		libkb.GetUidVoid(res.Body.AtKey("uid"), &s.uid, &err)
		res.Body.AtKey("session").GetStringVoid(&s.session, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&s.csrf, &err)
	}
	return
}

type SignupJoinEngineRunRes struct {
	PassphraseOk bool
	PostOk       bool
	WriteOk      bool
	Uid          *libkb.UID
	User         *libkb.User
	Err          error
}

func (r SignupJoinEngineRunRes) Error() string {
	return r.Err.Error()
}

func (s *SignupJoinEngine) Run(arg SignupJoinEngineRunArg) (res SignupJoinEngineRunRes) {
	res.PassphraseOk = true

	if res.Err = s.Post(arg); res.Err != nil {
		return
	}
	res.PostOk = true
	if res.Err = s.WriteOut(arg.PWSalt); res.Err != nil {
		return
	}
	res.WriteOk = true
	res.Uid = &s.uid
	return
}

func (s *SignupJoinEngine) WriteConfig(salt []byte) error {
	cw := G.Env.GetConfigWriter()
	if cw == nil {
		return fmt.Errorf("No configuration writer available")
	}
	cw.SetUsername(s.username)
	cw.SetUid(s.uid)
	cw.SetSalt(salt)
	return cw.Write()
}

func (s *SignupJoinEngine) WriteSession() error {

	// First load up the Session file...
	if err := G.Session.Load(); err != nil {
		return err
	}

	lir := libkb.LoggedInResult{
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

func (s *SignupJoinEngine) WriteOut(salt []byte) (err error) {
	err = s.WriteConfig(salt)
	if err == nil {
		err = s.WriteSession()
	}
	return err
}

func (s *SignupJoinEngine) PostInviteRequest(arg libkb.InviteRequestArg) error {
	return libkb.PostInviteRequest(arg)
}
