package emom

import (
	emom1 "github.com/keybase/client/go/protocol/emom1"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	sync "sync"
	time "time"
)

type Server struct {
	protocols map[string]rpc.Protocol
	cryptoer  Cryptoer
	xp        rpc.Transporter
	wrapError rpc.WrapErrorFunc

	clientSequencer Sequencer

	// protected by seqnoMu
	seqnoMu sync.Mutex
	seqno   emom1.Seqno
}

func (s *Server) Register(p rpc.Protocol) error {
	if _, found := s.protocols[p.Name]; found {
		return rpc.NewAlreadyRegisteredError(p.Name)
	}
	s.protocols[p.Name] = p
	return nil
}

func (s *Server) C(ctx context.Context, arg emom1.Arg) (res emom1.Res, err error) {

	// It would be ideal if we could ensure that we're seeing requests
	// as the same order as they come across the wire. But this is hard
	// to enforce without a lot of disruption in the RPC library.  So we're
	// going to do something else instead: ensure that we're handling the
	// RPCs in the order that the client sent them. This means an attacker
	// who owns the network can drop packet 10 and nothing after it will go through.
	// But a malicious network can also DoS the connection, so this isn't
	// an interesting attack.
	err = s.clientSequencer.Wait(ctx, arg.A.N, time.Minute)
	if err != nil {
		return res, err
	}

	err = s.cryptoer.InitServerHandshake(ctx, arg)
	if err != nil {
		return res, err
	}

	return res, nil
}

func (s *Server) N(context.Context, emom1.Arg) error {
	return nil
}

var _ emom1.AeInterface = (*Server)(nil)
