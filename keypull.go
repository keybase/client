package libkb

import ()

const (
	PULL_ERROR  = -1
	PULL_NONE   = 0
	PULL_SECRET = 1
	PULL_PUBLIC = 2
)

type KeyPullArg struct {
	Force        bool
	NeedSecret   bool
	Backgrounded bool
}

type KeyPullState struct {
	arg  KeyPullArg
	res  error
	user *User
	fp   *PgpFingerprint
}

func (s *KeyPullState) loadUser() (err error) {
	// Need user eventually
	s.user, err = LoadUser(LoadUserArg{
		RequirePublicKey: false,
		LoadSecrets:      true,
	})
	return err
}

func (s *KeyPullState) verifyFingerprint() error {
	targ, err := s.user.GetActivePgpFingerprint()
	if err != nil {
		return err
	}
	if s.fp = G.Env.GetPgpFingerprint(); s.fp == nil {
		// noop
	} else if s.fp.Eq(*targ) {
		return nil
	} else {
		return WrongKeyError{s.fp, targ}
	}

	// Ok, we now need to basically "track" ourself to make sure the
	// server wasn't lying
	if s.arg.Backgrounded {
		return NewNeedInputError("Can't verify your key fingerprint while backgrounded")
	}

	ires := s.user.Identify(IdentifyArg{
		Me:         s.user,
		ReportHook: func(s string) { G.OutputString(s) },
	})

	err, warnings := ires.GetErrorLax()
	var prompt string
	if err != nil {
		return err
	} else if warnings != nil {
		warnings.Warn()
		prompt = "Do you still accept these credentials to be your own?"
	} else if len(ires.ProofChecks) == 0 {
		prompt = "We found your account, but you have no hosted proofs. Check your fingerprint carefully. Is this you?"
	} else {
		prompt = "Is this you?"
	}

	err = PromptForConfirmation(prompt)
	if err != nil {
		return err
	}

	return nil
}

func (s *KeyPullState) Run() error {
	if err := s.loadUser(); err != nil {
		return err
	}
	if err := s.verifyFingerprint(); err != nil {
		return err
	}
	return nil
}

// Pull public and private keys from the server
func KeyPull(arg KeyPullArg) error {
	s := KeyPullState{arg: arg}
	s.Run()
	return s.res
}
