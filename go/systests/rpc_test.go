// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

// Test various RPCs that are used mainly in other clients but not by the CLI.

import (
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/service"
	context "golang.org/x/net/context"
	"testing"
)

func TestRPCs(t *testing.T) {
	tc := setupTest(t, "resolve2")
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

	stopper := client.NewCmdCtlStopRunner(tc2.G)

	<-startCh

	// Add test RPC methods here.
	testIdentifyResolve2(t, tc2.G)
	testCheckInvitationCode(t, tc2.G)

	if err := stopper.Run(); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

func testIdentifyResolve2(t *testing.T, g *libkb.GlobalContext) {

	cli, err := client.GetIdentifyClient(g)
	if err != nil {
		t.Fatalf("failed to get new identifyclient: %v", err)
	}

	if _, err := cli.Resolve(context.TODO(), "uid:eb72f49f2dde6429e5d78003dae0c919"); err != nil {
		t.Fatalf("Resolve failed: %v\n", err)
	}

	// We don't want to hit the cache, since the previous lookup never hit the
	// server.  For Resolve2, we have to, since we need a username.  So test that
	// here.
	if res, err := cli.Resolve2(context.TODO(), "uid:eb72f49f2dde6429e5d78003dae0c919"); err != nil {
		t.Fatalf("Resolve failed: %v\n", err)
	} else if res.Username != "t_tracy" {
		t.Fatalf("Wrong username: %s != 't_tracy", res.Username)
	}

	if res, err := cli.Resolve2(context.TODO(), "t_tracy@rooter"); err != nil {
		t.Fatalf("Resolve2 failed: %v\n", err)
	} else if res.Username != "t_tracy" {
		t.Fatalf("Wrong name: %s != 't_tracy", res.Username)
	} else if !res.Uid.Equal(keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")) {
		t.Fatalf("Wrong uid for tracy: %s\n", res.Uid)
	}

	if _, err := cli.Resolve2(context.TODO(), "foobag@rooter"); err == nil {
		t.Fatalf("expected an error on a bad resolve, but got none")
	} else if _, ok := err.(libkb.ResolutionError); !ok {
		t.Fatalf("Wrong error: wanted type %T but got (%v, %T)", libkb.ResolutionError{}, err, err)
	}
}

func testCheckInvitationCode(t *testing.T, g *libkb.GlobalContext) {
	cli, err := client.GetSignupClient(g)
	if err != nil {
		t.Fatalf("failed to get a signup client: %v", err)
	}

	err = cli.CheckInvitationCode(context.TODO(), keybase1.CheckInvitationCodeArg{InvitationCode: libkb.TestInvitationCode})
	if err != nil {
		t.Fatalf("Did not expect an error code, but got: %v", err)
	}
	err = cli.CheckInvitationCode(context.TODO(), keybase1.CheckInvitationCodeArg{InvitationCode: "eeoeoeoe333o3"})
	if _, ok := err.(libkb.BadInvitationCodeError); !ok {
		t.Fatalf("Expected an error code, but got %T %v", err, err)
	}
}
