// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kex2

import (
	"io"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type provisionee struct {
	baseDevice
	arg                ProvisioneeArg
	done               chan error
	startedCounterSign chan struct{}

	server       *rpc.Server
	serverDoneCh <-chan struct{}
}

// Provisionee is an interface that abstracts out the crypto and session
// management that a provisionee needs to do as part of the protocol.
type Provisionee interface {
	GetLogFactory() rpc.LogFactory
	HandleHello(ctx context.Context, a keybase1.HelloArg) (keybase1.HelloRes, error)
	HandleHello2(ctx context.Context, a keybase1.Hello2Arg) (keybase1.Hello2Res, error)
	HandleDidCounterSign(ctx context.Context, b []byte) error
	HandleDidCounterSign2(ctx context.Context, a keybase1.DidCounterSign2Arg) error
}

// ProvisioneeArg provides the details that a provisionee needs in order
// to run its course
type ProvisioneeArg struct {
	KexBaseArg
	Provisionee Provisionee
}

func newProvisionee(arg ProvisioneeArg) *provisionee {
	ret := &provisionee{
		baseDevice: baseDevice{
			start: make(chan struct{}),
		},
		arg:                arg,
		done:               make(chan error),
		startedCounterSign: make(chan struct{}),
	}
	return ret
}

// RunProvisionee runs a provisionee given the necessary arguments.
func RunProvisionee(arg ProvisioneeArg) error {
	p := newProvisionee(arg)
	return p.run()
}

// Hello is called via the RPC server interface by the remote client.
// It in turn delegates the work to the passed in Provisionee interface,
// calling HandleHello()
func (p *provisionee) Hello(ctx context.Context, arg keybase1.HelloArg) (res keybase1.HelloRes, err error) {
	close(p.start)
	res, err = p.arg.Provisionee.HandleHello(ctx, arg)
	if err != nil {
		p.done <- err
	}
	return res, err
}

// Hello2 is called via the RPC server interface by the remote client.
// It in turn delegates the work to the passed in Provisionee interface,
// calling HandleHello()
func (p *provisionee) Hello2(ctx context.Context, arg keybase1.Hello2Arg) (res keybase1.Hello2Res, err error) {
	close(p.start)
	res, err = p.arg.Provisionee.HandleHello2(ctx, arg)
	if err != nil {
		p.done <- err
	}
	return res, err
}

// DidCounterSign is called via the RPC server interface by the remote client.
// It in turn delegates the work to the passed in Provisionee interface,
// calling HandleDidCounterSign()
func (p *provisionee) DidCounterSign(ctx context.Context, sig []byte) (err error) {
	p.startedCounterSign <- struct{}{}
	err = p.arg.Provisionee.HandleDidCounterSign(ctx, sig)
	p.done <- err
	return err
}

// DidCounterSign2 is called via the RPC server interface by the remote client.
// It in turn delegates the work to the passed in Provisionee interface,
// calling HandleDidCounterSign()
func (p *provisionee) DidCounterSign2(ctx context.Context, arg keybase1.DidCounterSign2Arg) (err error) {
	p.startedCounterSign <- struct{}{}
	err = p.arg.Provisionee.HandleDidCounterSign2(ctx, arg)
	p.done <- err
	return err
}

func (p *provisionee) run() (err error) {

	if err = p.setDeviceID(); err != nil {
		return err
	}

	if err = p.startServer(p.arg.Secret); err != nil {
		return err
	}

	if err = p.pickFirstConnection(); err != nil {
		return err
	}

	// If we hit a done or a server EOF before we started doing the
	// countersign operation, then we have to bail out.
	select {
	case err := <-p.done:
		return err
	case <-p.serverDoneCh:
		return p.server.Err()
	case <-p.startedCounterSign:
	}

	// After we've started the counter sign operation, we don't care if the
	// provisioner explodes. It makes sense to try to finish, however we can.
	// Thus, we wait for EOF from the server in a Go routine.
	go func() {
		<-p.serverDoneCh
		tmp := p.server.Err()
		if tmp != nil && tmp != io.EOF {
			p.debug("provisionee#run: RPC server died with an error: %s", tmp.Error())
		}
	}()

	// Since we've already started the countersign operation, just wait around all
	// day until it's done.
	return <-p.done
}

func (p *provisionee) debug(fmtString string, args ...interface{}) {
	if p.arg.LogCtx != nil {
		p.arg.LogCtx.Debug(fmtString, args...)
	}
}

func (p *provisionee) startServer(s Secret) (err error) {
	if p.conn, err = NewConn(p.arg.Ctx, p.arg.LogCtx, p.arg.Mr, s, p.deviceID, p.arg.Timeout); err != nil {
		return err
	}
	prots := []rpc.Protocol{
		keybase1.Kex2ProvisioneeProtocol(p),
	}
	prots = append(prots, keybase1.Kex2Provisionee2Protocol(p))
	p.xp = rpc.NewTransport(p.conn, p.arg.Provisionee.GetLogFactory(), nil, rpc.DefaultMaxFrameLength)
	srv := rpc.NewServer(p.xp, nil)
	for _, prot := range prots {
		if err = srv.Register(prot); err != nil {
			return err
		}
	}

	p.server = srv
	p.serverDoneCh = srv.Run()
	return nil
}

func (p *provisionee) pickFirstConnection() (err error) {

	select {
	case <-p.start:
	case sec := <-p.arg.SecretChannel:
		if len(sec) != SecretLen {
			return ErrBadSecret
		}
		p.conn.Close()
		err = p.startServer(sec)
		if err != nil {
			return err
		}
		cli := keybase1.Kex2ProvisionerClient{
			Cli: rpc.NewClient(p.xp, nil, nil)}
		if err = cli.KexStart(p.arg.Ctx); err != nil {
			return err
		}
	case <-p.arg.Ctx.Done():
		err = ErrCanceled
	case <-time.After(p.arg.Timeout):
		err = ErrTimedOut
	}
	return
}

func (p *provisionee) setDeviceID() (err error) {
	p.deviceID, err = p.arg.getDeviceID()
	return err
}
