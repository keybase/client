package main

import (
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
)

// This isn't a true subcommand.  It is the register device step of
// the signup process.  It will probably move somewhere else once
// more provisioning profiles are implemented...

type CmdSignupRegDevState struct {
	nameField *Field
	engine    devEngine
}

func NewCmdSignupRegDevState() *CmdSignupRegDevState {
	s := &CmdSignupRegDevState{}
	s.nameField = &Field{
		Defval:  "home computer",
		Name:    "devname",
		Prompt:  "A public name for this device",
		Checker: &libkb.CheckNotEmpty,
	}

	return s
}

func (s *CmdSignupRegDevState) RunClient() error {
	s.engine = &RemoteDeviceEngine{}
	return s.run()
}

func (s *CmdSignupRegDevState) Run() error {
	s.engine = libkb.NewDeviceEngine()
	return s.run()
}

func (s *CmdSignupRegDevState) run() error {
	if err := s.prompt(); err != nil {
		return err
	}
	if err := s.engine.Init(); err != nil {
		return err
	}
	if err := s.engine.Run(s.nameField.GetValue()); err != nil {
		return err
	}
	/*
		if !res.PostOK {
			// XXX HandlePostError
		} else {
			return res.Error
		}
	*/

	return nil
}

func (s *CmdSignupRegDevState) prompt() error {
	prompter := NewPrompter([]*Field{s.nameField})
	return prompter.Run()
}

type devEngine interface {
	Init() error
	Run(devName string) error // *libkb.DeviceEngineRunRes
}

type RemoteDeviceEngine struct {
	cli keybase_1.DeviceClient
	// ccli keybase_1.ConfigClient
}

func (r *RemoteDeviceEngine) Init() error {
	var err error
	r.cli, err = GetDeviceClient()
	return err
}

func (r *RemoteDeviceEngine) Run(devName string) error { // *libkb.DeviceEngineRunRes {
	/*
		rarg := keybase_1.SignupArg{
			Username:   arg.Username,
			Email:      arg.Email,
			InviteCode: arg.InviteCode,
			Passphrase: arg.Passphrase,
		}
		rres, err := e.scli.Signup(rarg)
		if res.Error = err; err == nil {
			res.PassphraseOk = rres.PassphraseOk
			res.PostOk = rres.PostOk
			res.WriteOk = rres.WriteOk
		}
	*/
	err := r.cli.Register(devName)
	if err != nil {
		return err
	}
	return nil
}
