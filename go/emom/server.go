package emom

import (
	emom1 "github.com/keybase/client/go/protocol/emom1"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	strings "strings"
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

func procSplit(s string) (prot string, proc string, err error) {
	parts := strings.Split(s, ".")
	if len(parts) < 2 {
		return "", "", newServerError("cannot split RPC: %s", s)
	}
	end := len(parts) - 1
	return strings.Join(parts[0:end], "."), parts[end], nil
}

func (s *Server) dispatch(ctx context.Context, arg emom1.RequestPlaintext) (res emom1.ResponsePlaintext, err error) {
	protName, procName, err := procSplit(arg.N)
	if err != nil {
		return res, err
	}

	prot, found := s.protocols[protName]
	if !found {
		return res, newServerError("protocol not found: %s", protName)
	}

	proc, found := prot.Methods[procName]
	if !found {
		return res, newServerError("method %s not found in protocol %s", procName, protName)
	}

	procArg := proc.MakeArg()
	err = decodeFromBytes(procArg, arg.A)
	if err != nil {
		return res, err
	}

	procRes, procErr := proc.Handler(ctx, procArg)
	var wrappedError interface{}
	if procErr != nil {
		if s.wrapError != nil {
			wrappedError = s.wrapError(procErr)
		} else {
			wrappedError = procErr.Error()
		}
	}

	if arg.S != nil {
		res.S = *arg.S
	}

	res.R, err = encodeToBytes(procRes)
	if err != nil {
		return emom1.ResponsePlaintext{}, err
	}
	res.E, err = encodeToBytes(wrappedError)
	if err != nil {
		return emom1.ResponsePlaintext{}, err
	}

	return res, nil
}

func (s *Server) checkSeqno(inner *emom1.Seqno, outer emom1.Seqno) error {
	if inner == nil {
		return newClientSequenceError("no inner client sequence number found")
	}
	if *inner != outer {
		return newClientSequenceError("wrong client sequence: %d != %d", *inner, outer)
	}
	return nil
}

func (s *Server) nextSeqno() emom1.Seqno {
	s.seqnoMu.Lock()
	defer s.seqnoMu.Unlock()
	ret := s.seqno
	s.seqno++
	return ret
}

func (s *Server) C(ctx context.Context, arg emom1.Arg) (res emom1.Res, err error) {
	var encodedRequestPlaintext []byte
	var requestPlaintext emom1.RequestPlaintext
	var responsePlaintext emom1.ResponsePlaintext
	var encodedResponsePlaintext []byte

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

	encodedRequestPlaintext, err = decrypt(ctx, emom1.MsgType_CALL, arg.A, s.cryptoer.SessionKey())
	if err != nil {
		return res, err
	}

	err = decodeFromBytes(&requestPlaintext, encodedRequestPlaintext)
	if err != nil {
		return res, err
	}

	err = s.cryptoer.InitUserAuth(ctx, requestPlaintext)
	if err != nil {
		return res, err
	}

	err = s.checkSeqno(requestPlaintext.S, arg.A.N)
	if err != nil {
		return res, err
	}

	responsePlaintext, err = s.dispatch(ctx, requestPlaintext)
	if err != nil {
		return res, err
	}

	encodedResponsePlaintext, err = encodeToBytes(responsePlaintext)
	if err != nil {
		return res, err
	}

	res.A.N = s.nextSeqno()

	res.A, err = encrypt(ctx, encodedResponsePlaintext, emom1.MsgType_REPLY, res.A.N, s.cryptoer.SessionKey())
	if err != nil {
		return res, err
	}

	return res, nil
}

func (s *Server) N(context.Context, emom1.Arg) error {
	return nil
}

var _ emom1.AeInterface = (*Server)(nil)
