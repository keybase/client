package emom

import (
	emom1 "github.com/keybase/client/go/protocol/emom1"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	sync "sync"
)

type waitArg struct {
	seqno  emom1.Seqno
	doneCh chan<- error
}

type Server struct {
	protocols map[string]rpc.Protocol
	cryptoer  Cryptoer
	xp        rpc.Transporter
	wrapError rpc.WrapErrorFunc

	waitCh      chan waitArg
	clientSeqno emom1.Seqno

	// protected by seqnoMu
	seqnoMu sync.Mutex
	seqno   emom1.Seqno
}

func (s *Server) sequencerLoop() {
}

func (s *Server) Register(p rpc.Protocol) error {
	if _, found := s.protocols[p.Name]; found {
		return rpc.NewAlreadyRegisteredError(p.Name)
	}
	s.protocols[p.Name] = p
	return nil
}

func (s *Server) waitForTurn(ctx context.Context, arg emom1.Arg) (err error) {
	doneCh := make(chan error)
	s.waitCh <- waitArg{arg.A.N, doneCh}
	return <-doneCh
}

func (s *Server) C(ctx context.Context, arg emom1.Arg) (res emom1.Res, err error) {

	err = s.waitForTurn(ctx, arg)
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
