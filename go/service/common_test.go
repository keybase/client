package service

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func setupServiceTest(tb testing.TB) {
	// This is an empty environment
	libkb.G.Env = libkb.NewEnv(nil, nil)
}
