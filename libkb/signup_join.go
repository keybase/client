package libkb

import (
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-triplesec"
)

type SignupJoinEngine struct {
	signupState *SignupState
	// salt        []byte
	// pwh         []byte

	uid            UID
	session        string
	csrf           string
	lastPassphrase string
	username       string
}

func NewSignupJoinEngine() *SignupJoinEngine { return &SignupJoinEngine{} }

func CheckUsernameAvailable(s string) (err error) {
	_, err = G.API.Get(ApiArg{
		Endpoint:    "user/lookup",
		NeedSession: false,
		Args: HttpArgs{
			"username": S{s},
			"fields":   S{"basics"},
		},
	})
	if err == nil {
		err = AppStatusError{
			Code: SC_BAD_SIGNUP_USERNAME_TAKEN,
			Name: "BAD_SIGNUP_USERNAME_TAKEN",
			Desc: fmt.Sprintf("Username '%s' is taken", s),
		}
	} else if ase, ok := err.(AppStatusError); ok && ase.Name == "NOT_FOUND" {
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
		err = AlreadyRegisteredError{*u}
	}
	G.Log.Debug("- libkb.SignupJoinEngine::CheckRegistered -> %s", ErrToOk(err))
	return err
}

/*
func (s *SignupJoinEngine) GenTSPassKey(p string) error {
	G.Log.Debug("+ GenTSPassKey")
	defer G.Log.Debug("- GenTSPassKey")
	if p == s.lastPassphrase && s.signupState != nil {
		return nil
	}

	state := NewSignupState()
	if err := state.GenerateNewSalt(); err != nil {
		return err
	}
	if err := state.TSPassKey(p); err != nil {
		return err
	}

	s.pwh = state.PWHash()
	s.salt = state.Salt()
	s.signupState = state
	s.lastPassphrase = p

	return nil
}
*/

type SignupJoinEngineRunArg struct {
	Username   string
	Email      string
	InviteCode string
	// Passphrase string
	PWHash []byte
	PWSalt []byte
}

func (s *SignupJoinEngine) Post(arg SignupJoinEngineRunArg) (err error) {
	var res *ApiRes
	res, err = G.API.Post(ApiArg{
		Endpoint: "signup",
		Args: HttpArgs{
			// "salt":          S{hex.EncodeToString(s.salt)},
			"salt": S{hex.EncodeToString(arg.PWSalt)},
			// "pwh":           S{hex.EncodeToString(s.pwh)},
			"pwh":           S{hex.EncodeToString(arg.PWHash)},
			"username":      S{arg.Username},
			"email":         S{arg.Email},
			"invitation_id": S{arg.InviteCode},
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

type SignupJoinEngineRunRes struct {
	PassphraseOk bool
	PostOk       bool
	WriteOk      bool
	Uid          *UID
	Error        error
}

func (s *SignupJoinEngine) Run(arg SignupJoinEngineRunArg) (res SignupJoinEngineRunRes) {
	/*
		if res.Error = s.GenTSPassKey(arg.Passphrase); res.Error != nil {
			return
		}
	*/
	res.PassphraseOk = true

	if res.Error = s.Post(arg); res.Error != nil {
		return
	}
	res.PostOk = true
	if res.Error = s.WriteOut(arg.PWSalt); res.Error != nil {
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

func (s *SignupJoinEngine) WriteOut(salt []byte) (err error) {
	err = s.WriteConfig(salt)
	if err == nil {
		err = s.WriteSession()
	}
	return err
}

func (s *SignupJoinEngine) PostInviteRequest(arg InviteRequestArg) error {
	return PostInviteRequest(arg)
}
