package libkb

import (
	"fmt"
)

type LoginState struct {
	Configured      bool
	LoggedIn        bool
	SessionVerified bool
}

func NewLoginState() *LoginState {
	return &LoginState{false, false, false}
}

func (s *LoginState) Login() error {
	G.Log.Debug("+ Login called")

	if s.LoggedIn {
		G.Log.Debug("- Login short-circuited; already logged in")
		return nil
	}

	is_valid, err := G.Session.LoadAndCheck()
	if err != nil {
		return err
	}

	if is_valid {
		s.LoggedIn = true
		G.Log.Debug("Our session token is still valid; we're logged in")
		return nil
	}

	username, err := G.Env.GetOrPromptForEmailOrUsername()
	if err != nil {
		return err
	}

	G.Log.Debug(fmt.Sprintf("| got username: %s\n", username))

	G.Log.Debug("- Login completed")
	return nil
}
