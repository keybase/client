package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"os"
)

func NewCmdSignup(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "signup",
		Usage:       "keybase signup [-c <code>]",
		Description: "signup for a new account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSignupState{}, "signup", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "c, invite-code",
				Usage: "Specify an invite code",
			},
		},
	}
}

type CmdSignupState struct {
	code   string
	remote bool
}

func (s *CmdSignupState) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.code = ctx.String("invite-code")

	if nargs != 0 {
		err = BadArgsError{"signup doesn't take arguments"}
	}
	return err
}

func (s *CmdSignupState) SuccessMessage() error {
	msg := `
Welcome to keybase.io! 

    (need new instructions here...)

Enjoy!
`
	os.Stdout.Write([]byte(msg))
	return nil
}

func (s *CmdSignupState) RunClient() error {
	G.Log.Debug("| Remote mode")
	s.remote = true
	return s.run()
}

func (s *CmdSignupState) Run() error {
	G.Log.Debug("| Standalone mode")
	s.remote = false
	return s.run()
}

func (s *CmdSignupState) run() error {
	G.Log.Debug("+ CmdSignupState::Run")
	defer G.Log.Debug("- CmdSignupState::Run")
	if s.remote {
		G.Log.Debug("| Remote mode")
	} else {
		G.Log.Debug("| Standalone mode")
	}

	if done, err := s.join(); err != nil {
		return err
	} else if done {
		return nil
	}

	if err := s.registerDevice(); err != nil {
		return err
	}

	if err := s.provision(); err != nil {
		return err
	}

	s.SuccessMessage()
	return nil
}

func (s *CmdSignupState) join() (done bool, err error) {
	G.Log.Debug("+ CmdSignupState::join")
	defer G.Log.Debug("- CmdSignupState::join")
	state := &CmdSignupJoinState{code: s.code}
	if s.remote {
		err = state.RunClient()
	} else {
		err = state.Run()
	}
	if err != nil {
		return false, err
	}
	// if they requested an invite, we're done...
	done = state.requestedInvite
	return done, nil
}

func (s *CmdSignupState) registerDevice() error {
	G.Log.Debug("+ CmdSignupState::registerDevice")
	defer G.Log.Debug("- CmdSignupState::registerDevice")
	state := NewCmdSignupRegDevState()
	if s.remote {
		return state.RunClient()
	}
	return state.Run()
}

func (s *CmdSignupState) provision() error {
	G.Log.Debug("+ CmdSignupState::provision")
	defer G.Log.Debug("- CmdSignupState::provision")
	return nil
}

func (v *CmdSignupState) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:   true,
		API:      true,
		Terminal: true,
	}
}
