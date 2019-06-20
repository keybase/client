// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"bytes"
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
	"github.com/stretchr/testify/require"
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
		categoryStr := i.Category().String()
		if !strings.HasPrefix(categoryStr, "user.") &&
			!strings.HasPrefix(categoryStr, "stellar.") &&
			!strings.HasPrefix(categoryStr, "device.") &&
			!strings.HasPrefix(categoryStr, "home.") {
			res = append(res, i)
		}
	}
	return
}

func TestGregorForwardToElectron(t *testing.T) {
	tc := setupTest(t, "gregor")
	defer tc.Cleanup()
	tc1 := cloneContext(tc)
	defer tc1.Cleanup()

	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	stopCh := make(chan error)
	go func() {
		tc.G.Log.Debug("+ Service.Run")
		err := svc.Run()
		tc.G.Log.Debug("- Service.Run")
		require.NoError(t, err)
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
	require.NoError(t, signup.Run())

	cli, xp, err := client.GetRPCClientWithContext(tc1.G)
	require.NoError(t, err)
	srv := rpc.NewServer(xp, nil)
	em := newElectronMock(tc.G)
	err = srv.Register(keybase1.GregorUIProtocol(em))
	require.NoError(t, err)
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
	require.True(t, ok)

	svc.SetGregorPushStateFilter(func(m gregor.Message) bool {
		cat := m.ToInBandMessage().ToStateUpdateMessage().Creation().Category()
		return cat.String() != "user.identity_change" && cat.String() != "user.key_change" &&
			!strings.HasPrefix(cat.String(), "home.") && !strings.HasPrefix(cat.String(), "stellar.")
	})
	require.NoError(t, ncli.RegisterGregorFirehose(context.TODO()))

	select {
	case a := <-em.stateCh:
		require.Equal(t, keybase1.PushReason_RECONNECTED, a.Reason)
		require.Zero(t, filterPubsubdItems(a.State.Items_))
	case <-time.After(3 * time.Second):
		require.Fail(t, "no reconnect message")
	}

	msgID, err := svc.GregorInject("foo", []byte("bar"))
	require.NoError(t, err)
	require.NoError(t, svc.GregorInjectOutOfBandMessage("baz", []byte("bip")))

	checkState := func(s gregor1.State) {
		items := filterPubsubdItems(s.Items_)
		require.Equal(t, 1, len(items))
		i := items[0]
		require.True(t, bytes.Equal(i.Md_.MsgID_.Bytes(), msgID.Bytes()))
		require.Equal(t, "foo", i.Item_.Category_.String())
		require.Equal(t, "bar", string(i.Item_.Body_.Bytes()))
	}

	// We get two push states, one from the local send, and one from receiving broadcast
	for i := 0; i < 2; i++ {
		select {
		case pushArg := <-em.stateCh:
			checkState(pushArg.State)
			require.Equal(t, keybase1.PushReason_NEW_DATA, pushArg.Reason)
		case <-time.After(10 * time.Second):
			require.Fail(t, "no ibm")
		}
	}

	pollForTrue(t, tc.G, func(i int) bool {
		select {
		case oobm := <-em.oobmCh:
			if oobm.System_ != "baz" {
				return false
			}
			if s := string(oobm.Body_); s != "bip" {
				return false
			}
			return true
		case <-time.After(3 * time.Second * libkb.CITimeMultiplier(tc.G)):
			return false
		}
	})

	svc.SimulateGregorCrashForTesting()
	select {
	case pushArg := <-em.stateCh:
		checkState(pushArg.State)
		require.Equal(t, keybase1.PushReason_RECONNECTED, pushArg.Reason)
	case <-time.After(10 * time.Second):
		require.Fail(t, "no ibm")
	}

	gcli := keybase1.GregorClient{Cli: cli}
	state, err := gcli.GetState(context.TODO())
	require.NoError(t, err)
	checkState(state)

	require.NoError(t, CtlStop(tc.G))
	// If the server failed, it's also an error
	require.NoError(t, <-stopCh)
}
