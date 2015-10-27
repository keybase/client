package kex2

import (
	"net"
	"time"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type provisioner struct {
	baseDevice
	arg ProvisionerArg
}

// Provisioner is an interface that abstracts out the crypto and session
// management that a provisioner needs to do as part of the protocol.
type Provisioner interface {
	GetHelloArg() (keybase1.HelloArg, error)
	CounterSign(keybase1.HelloRes) ([]byte, error)
	GetLogFactory() rpc.LogFactory
}

// ProvisionerArg provides the details that a provisioner needs in order
// to run its course
type ProvisionerArg struct {
	KexBaseArg
	Provisioner Provisioner
}

func newProvisioner(arg ProvisionerArg) *provisioner {
	ret := &provisioner{
		baseDevice: baseDevice{
			start: make(chan struct{}),
		},
		arg: arg,
	}
	return ret
}

// RunProvisioner runs a provisioner given the necessary arguments.
func RunProvisioner(arg ProvisionerArg) error {
	p := newProvisioner(arg)
	err := p.run()
	p.close() // ignore any errors in closing the channel
	return err
}

func (p *provisioner) close() (err error) {
	if p.conn != nil {
		err = p.conn.Close()
	}
	return err
}

func (p *provisioner) KexStart(_ context.Context) error {
	close(p.start)
	return nil
}

func (p *provisioner) run() (err error) {
	if err = p.setDeviceID(); err != nil {
		return err
	}
	if err = p.pickFirstConnection(); err != nil {
		return err
	}
	if err = p.runProtocolWithCancel(); err != nil {
		return err
	}
	return nil
}

func (k KexBaseArg) getDeviceID() (ret DeviceID, err error) {
	err = k.DeviceID.ToBytes([]byte(ret[:]))
	return ret, err
}

func (p *provisioner) setDeviceID() (err error) {
	p.deviceID, err = p.arg.getDeviceID()
	return err
}

func (p *provisioner) pickFirstConnection() (err error) {

	// This connection is auto-closed at the end of this function, so if
	// you don't want it to close, then set it to nil.  See the first
	// case in the select below.
	var conn net.Conn
	var xp rpc.Transporter

	defer func() {
		if conn != nil {
			conn.Close()
		}
	}()

	// Only make a channel if we were provided a secret to start it with.
	// If not, we'll just have to wait for a message on p.arg.SecretChannel
	// and use the provisionee's channel.
	if len(p.arg.Secret) != 0 {
		if conn, err = NewConn(p.arg.Mr, p.arg.Secret, p.deviceID, p.arg.Timeout); err != nil {
			return err
		}
		prot := keybase1.Kex2ProvisionerProtocol(p)
		xp = rpc.NewTransport(conn, p.arg.Provisioner.GetLogFactory(), nil)
		srv := rpc.NewServer(xp, nil)
		if err = srv.Register(prot); err != nil {
			return err
		}
		if err = srv.Run(true); err != nil {
			return err
		}
	}

	select {
	case <-p.start:
		p.conn = conn
		conn = nil // so it's not closed in the defer()'ed close
		p.xp = xp
	case sec := <-p.arg.SecretChannel:
		if len(sec) != SecretLen {
			return ErrBadSecret
		}
		if p.conn, err = NewConn(p.arg.Mr, sec, p.deviceID, p.arg.Timeout); err != nil {
			return err
		}
		p.xp = rpc.NewTransport(p.conn, p.arg.Provisioner.GetLogFactory(), nil)
	case <-p.arg.Ctx.Done():
		err = ErrCanceled
	case <-time.After(p.arg.Timeout):
		err = ErrTimedOut
	}
	return
}

func (p *provisioner) runProtocolWithCancel() (err error) {
	ch := make(chan error)
	go func() {
		ch <- p.runProtocol()
	}()
	select {
	case <-p.arg.Ctx.Done():
		p.canceled = true
		return ErrCanceled
	case err = <-ch:
		return err
	}
}

func (p *provisioner) runProtocol() (err error) {
	cli := keybase1.Kex2ProvisioneeClient{Cli: rpc.NewClient(p.xp, nil)}
	var helloArg keybase1.HelloArg
	helloArg, err = p.arg.Provisioner.GetHelloArg()
	if err != nil {
		return
	}
	var res keybase1.HelloRes
	if res, err = cli.Hello(context.TODO(), helloArg); err != nil {
		return
	}
	if p.canceled {
		return ErrCanceled
	}
	var counterSigned []byte
	if counterSigned, err = p.arg.Provisioner.CounterSign(res); err != nil {
		return err
	}
	if err = cli.DidCounterSign(context.TODO(), counterSigned); err != nil {
		return err
	}
	return nil
}
