package engine

import (
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/libkb"
	triplesec "github.com/keybase/go-triplesec"
)

type SignupJoinEngine struct {
	signupState *SignupState

	uid            libkb.UID
	session        string
	csrf           string
	lastPassphrase string
	username       string

	libkb.Contextified
}

func NewSignupJoinEngine(g *libkb.GlobalContext) *SignupJoinEngine {
	return &SignupJoinEngine{Contextified: libkb.NewContextified(g)}
}

// XXX why is this here?
func CheckUsernameAvailable(g *libkb.GlobalContext, s string) (err error) {
	_, err = g.API.Get(libkb.ApiArg{
		Endpoint:    "user/lookup",
		NeedSession: false,
		Args: libkb.HttpArgs{
			"username": libkb.S{Val: s},
			"fields":   libkb.S{Val: "basics"},
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
	s.G().Log.Debug("+ libkb.SignupJoinEngine::CheckRegistered")
	if cr := s.G().Env.GetConfig(); cr == nil {
		err = fmt.Errorf("No configuration file available")
	} else if u := cr.GetUID(); u != nil {
		err = libkb.AlreadyRegisteredError{Uid: *u}
	}
	s.G().Log.Debug("- libkb.SignupJoinEngine::CheckRegistered -> %s", libkb.ErrToOk(err))
	return err
}

type SignupJoinEngineRunArg struct {
	Username   string
	Email      string
	InviteCode string
	PWHash     []byte
	PWSalt     []byte
	SkipMail   bool
}

func (s *SignupJoinEngine) Post(arg SignupJoinEngineRunArg) (err error) {
	var res *libkb.ApiRes
	res, err = s.G().API.Post(libkb.ApiArg{
		Endpoint: "signup",
		Args: libkb.HttpArgs{
			"salt":          libkb.S{Val: hex.EncodeToString(arg.PWSalt)},
			"pwh":           libkb.S{Val: hex.EncodeToString(arg.PWHash)},
			"username":      libkb.S{Val: arg.Username},
			"email":         libkb.S{Val: arg.Email},
			"invitation_id": libkb.S{Val: arg.InviteCode},
			"pwh_version":   libkb.I{Val: int(triplesec.Version)},
			"skip_mail":     libkb.B{Val: arg.SkipMail},
		}})
	if err == nil {
		s.username = arg.Username
		libkb.GetUidVoid(res.Body.AtKey("uid"), &s.uid, &err)
		res.Body.AtKey("session").GetStringVoid(&s.session, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&s.csrf, &err)
	}
	if err == nil {
		err = libkb.CheckUIDAgainstUsername(s.uid, arg.Username)
	}
	return
}

type SignupJoinEngineRunRes struct {
	PassphraseOk bool
	PostOk       bool
	WriteOk      bool
	UID          *libkb.UID
	User         *libkb.User
	Err          error
}

func (r SignupJoinEngineRunRes) Error() string {
	return r.Err.Error()
}

func (s *SignupJoinEngine) Run(lctx libkb.LoginContext, arg SignupJoinEngineRunArg) (res SignupJoinEngineRunRes) {
	res.PassphraseOk = true

	if res.Err = s.Post(arg); res.Err != nil {
		return
	}
	res.PostOk = true
	if res.Err = s.WriteOut(lctx, arg.PWSalt); res.Err != nil {
		return
	}
	res.WriteOk = true
	res.UID = &s.uid
	return
}

func (s *SignupJoinEngine) WriteOut(lctx libkb.LoginContext, salt []byte) error {
	if err := lctx.LocalSession().Load(); err != nil {
		return err
	}
	if err := lctx.CreateLoginSessionWithSalt(s.username, salt); err != nil {
		return err
	}
	if err := lctx.SaveState(s.session, s.csrf, s.username, s.uid); err != nil {
		return err
	}
	return nil
}

func (s *SignupJoinEngine) PostInviteRequest(arg libkb.InviteRequestArg) error {
	return libkb.PostInviteRequest(arg)
}
