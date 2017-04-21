// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	triplesec "github.com/keybase/go-triplesec"
)

type SignupJoinEngine struct {
	uid            keybase1.UID
	session        string
	csrf           string
	lastPassphrase string
	username       libkb.NormalizedUsername
	ppGen          libkb.PassphraseGeneration

	libkb.Contextified
}

func NewSignupJoinEngine(g *libkb.GlobalContext) *SignupJoinEngine {
	return &SignupJoinEngine{Contextified: libkb.NewContextified(g)}
}

// XXX why is this here?
func CheckUsernameAvailable(g *libkb.GlobalContext, s string) (err error) {
	_, err = g.API.Get(libkb.APIArg{
		Endpoint:    "user/lookup",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"username": libkb.S{Val: s},
			"fields":   libkb.S{Val: "basics"},
		},
	})
	if err == nil {
		err = libkb.AppStatusError{
			Code: libkb.SCBadSignupUsernameTaken,
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
	} else if u := cr.GetUID(); u.Exists() {
		err = libkb.AlreadyRegisteredError{UID: u}
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
	PDPKA5KID  keybase1.KID
	SkipMail   bool
}

func (s *SignupJoinEngine) Post(arg SignupJoinEngineRunArg) (err error) {
	var res *libkb.APIRes
	var ppGenTmp int
	res, err = s.G().API.Post(libkb.APIArg{
		Endpoint:       "signup",
		RetryCount:     5,
		InitialTimeout: libkb.HTTPDefaultTimeout,
		Args: libkb.HTTPArgs{
			"salt":          libkb.S{Val: hex.EncodeToString(arg.PWSalt)},
			"pwh":           libkb.S{Val: hex.EncodeToString(arg.PWHash)},
			"username":      libkb.S{Val: arg.Username},
			"email":         libkb.S{Val: arg.Email},
			"invitation_id": libkb.S{Val: arg.InviteCode},
			"pwh_version":   libkb.I{Val: int(triplesec.Version)},
			"skip_mail":     libkb.B{Val: arg.SkipMail},
			"pdpka5_kid":    libkb.S{Val: arg.PDPKA5KID.String()},
		}})
	if err == nil {
		s.username = libkb.NewNormalizedUsername(arg.Username)
		libkb.GetUIDVoid(res.Body.AtKey("uid"), &s.uid, &err)
		res.Body.AtKey("session").GetStringVoid(&s.session, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&s.csrf, &err)
		res.Body.AtPath("me.basics.passphrase_generation").GetIntVoid(&ppGenTmp, &err)
	}
	if err == nil {
		err = libkb.CheckUIDAgainstUsername(s.uid, arg.Username)
		s.ppGen = libkb.PassphraseGeneration(ppGenTmp)
	}
	return
}

type SignupJoinEngineRunRes struct {
	PassphraseOk bool
	PostOk       bool
	WriteOk      bool
	UID          keybase1.UID
	User         *libkb.User
	Err          error
	PpGen        libkb.PassphraseGeneration
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
	res.UID = s.uid
	res.PpGen = s.ppGen
	return
}

func (s *SignupJoinEngine) WriteOut(lctx libkb.LoginContext, salt []byte) error {
	if err := lctx.LocalSession().Load(); err != nil {
		return err
	}
	if err := lctx.CreateLoginSessionWithSalt(s.username.String(), salt); err != nil {
		return err
	}
	var nilDeviceID keybase1.DeviceID
	if err := lctx.SaveState(s.session, s.csrf, s.username, s.uid, nilDeviceID); err != nil {
		return err
	}
	return nil
}

func (s *SignupJoinEngine) PostInviteRequest(arg libkb.InviteRequestArg) error {
	return libkb.PostInviteRequest(arg)
}
