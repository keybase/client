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
	arg KeyPullArg
	res error
}

func (s *KeyPullState) loadUser() int {
	// Need user eventually
	_, err := LoadUser(LoadUserArg{
		RequirePublicKey: false,
		LoadSecrets:      true,
	})
	if err != nil {
		s.res = err
		return PULL_ERROR
	}

	return PULL_NONE
}

func (s *KeyPullState) Run() {
	if pt := s.loadUser(); pt == PULL_ERROR {
		return
	} else if pt != PULL_NONE && s.arg.Backgrounded {
		s.res = NewNeedInputError("Can't fetch your in background when interactive approval needed")
		return
	}

}

// Pull public and private keys from the server
func KeyPull(arg KeyPullArg) error {
	s := KeyPullState{arg: arg}
	s.Run()
	return s.res
}
