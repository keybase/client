package main

import (
	"errors"
	"fmt"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"net"
)

type Server struct {
}

type ArithServer struct {
	c net.Conn
}

func (a *ArithServer) Add(args *AddArgs) (ret int, err error) {
	ret = args.A + args.B
	return
}

func (a *ArithServer) DivMod(args *DivModArgs) (ret *DivModRes, err error) {
	ret = &DivModRes{}
	if args.B == 0 {
		err = errors.New("Cannot divide by 0")
	} else {
		ret.Q = args.A / args.B
		ret.R = args.A % args.B
	}
	return
}

//---------------------------------------------------------------
// begin autogen code

type AddArgs struct {
	A int
	B int
}

type DivModArgs struct {
	A int
	B int
}

type DivModRes struct {
	Q int
	R int
}

type ArithInferface interface {
	Add(*AddArgs) (int, error)
	DivMod(*DivModArgs) (*DivModRes, error)
}

func ArithProtocol(i ArithInferface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "test.1.arith",
		Methods: map[string]rpc2.ServeHook{
			"add": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args AddArgs
				if err = nxt(&args); err == nil {
					ret, err = i.Add(&args)
				}
				return
			},
			"divMod": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args DivModArgs
				if err = nxt(&args); err == nil {
					ret, err = i.DivMod(&args)
				}
				return
			},
		},
	}
}

// end autogen code
//---------------------------------------------------------------

func (s *Server) Run() (err error) {
	var listener net.Listener
	o := rpc2.SimpleLogOutput{}
	lf := rpc2.NewSimpleLogFactory(o, nil)
	o.Info(fmt.Sprintf("Listening on port %d...", port))
	if listener, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port)); err != nil {
		return
	}
	for {
		var c net.Conn
		if c, err = listener.Accept(); err != nil {
			return
		}
		xp := rpc2.NewTransport(c, lf)
		srv := rpc2.NewServer(xp, nil)
		srv.Register(ArithProtocol(&ArithServer{c}))
		srv.Run(true)
	}
	return nil
}
