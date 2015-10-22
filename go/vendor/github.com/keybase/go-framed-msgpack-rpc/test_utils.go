package rpc

import (
	"errors"
	"fmt"
	"io"
	"net"
	"reflect"
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
	closeListener := make(chan error)
	go func() {
		<-closeListener
		listener.Close()
	}()
	close(ready)
	for {
		var c net.Conn
		if c, err = listener.Accept(); err != nil {
			externalListener <- io.EOF
			return
		}
		xp := NewTransport(c, lf, nil)
		srv := NewServer(xp, nil)
		srv.Register(newTestProtocol(&testProtocol{c, Constants{}, 0}))
		srv.AddCloseListener(closeListener)
		srv.Run(true)
	}
	return nil
}

type testProtocol struct {
	c              net.Conn
	constants      Constants
	longCallResult int
}

func (a *testProtocol) Add(args *AddArgs) (ret int, err error) {
	ret = args.A + args.B
	return
}

func (a *testProtocol) DivMod(args *DivModArgs) (ret *DivModRes, err error) {
	ret = &DivModRes{}
	if args.B == 0 {
		err = errors.New("Cannot divide by 0")
	} else {
		ret.Q = args.A / args.B
		ret.R = args.A % args.B
	}
	return
}

func (a *testProtocol) UpdateConstants(args *Constants) error {
	a.constants = *args
	return nil
}

func (a *testProtocol) GetConstants() (*Constants, error) {
	return &a.constants, nil
}

func (a *testProtocol) LongCall(ctx context.Context) (int, error) {
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
	return a.longCallResult, nil
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

type Constants struct {
	Pi int
}

type TestInterface interface {
	Add(*AddArgs) (int, error)
	DivMod(*DivModArgs) (*DivModRes, error)
	UpdateConstants(*Constants) error
	GetConstants() (*Constants, error)
	LongCall(context.Context) (int, error)
	LongCallResult(context.Context) (int, error)
}

func newTestProtocol(i TestInterface) Protocol {
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
			"divMod": {
				MakeArg: func() interface{} {
					return new(DivModArgs)
				},
				Handler: func(_ context.Context, args interface{}) (interface{}, error) {
					divModArgs, ok := args.(*DivModArgs)
					if !ok {
						return nil, NewTypeError((*DivModArgs)(nil), args)
					}
					return i.DivMod(divModArgs)
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
		},
	}
}

// end autogen code
//---------------------------------------------------------------

//---------------------------------------------------------------------
// Client

type GenericClient interface {
	Call(ctx context.Context, method string, arg interface{}, res interface{}) error
	Notify(ctx context.Context, method string, arg interface{}) error
}

type TestClient struct {
	GenericClient
}

func (a TestClient) Add(ctx context.Context, arg AddArgs) (ret int, err error) {
	err = a.Call(ctx, "test.1.testp.add", arg, &ret)
	return
}

func (a TestClient) Broken() (err error) {
	err = a.Call(nil, "test.1.testp.broken", nil, nil)
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

type mockCodec struct {
	elems chan interface{}
}

func newMockCodec(elems ...interface{}) *mockCodec {
	md := &mockCodec{
		elems: make(chan interface{}, 32),
	}
	for _, i := range elems {
		md.elems <- i
	}
	return md
}

func (md *mockCodec) NumElements() int {
	return len(md.elems)
}

func (md *mockCodec) Decode(i interface{}) error {
	if len(md.elems) == 0 {
		return errors.New("Tried to decode too many elements")
	}
	return md.decode(i)
}

func (md *mockCodec) ReadByte() (b byte, err error) {
	err = md.Decode(&b)
	return b, err
}

func (md *mockCodec) Encode(i interface{}) error {
	v := reflect.ValueOf(i)
	if v.Kind() == reflect.Slice {
		for i := 0; i < v.Len(); i++ {
			e := v.Index(i).Interface()
			md.elems <- e
		}
		return nil
	}
	return errors.New("only support encoding slices")
}

func (md *mockCodec) decode(i interface{}) error {
	v := reflect.ValueOf(i).Elem()
	d := reflect.ValueOf(<-md.elems)
	if !d.Type().AssignableTo(v.Type()) {
		return fmt.Errorf("Tried to decode incorrect type. Expected: %v, actual: %v", v.Type(), d.Type())
	}
	v.Set(d)
	return nil
}

type blockingMockCodec struct {
	mockCodec
}

func newBlockingMockCodec(elems ...interface{}) *blockingMockCodec {
	md := newMockCodec(elems...)
	return &blockingMockCodec{
		mockCodec: *md,
	}
}

func (md *blockingMockCodec) Decode(i interface{}) error {
	return md.decode(i)
}

type mockErrorUnwrapper struct{}

func (eu *mockErrorUnwrapper) MakeArg() interface{} {
	return new(int)
}

func (eu *mockErrorUnwrapper) UnwrapError(i interface{}) (appErr error, dispatchErr error) {
	return nil, nil
}
