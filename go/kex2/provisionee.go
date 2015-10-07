package kex2

import (
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"time"
)

type provisionee struct {
	baseDevice
	arg  ProvisioneeArg
	done chan error
}

// Provisionee is an interface that abstracts out the crypto and session
// management that a provisionee needs to do as part of the protocol.
type Provisionee interface {
	GetLogFactory() rpc2.LogFactory
	HandleHello(keybase1.HelloArg) (keybase1.HelloRes, error)
	HandleDidCounterSign([]byte) error
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
		arg:  arg,
		done: make(chan error),
	}
	return ret
}

// RunProvisionee runs a provisioner given the necessary arguments.
func RunProvisionee(arg ProvisioneeArg) error {
	p := newProvisionee(arg)
	return p.run()
}

// Hello is called via the RPC server interface by the remote client.
// It in turn delegates the work to the passed in Provisionee interface,
// calling HandleHello()
func (p *provisionee) Hello(arg keybase1.HelloArg) (res keybase1.HelloRes, err error) {
	close(p.start)
	res, err = p.arg.Provisionee.HandleHello(arg)
	if err != nil {
		p.done <- err
	}
	return res, err
}

// DidCounterSign is called via the RPC server interface by the remote client.
// It in turn delegates the work to the passed in Provisionee interface,
// calling HandleDidCounterSign()
func (p *provisionee) DidCounterSign(sig []byte) (err error) {
	err = p.arg.Provisionee.HandleDidCounterSign(sig)
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

	err = <-p.done

	return err
}

func (p *provisionee) eofHook(e error) {
	p.done <- e
	return
}

func (p *provisionee) startServer(s Secret) (err error) {
	if p.conn, err = NewConn(p.arg.Mr, s, p.deviceID, p.arg.Timeout); err != nil {
		return err
	}
	prot := keybase1.Kex2ProvisioneeProtocol(p)
	p.xp = rpc2.NewTransport(p.conn, p.arg.Provisionee.GetLogFactory(), nil)
	srv := rpc2.NewServer(p.xp, nil)
	if err = srv.Register(prot); err != nil {
		return err
	}
	if err = srv.RegisterEOFHook(func(e error) { p.eofHook(e) }); err != nil {
		return err
	}
	return srv.Run(true)
}

func (p *provisionee) pickFirstConnection() (err error) {
	select {
	case <-p.start:
	case sec := <-p.arg.SecretChannel:
		p.conn.Close()
		err = p.startServer(sec)
		if err != nil {
			return err
		}
		cli := keybase1.Kex2ProvisionerClient{Cli: rpc2.NewClient(p.xp, nil)}
		if err = cli.KexStart(); err != nil {
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
