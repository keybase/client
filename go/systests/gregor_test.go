// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"bytes"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type electronMock struct {
	libkb.Contextified
	errCh   chan error
	stateCh chan keybase1.PushStateArg
	oobmCh  chan gregor1.OutOfBandMessage
}

func (e *electronMock) PushState(ctx context.Context, a keybase1.PushStateArg) (err error) {
	e.G().Log.Debug("electronMock::PushState: %#v\n", a)
	e.stateCh <- a
	return nil
}

func (e *electronMock) PushOutOfBandMessages(_ context.Context, msgs []gregor1.OutOfBandMessage) error {
	for _, m := range msgs {
		e.oobmCh <- m
	}
	return nil
}

func newElectronMock(g *libkb.GlobalContext) *electronMock {
	return &electronMock{
		Contextified: libkb.NewContextified(g),
		errCh:        make(chan error, 1),
		stateCh:      make(chan keybase1.PushStateArg, 10),
		oobmCh:       make(chan gregor1.OutOfBandMessage, 10),
	}
}

// filterPubsubdItems removes pubsubd generated IBMs from state
func filterPubsubdItems(items []gregor1.ItemAndMetadata) (res []gregor1.ItemAndMetadata) {
	for _, i := range items {
		if !strings.HasPrefix(i.Category().String(), "user.") {
			res = append(res, i)
		}
	}
	return
}

func TestGregorForwardToElectron(t *testing.T) {
	tc := setupTest(t, "gregor")
	defer tc.Cleanup()
	tc1 := cloneContext(tc)

	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	stopCh := make(chan error)
	go func() {
		tc.G.Log.Debug("+ Service.Run")
		err := svc.Run()
		tc.G.Log.Debug("- Service.Run")
		if err != nil {
			t.Logf("Running the service produced an error: %v", err)
		}
		stopCh <- err
	}()

	userInfo := randomUser("grgr")
	sui := signupUI{
		info:         userInfo,
		Contextified: libkb.NewContextified(tc.G),
	}
	tc.G.SetUI(&sui)
	signup := client.NewCmdSignupRunner(tc.G)
	signup.SetTest()

	// Wait for the server to start up
	<-startCh

	if err := signup.Run(); err != nil {
		t.Fatal(err)
	}
	tc.G.Log.Debug("Login State: %v", tc.G.LoginState())

	var err error
	check := func() {
		if err != nil {
			t.Fatal(err)
		}
	}
	cli, xp, err := client.GetRPCClientWithContext(tc1.G)
	srv := rpc.NewServer(xp, nil)
	em := newElectronMock(tc.G)
	err = srv.Register(keybase1.GregorUIProtocol(em))
	check()
	ncli := keybase1.DelegateUiCtlClient{Cli: cli}

	// Spin until gregor comes up; it should come up after signup
	var ok bool
	for i := 0; !ok && i < 200; i++ {
		if ok = svc.HasGregor(); !ok {
			time.Sleep(50 * time.Millisecond)
		} else {
			tc.G.Log.Debug("spinning, waiting for gregor to come up (attempt %d)", i)
		}
	}
	if !ok {
		t.Fatal("Gregor never came up after we signed up")
	}

	svc.SetGregorPushStateFilter(func(m gregor.Message) bool {
		cat := m.ToInBandMessage().ToStateUpdateMessage().Creation().Category()
		return cat.String() != "user.identity_change" && cat.String() != "user.key_change"
	})
	err = ncli.RegisterGregorFirehose(context.TODO())
	check()

	select {
	case a := <-em.stateCh:
		if a.Reason != keybase1.PushReason_RECONNECTED {
			t.Fatal(fmt.Sprintf("got wrong reason: %v", a.Reason))
		}
		if d := len(filterPubsubdItems(a.State.Items_)); d != 0 {
			t.Fatal(fmt.Sprintf("Wrong number of items in state -- should have 0, but got %d", d))
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("never got a reconnect message")
	}

	msgID, err := svc.GregorInject("foo", []byte("bar"))
	check()
	err = svc.GregorInjectOutOfBandMessage("baz", []byte("bip"))
	check()

	checkState := func(s gregor1.State) {
		items := filterPubsubdItems(s.Items_)
		if n := len(items); n != 1 {
			t.Errorf("Expected one item back; got %d", n)
			return
		}
		i := items[0]
		if !bytes.Equal(i.Md_.MsgID_.Bytes(), msgID.Bytes()) {
			t.Error("Wrong gregor message ID received")
		}
		if i.Item_.Category_.String() != "foo" {
			t.Error("Wrong gregor category")
		}
		if string(i.Item_.Body_.Bytes()) != "bar" {
			t.Error("Wrong gregor body")
		}
	}

	select {
	case pushArg := <-em.stateCh:
		checkState(pushArg.State)
		if pushArg.Reason != keybase1.PushReason_NEW_DATA {
			t.Errorf("wrong reason for push: %v", pushArg.Reason)
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("never got an IBM")
	}

	select {
	case oobm := <-em.oobmCh:
		if oobm.System_ != "baz" {
			t.Fatalf("Got wrong OOBM system: %s", oobm.System_)
		}
		if s := string(oobm.Body_); s != "bip" {
			t.Fatalf("Got wrong OOBM body: %s", s)
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("never got an OOBM")
	}

	svc.SimulateGregorCrashForTesting()
	select {
	case pushArg := <-em.stateCh:
		checkState(pushArg.State)
		if pushArg.Reason != keybase1.PushReason_RECONNECTED {
			t.Errorf("wrong reason for push: %v", pushArg.Reason)
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("never got an IBM")
	}

	gcli := keybase1.GregorClient{Cli: cli}
	state, err := gcli.GetState(context.TODO())
	check()
	checkState(state)

	if err := client.CtlServiceStop(tc.G); err != nil {
		t.Fatal(err)
	}
	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}

}
