// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

// Test various RPCs that are used mainly in other clients but not by the CLI.

import (
	"testing"
	"time"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	context "golang.org/x/net/context"
)

func TestAccountDeadlock(t *testing.T) {
	tc := setupTest(t, "deadlock")
	tc2 := cloneContext(tc)

	libkb.G.LocalDb = nil

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			t.Logf("Running the service produced an error: %v", err)
		}
		stopCh <- err
	}()

	<-startCh

	signupDoneCh := make(chan struct{})

	go func() {
		issueSignup(t, tc2.G)
		signupDoneCh <- struct{}{}
	}()

	currentStatusLoop(t, tc2.G, signupDoneCh)

	if err := client.CtlServiceStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

func issueSignup(t *testing.T, g *libkb.GlobalContext) {
	cli, err := client.GetSignupClient(g)
	if err != nil {
		t.Fatalf("failed to get new identifyclient: %v", err)
	}

	id, err := libkb.RandString("", 5)
	if err != nil {
		t.Fatalf("Failed to get a random string: %s", err)
	}

	arg := keybase1.SignupArg{
		Email:      "test+" + id + "@keyba.se",
		Passphrase: "strong-password",
		Username:   "t_" + id,
		DeviceName: "dev0",
		InviteCode: "202020202020202020202020",
		DeviceType: keybase1.DeviceType_DESKTOP,
	}

	if _, err := cli.Signup(context.TODO(), arg); err != nil {
		t.Fatalf("signup failed: %s", err)
	}
}

func currentStatusLoop(t *testing.T, g *libkb.GlobalContext, stopCh chan struct{}) {
	cli, err := client.GetSessionClient(g)
	if err != nil {
		t.Fatal(err)
	}
	for {
		select {
		case <-stopCh:
			return
		case <-time.After(50 * time.Millisecond):
			_, err := cli.CurrentSession(context.TODO(), 0)
			if err != nil {
				if _, ok := err.(libkb.NoSessionError); !ok {
					t.Fatal(err)
				}
			}
		}
	}
}
