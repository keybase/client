// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type SignupJoinEngine struct {
	uv       keybase1.UserVersion
	session  string
	csrf     string
	username libkb.NormalizedUsername
	ppGen    libkb.PassphraseGeneration
	libkb.Contextified
}

func NewSignupJoinEngine(g *libkb.GlobalContext) *SignupJoinEngine {
	return &SignupJoinEngine{Contextified: libkb.NewContextified(g)}
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
	Username    string
	Email       string
	InviteCode  string
	PWHash      []byte
	PWSalt      []byte
	RandomPW    bool
	PDPKA5KID   keybase1.KID
	SkipMail    bool
	VerifyEmail bool
}

func (s *SignupJoinEngine) Post(m libkb.MetaContext, arg SignupJoinEngineRunArg) (err error) {
	var res *libkb.APIRes
	var ppGenTmp int
	postArgs := libkb.HTTPArgs{
		"salt":          libkb.S{Val: hex.EncodeToString(arg.PWSalt)},
		"pwh":           libkb.S{Val: hex.EncodeToString(arg.PWHash)},
		"random_pw":     libkb.B{Val: arg.RandomPW},
		"username":      libkb.S{Val: arg.Username},
		"invitation_id": libkb.S{Val: arg.InviteCode},
		"pwh_version":   libkb.I{Val: int(libkb.ClientTriplesecVersion)},
		"skip_mail":     libkb.B{Val: arg.SkipMail},
		"pdpka5_kid":    libkb.S{Val: arg.PDPKA5KID.String()},
		"platform":      libkb.S{Val: libkb.GetPlatformString()},
		"verify_email":  libkb.B{Val: arg.VerifyEmail},
	}
	if len(arg.Email) > 0 {
		postArgs["email"] = libkb.S{Val: arg.Email}
	} else {
		postArgs["no_email"] = libkb.B{Val: true}
	}
	res, err = m.G().API.Post(m, libkb.APIArg{
		Endpoint: "signup",
		Args:     postArgs,
	})
	if err == nil {
		s.username = libkb.NewNormalizedUsername(arg.Username)
		libkb.GetUIDVoid(res.Body.AtKey("uid"), &s.uv.Uid, &err)
		res.Body.AtKey("session").GetStringVoid(&s.session, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&s.csrf, &err)
		res.Body.AtPath("me.basics.passphrase_generation").GetIntVoid(&ppGenTmp, &err)
	}
	if err == nil {
		err = libkb.CheckUIDAgainstUsername(s.uv.Uid, arg.Username)
		s.ppGen = libkb.PassphraseGeneration(ppGenTmp)
	}
	return err
}

type SignupJoinEngineRunRes struct {
	PassphraseOk bool
	PostOk       bool
	WriteOk      bool
	UV           keybase1.UserVersion
	User         *libkb.User
	Err          error
	PpGen        libkb.PassphraseGeneration
}

func (r SignupJoinEngineRunRes) Error() string {
	return r.Err.Error()
}

func (s *SignupJoinEngine) Run(m libkb.MetaContext, arg SignupJoinEngineRunArg) (res SignupJoinEngineRunRes) {
	res.PassphraseOk = true

	if res.Err = s.Post(m, arg); res.Err != nil {
		return
	}
	res.PostOk = true
	if res.Err = s.WriteOut(m, arg.PWSalt); res.Err != nil {
		return
	}
	res.WriteOk = true
	res.UV = s.uv
	res.PpGen = s.ppGen
	return
}

func (s *SignupJoinEngine) WriteOut(m libkb.MetaContext, salt []byte) error {
	lctx := m.LoginContext()
	if err := lctx.CreateLoginSessionWithSalt(s.username.String(), salt); err != nil {
		return err
	}
	var nilDeviceID keybase1.DeviceID
	if err := lctx.SaveState(s.session, s.csrf, s.username, s.uv, nilDeviceID); err != nil {
		return err
	}
	// Switching to a new user is an operation on the GlobalContext, and will atomically
	// update the config file and alter the current ActiveDevice. So farm out to over there.
	return m.SwitchUserNewConfig(s.uv.Uid, s.username, salt, nilDeviceID)
}

func (s *SignupJoinEngine) PostInviteRequest(m libkb.MetaContext, arg libkb.InviteRequestArg) error {
	return libkb.PostInviteRequest(m, arg)
}
