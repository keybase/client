package service

import (
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
)

func TestInterestingPeople(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 5)
	defer tc.Cleanup()
	tc.G.SetService()

	ip := newInterestingPeople(globals.NewContext(tc.G, &globals.ChatContext{}))
}
