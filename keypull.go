package libkb

import ()

const (
	PULL_ERROR  = -1
	PULL_NONE   = 0
	PULL_SECRET = 1
	PULL_PUBLIC = 2
)

type KeyPullArg struct {
	Force      bool
	NeedSecret bool
}

// Pull public and private keys from the server
func KeyPull(arg KeyPullArg) error {
	return nil
}
