// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/test.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

// Result from calling test(..).
type Test struct {
	Reply string `codec:"reply" json:"reply"`
}

func (o Test) DeepCopy() Test {
	return Test{
		Reply: o.Reply,
	}
}

type Generic struct {
	M map[string]Generic `codec:"m" json:"m"`
	A []Generic          `codec:"a" json:"a"`
	S *string            `codec:"s,omitempty" json:"s,omitempty"`
	I *int               `codec:"i,omitempty" json:"i,omitempty"`
}

func (o Generic) DeepCopy() Generic {
	return Generic{
		M: (func(x map[string]Generic) map[string]Generic {
			if x == nil {
				return nil
			}
			ret := make(map[string]Generic, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.M),
		A: (func(x []Generic) []Generic {
			if x == nil {
				return nil
			}
			ret := make([]Generic, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.A),
		S: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.S),
		I: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.I),
	}
}

type TestArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
}

type TestCallbackArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
}

type PanicArg struct {
	Message string `codec:"message" json:"message"`
}

type TestAirdropRegArg struct {
}

type EchoArg struct {
	Arg Generic `codec:"arg" json:"arg"`
}

type TestInterface interface {
	// Call test method.
	// Will trigger the testCallback method, whose result will be set in the
	// returned Test object, reply property.
	Test(context.Context, TestArg) (Test, error)
	// This is a service callback triggered from test(..).
	// The name param is what was passed into test.
	TestCallback(context.Context, TestCallbackArg) (string, error)
	// For testing crashes.
	Panic(context.Context, string) error
	// For testing airdrop reg.
	TestAirdropReg(context.Context) error
	Echo(context.Context, Generic) (Generic, error)
}

func TestProtocol(i TestInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.test",
		Methods: map[string]rpc.ServeHandlerDescription{
			"test": {
				MakeArg: func() interface{} {
					var ret [1]TestArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TestArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TestArg)(nil), args)
						return
					}
					ret, err = i.Test(ctx, typedArgs[0])
					return
				},
			},
			"testCallback": {
				MakeArg: func() interface{} {
					var ret [1]TestCallbackArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TestCallbackArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TestCallbackArg)(nil), args)
						return
					}
					ret, err = i.TestCallback(ctx, typedArgs[0])
					return
				},
			},
			"panic": {
				MakeArg: func() interface{} {
					var ret [1]PanicArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PanicArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PanicArg)(nil), args)
						return
					}
					err = i.Panic(ctx, typedArgs[0].Message)
					return
				},
			},
			"testAirdropReg": {
				MakeArg: func() interface{} {
					var ret [1]TestAirdropRegArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.TestAirdropReg(ctx)
					return
				},
			},
			"echo": {
				MakeArg: func() interface{} {
					var ret [1]EchoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EchoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EchoArg)(nil), args)
						return
					}
					ret, err = i.Echo(ctx, typedArgs[0].Arg)
					return
				},
			},
		},
	}
}

type TestClient struct {
	Cli rpc.GenericClient
}

// Call test method.
// Will trigger the testCallback method, whose result will be set in the
// returned Test object, reply property.
func (c TestClient) Test(ctx context.Context, __arg TestArg) (res Test, err error) {
	err = c.Cli.Call(ctx, "keybase.1.test.test", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// This is a service callback triggered from test(..).
// The name param is what was passed into test.
func (c TestClient) TestCallback(ctx context.Context, __arg TestCallbackArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.test.testCallback", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// For testing crashes.
func (c TestClient) Panic(ctx context.Context, message string) (err error) {
	__arg := PanicArg{Message: message}
	err = c.Cli.Call(ctx, "keybase.1.test.panic", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// For testing airdrop reg.
func (c TestClient) TestAirdropReg(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.test.testAirdropReg", []interface{}{TestAirdropRegArg{}}, nil, 0*time.Millisecond)
	return
}

func (c TestClient) Echo(ctx context.Context, arg Generic) (res Generic, err error) {
	__arg := EchoArg{Arg: arg}
	err = c.Cli.Call(ctx, "keybase.1.test.echo", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
