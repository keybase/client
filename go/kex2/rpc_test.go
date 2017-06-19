// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kex2

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

const (
	GoodProvisionee                  = 0
	BadProvisioneeFailHello          = 1 << iota
	BadProvisioneeFailDidCounterSign = 1 << iota
	BadProvisioneeSlowHello          = 1 << iota
	BadProvisioneeSlowDidCounterSign = 1 << iota
	BadProvisioneeCancel             = 1 << iota
)

type mockProvisioner struct {
	uid keybase1.UID
}

type mockProvisionee struct {
	behavior int
}

func newMockProvisioner(t *testing.T) *mockProvisioner {
	return &mockProvisioner{
		uid: genUID(t),
	}
}

type nullLogOutput struct {
}

func (n *nullLogOutput) Error(s string, args ...interface{})   {}
func (n *nullLogOutput) Warning(s string, args ...interface{}) {}
func (n *nullLogOutput) Info(s string, args ...interface{})    {}
func (n *nullLogOutput) Debug(s string, args ...interface{})   {}
func (n *nullLogOutput) Profile(s string, args ...interface{}) {}

var _ rpc.LogOutput = (*nullLogOutput)(nil)

func makeLogFactory() rpc.LogFactory {
	if testing.Verbose() {
		return nil
	}
	return rpc.NewSimpleLogFactory(&nullLogOutput{}, nil)
}

func genUID(t *testing.T) keybase1.UID {
	uid := make([]byte, 8)
	if _, err := rand.Read(uid); err != nil {
		t.Fatalf("rand failed: %v\n", err)
	}
	return keybase1.UID(hex.EncodeToString(uid))
}

func genKeybase1DeviceID(t *testing.T) keybase1.DeviceID {
	did := make([]byte, 16)
	if _, err := rand.Read(did); err != nil {
		t.Fatalf("rand failed: %v\n", err)
	}
	return keybase1.DeviceID(hex.EncodeToString(did))
}

func newMockProvisionee(t *testing.T, behavior int) *mockProvisionee {
	return &mockProvisionee{behavior}
}

func (mp *mockProvisioner) GetLogFactory() rpc.LogFactory {
	return makeLogFactory()
}

func (mp *mockProvisioner) CounterSign(input keybase1.HelloRes) (output []byte, err error) {
	output = []byte(string(input))
	return
}

func (mp *mockProvisioner) CounterSign2(input keybase1.Hello2Res) (output keybase1.DidCounterSign2Arg, err error) {
	output.Sig, err = mp.CounterSign(input.SigPayload)
	return
}

func (mp *mockProvisioner) GetHelloArg() (res keybase1.HelloArg, err error) {
	res.Uid = mp.uid
	return res, err
}
func (mp *mockProvisioner) GetHello2Arg() (res keybase1.Hello2Arg, err error) {
	res.Uid = mp.uid
	return res, err
}

func (mp *mockProvisionee) GetLogFactory() rpc.LogFactory {
	return makeLogFactory()
}

var ErrHandleHello = errors.New("handle hello failure")
var ErrHandleDidCounterSign = errors.New("handle didCounterSign failure")
var testTimeout = time.Duration(500) * time.Millisecond

func (mp *mockProvisionee) HandleHello2(arg2 keybase1.Hello2Arg) (res keybase1.Hello2Res, err error) {
	arg1 := keybase1.HelloArg{
		Uid:     arg2.Uid,
		SigBody: arg2.SigBody,
	}
	res.SigPayload, err = mp.HandleHello(arg1)
	return res, err
}

func (mp *mockProvisionee) HandleHello(arg keybase1.HelloArg) (res keybase1.HelloRes, err error) {
	if (mp.behavior & BadProvisioneeSlowHello) != 0 {
		time.Sleep(testTimeout * 8)
	}
	if (mp.behavior & BadProvisioneeFailHello) != 0 {
		err = ErrHandleHello
		return
	}
	res = keybase1.HelloRes(arg.SigBody)
	return
}

func (mp *mockProvisionee) HandleDidCounterSign([]byte) error {
	if (mp.behavior & BadProvisioneeSlowDidCounterSign) != 0 {
		time.Sleep(testTimeout * 8)
	}
	if (mp.behavior & BadProvisioneeFailDidCounterSign) != 0 {
		return ErrHandleDidCounterSign
	}
	return nil
}

func (mp *mockProvisionee) HandleDidCounterSign2(arg keybase1.DidCounterSign2Arg) error {
	return mp.HandleDidCounterSign(arg.Sig)
}

func testProtocolXWithBehavior(t *testing.T, provisioneeBehavior int) (results [2]error) {

	timeout := testTimeout
	router := newMockRouterWithBehaviorAndMaxPoll(GoodRouter, timeout)

	s2 := genSecret(t)

	ch := make(chan error, 3)

	secretCh := make(chan Secret)

	ctx, cancelFn := context.WithCancel(context.Background())

	// Run the provisioner
	go func() {
		err := RunProvisioner(ProvisionerArg{
			KexBaseArg: KexBaseArg{
				Ctx:           ctx,
				Mr:            router,
				Secret:        genSecret(t),
				DeviceID:      genKeybase1DeviceID(t),
				SecretChannel: secretCh,
				Timeout:       timeout,
			},
			Provisioner: newMockProvisioner(t),
		})
		ch <- err
	}()

	// Run the privisionee
	go func() {
		err := RunProvisionee(ProvisioneeArg{
			KexBaseArg: KexBaseArg{
				Ctx:           context.Background(),
				Mr:            router,
				Secret:        s2,
				DeviceID:      genKeybase1DeviceID(t),
				SecretChannel: make(chan Secret),
				Timeout:       timeout,
			},
			Provisionee: newMockProvisionee(t, provisioneeBehavior),
		})
		ch <- err
	}()

	if (provisioneeBehavior & BadProvisioneeCancel) != 0 {
		go func() {
			time.Sleep(testTimeout / 20)
			cancelFn()
		}()
	}

	secretCh <- s2

	for i := 0; i < 2; i++ {
		if e, eof := <-ch; !eof {
			t.Fatalf("got unexpected channel close (try %d)", i)
		} else if e != nil {
			results[i] = e
		}
	}

	return results
}

func TestFullProtocolXSuccess(t *testing.T) {
	results := testProtocolXWithBehavior(t, GoodProvisionee)
	for i, e := range results {
		if e != nil {
			t.Fatalf("Bad error %d: %v", i, e)
		}
	}
}

// Since errors are exported as strings, then we should just test that the
// right kind of error was specified
func eeq(e1, e2 error) bool {
	return e1 != nil && e1.Error() == e2.Error()
}

func TestFullProtocolXProvisioneeFailHello(t *testing.T) {
	results := testProtocolXWithBehavior(t, BadProvisioneeFailHello)
	if !eeq(results[0], ErrHandleHello) {
		t.Fatalf("Bad error 0: %v", results[0])
	}
	if !eeq(results[1], ErrHandleHello) {
		t.Fatalf("Bad error 1: %v", results[1])
	}
}

func TestFullProtocolXProvisioneeFailDidCounterSign(t *testing.T) {
	results := testProtocolXWithBehavior(t, BadProvisioneeFailDidCounterSign)
	if !eeq(results[0], ErrHandleDidCounterSign) {
		t.Fatalf("Bad error 0: %v", results[0])
	}
	if !eeq(results[1], ErrHandleDidCounterSign) {
		t.Fatalf("Bad error 1: %v", results[1])
	}
}

func TestFullProtocolXProvisioneeSlowHello(t *testing.T) {
	results := testProtocolXWithBehavior(t, BadProvisioneeSlowHello)
	for i, e := range results {
		if !eeq(e, ErrTimedOut) && !eeq(e, io.EOF) && !eeq(e, ErrHelloTimeout) {
			t.Fatalf("Bad error %d: %v", i, e)
		}
	}
}

func TestFullProtocolXProvisioneeSlowHelloWithCancel(t *testing.T) {
	results := testProtocolXWithBehavior(t, BadProvisioneeSlowHello|BadProvisioneeCancel)
	for i, e := range results {
		if !eeq(e, ErrCanceled) && !eeq(e, io.EOF) {
			t.Fatalf("Bad error %d: %v", i, e)
		}
	}
}

func TestFullProtocolXProvisioneeSlowDidCounterSign(t *testing.T) {
	results := testProtocolXWithBehavior(t, BadProvisioneeSlowDidCounterSign)
	for i, e := range results {
		if !eeq(e, ErrTimedOut) && !eeq(e, io.EOF) {
			t.Fatalf("Bad error %d: %v", i, e)
		}
	}
}

func TestFullProtocolY(t *testing.T) {

	timeout := time.Duration(60) * time.Second
	router := newMockRouterWithBehaviorAndMaxPoll(GoodRouter, timeout)

	s1 := genSecret(t)

	ch := make(chan error, 3)

	secretCh := make(chan Secret)

	// Run the provisioner
	go func() {
		err := RunProvisioner(ProvisionerArg{
			KexBaseArg: KexBaseArg{
				Ctx:           context.TODO(),
				Mr:            router,
				Secret:        s1,
				DeviceID:      genKeybase1DeviceID(t),
				SecretChannel: make(chan Secret),
				Timeout:       timeout,
			},
			Provisioner: newMockProvisioner(t),
		})
		ch <- err
	}()

	// Run the provisionee
	go func() {
		err := RunProvisionee(ProvisioneeArg{
			KexBaseArg: KexBaseArg{
				Ctx:           context.TODO(),
				Mr:            router,
				Secret:        genSecret(t),
				DeviceID:      genKeybase1DeviceID(t),
				SecretChannel: secretCh,
				Timeout:       timeout,
			},
			Provisionee: newMockProvisionee(t, GoodProvisionee),
		})
		ch <- err
	}()

	secretCh <- s1

	for i := 0; i < 2; i++ {
		if e, eof := <-ch; !eof {
			t.Fatalf("got unexpected channel close (try %d)", i)
		} else if e != nil {
			t.Fatalf("Unexpected error (receive %d): %v", i, e)
		}
	}

}
