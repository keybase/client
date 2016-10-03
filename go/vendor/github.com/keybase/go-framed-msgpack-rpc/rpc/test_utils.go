package rpc

import (
	"errors"
	"fmt"
	"io"
	"net"
	"time"

	"golang.org/x/net/context"
)

type server struct {
	port int
}

func (s *server) Run(ready chan struct{}, externalListener chan error) (err error) {
	var listener net.Listener
	o := SimpleLogOutput{}
	lf := NewSimpleLogFactory(o, nil)
	o.Info(fmt.Sprintf("Listening on port %d...", s.port))
	if listener, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", s.port)); err != nil {
		return
	}
	close(ready)
	for {
		var c net.Conn
		if c, err = listener.Accept(); err != nil {
			externalListener <- io.EOF
			return
		}
		xp := NewTransport(c, lf, nil)
		srv := NewServer(xp, nil)
		srv.Register(createTestProtocol(newTestProtocol(c)))
		done := srv.Run()
		go func() {
			<-done
			listener.Close()
		}()
	}
	return nil
}

type testProtocol struct {
	c              net.Conn
	constants      Constants
	longCallResult int
	debugTags      CtxRpcTags
	notifyCh       chan struct{}
}

func newTestProtocol(c net.Conn) *testProtocol {
	return &testProtocol{
		c:              c,
		constants:      Constants{},
		longCallResult: 0,
		notifyCh:       make(chan struct{}, 1),
	}
}

func (a *testProtocol) Add(args *AddArgs) (ret int, err error) {
	ret = args.A + args.B
	return
}

func (a *testProtocol) UpdateConstants(args *Constants) error {
	a.constants = *args
	close(a.notifyCh)
	return nil
}

func (a *testProtocol) GetConstants() (*Constants, error) {
	<-a.notifyCh
	return &a.constants, nil
}

func (a *testProtocol) LongCall(ctx context.Context) (int, error) {
	defer func() {
		close(a.notifyCh)
	}()
	tags, _ := RpcTagsFromContext(ctx)
	a.debugTags = tags
	a.longCallResult = 0
	for i := 0; i < 100; i++ {
		select {
		case <-time.After(time.Millisecond):
			a.longCallResult++
		case <-ctx.Done():
			a.longCallResult = -1
			// There is no way to get this value out right now
			return a.longCallResult, errors.New("terminated")
		}
	}
	return a.longCallResult, nil
}

func (a *testProtocol) LongCallResult(ctx context.Context) (int, error) {
	<-a.notifyCh
	return a.longCallResult, nil
}

func (a *testProtocol) LongCallDebugTags(ctx context.Context) (CtxRpcTags, error) {
	return a.debugTags, nil
}

//---------------------------------------------------------------
// begin autogen code

type AddArgs struct {
	A int
	B int
}

type Constants struct {
	Pi int
}

type TestInterface interface {
	Add(*AddArgs) (int, error)
	UpdateConstants(*Constants) error
	GetConstants() (*Constants, error)
	LongCall(context.Context) (int, error)
	LongCallResult(context.Context) (int, error)
	LongCallDebugTags(context.Context) (CtxRpcTags, error)
}

func createTestProtocol(i TestInterface) Protocol {
	return Protocol{
		Name: "test.1.testp",
		Methods: map[string]ServeHandlerDescription{
			"add": {
				MakeArg: func() interface{} {
					return new(AddArgs)
				},
				Handler: func(_ context.Context, args interface{}) (interface{}, error) {
					addArgs, ok := args.(*AddArgs)
					if !ok {
						return nil, NewTypeError((*AddArgs)(nil), args)
					}
					return i.Add(addArgs)
				},
				MethodType: MethodCall,
			},
			"GetConstants": {
				MakeArg: func() interface{} {
					return new(interface{})
				},
				Handler: func(_ context.Context, _ interface{}) (interface{}, error) {
					return i.GetConstants()
				},
				MethodType: MethodCall,
			},
			"updateConstants": {
				MakeArg: func() interface{} {
					return new(Constants)
				},
				Handler: func(_ context.Context, args interface{}) (interface{}, error) {
					constants, ok := args.(*Constants)
					if !ok {
						return nil, NewTypeError((*Constants)(nil), args)
					}
					err := i.UpdateConstants(constants)
					return nil, err
				},
				MethodType: MethodNotify,
			},
			"LongCall": {
				MakeArg: func() interface{} {
					return new(interface{})
				},
				Handler: func(ctx context.Context, _ interface{}) (interface{}, error) {
					return i.LongCall(ctx)
				},
				MethodType: MethodCall,
			},
			"LongCallResult": {
				MakeArg: func() interface{} {
					return new(interface{})
				},
				Handler: func(ctx context.Context, _ interface{}) (interface{}, error) {
					return i.LongCallResult(ctx)
				},
				MethodType: MethodCall,
			},
			"LongCallDebugTags": {
				MakeArg: func() interface{} {
					return new(interface{})
				},
				Handler: func(ctx context.Context, _ interface{}) (interface{}, error) {
					return i.LongCallDebugTags(ctx)
				},
				MethodType: MethodCall,
			},
		},
	}
}

// end autogen code
//---------------------------------------------------------------

//---------------------------------------------------------------------
// Client

type TestClient struct {
	GenericClient
}

func (a TestClient) Add(ctx context.Context, arg AddArgs) (ret int, err error) {
	err = a.Call(ctx, "test.1.testp.add", arg, &ret)
	return
}

func (a TestClient) BrokenMethod() (err error) {
	err = a.Call(context.Background(), "test.1.testp.broken", nil, nil)
	return
}

func (a TestClient) BrokenProtocol() (err error) {
	err = a.Call(context.Background(), "test.2.testp.broken", nil, nil)
	return
}

func (a TestClient) UpdateConstants(ctx context.Context, arg Constants) (err error) {
	err = a.Notify(ctx, "test.1.testp.updateConstants", arg)
	return
}

func (a TestClient) GetConstants(ctx context.Context) (ret Constants, err error) {
	err = a.Call(ctx, "test.1.testp.GetConstants", nil, &ret)
	return
}

func (a TestClient) LongCall(ctx context.Context) (ret int, err error) {
	err = a.Call(ctx, "test.1.testp.LongCall", nil, &ret)
	return
}

func (a TestClient) LongCallResult(ctx context.Context) (ret int, err error) {
	err = a.Call(ctx, "test.1.testp.LongCallResult", nil, &ret)
	return
}

func (a TestClient) LongCallDebugTags(ctx context.Context) (ret CtxRpcTags, err error) {
	err = a.Call(ctx, "test.1.testp.LongCallDebugTags", nil, &ret)
	return
}
