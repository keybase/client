// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"bytes"
	"fmt"
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/service"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	gregor1 "github.com/keybase/gregor/protocol/gregor1"
	context "golang.org/x/net/context"
	"testing"
	"time"
)

type electronMock struct {
	errCh   chan error
	stateCh chan keybase1.PushStateArg
}

func (e *electronMock) PushState(ctx context.Context, a keybase1.PushStateArg) (err error) {
	e.stateCh <- a
	return nil
}

func (e *electronMock) PushOutOfBandMessages(_ context.Context, m []gregor1.OutOfBandMessage) error {
	panic("no expected this just yet!!")
}

func newElectronMock() *electronMock {
	return &electronMock{
		errCh:   make(chan error, 1),
		stateCh: make(chan keybase1.PushStateArg, 10),
	}
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
	stopper := client.NewCmdCtlStopRunner(tc.G)

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
	em := newElectronMock()
	err = srv.Register(keybase1.GregorUIProtocol(em))
	check()
	ncli := keybase1.DelegateUiCtlClient{Cli: cli}
	err = ncli.RegisterGregorFirehose(context.TODO())
	check()

	// Spin until gregor comes up; it should come up after signup
	var ok bool
	for i := 0; !ok && i < 40; i++ {
		if ok = svc.HasGregor(); !ok {
			time.Sleep(50 * time.Millisecond)
		} else {
			tc.G.Log.Debug("spinning, waiting for gregor to come up (attempt %d)", i)
		}
	}
	if !ok {
		t.Fatal("Gregor never came up after we signed up")
	}

	select {
	case a := <-em.stateCh:
		if a.Reason != keybase1.PushReason_RECONNECTED {
			t.Fatal(fmt.Sprintf("got wrong reason: %v", a.Reason))
		}
		if d := len(a.State.Items_); d != 0 {
			t.Fatal(fmt.Sprintf("Wrong number of items in state -- should have 0, but got %d", d))
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("never got a reconnect message")
	}

	msgID, err := svc.GregorInject("foo", []byte("bar"))
	check()
	pushArg := <-em.stateCh

	checkState := func(s gregor1.State) {
		if n := len(s.Items_); n != 1 {
			t.Errorf("Expected one item back; got %d", n)
			return
		}
		i := s.Items_[0]
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
	checkState(pushArg.State)
	if pushArg.Reason != keybase1.PushReason_NEW_DATA {
		t.Errorf("wrong reason for push: %v", pushArg.Reason)
	}
	gcli := keybase1.GregorClient{Cli: cli}
	state, err := gcli.GetState(context.TODO())
	check()
	checkState(state)

	if err := stopper.Run(); err != nil {
		t.Fatal(err)
	}
	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}

}
