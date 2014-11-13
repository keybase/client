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
		PublicKeyOptional: true,
		LoadSecrets:       true,
	})
	return err
}

func (s *KeyPullState) Run() error {
	if err := s.loadUser(); err != nil {
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
