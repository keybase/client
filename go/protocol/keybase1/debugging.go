// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/debugging.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type FirstStepResult struct {
	ValPlusTwo int `codec:"valPlusTwo" json:"valPlusTwo"`
}

func (o FirstStepResult) DeepCopy() FirstStepResult {
	return FirstStepResult{
		ValPlusTwo: o.ValPlusTwo,
	}
}

type FirstStepArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Val       int `codec:"val" json:"val"`
}

type SecondStepArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Val       int `codec:"val" json:"val"`
}

type IncrementArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Val       int `codec:"val" json:"val"`
}

type ScriptArg struct {
	Script string   `codec:"script" json:"script"`
	Args   []string `codec:"args" json:"args"`
}

type DebuggingInterface interface {
	FirstStep(context.Context, FirstStepArg) (FirstStepResult, error)
	SecondStep(context.Context, SecondStepArg) (int, error)
	Increment(context.Context, IncrementArg) (int, error)
	Script(context.Context, ScriptArg) (string, error)
}

func DebuggingProtocol(i DebuggingInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.debugging",
		Methods: map[string]rpc.ServeHandlerDescription{
			"firstStep": {
				MakeArg: func() interface{} {
					var ret [1]FirstStepArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FirstStepArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FirstStepArg)(nil), args)
						return
					}
					ret, err = i.FirstStep(ctx, typedArgs[0])
					return
				},
			},
			"secondStep": {
				MakeArg: func() interface{} {
					var ret [1]SecondStepArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SecondStepArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SecondStepArg)(nil), args)
						return
					}
					ret, err = i.SecondStep(ctx, typedArgs[0])
					return
				},
			},
			"increment": {
				MakeArg: func() interface{} {
					var ret [1]IncrementArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IncrementArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IncrementArg)(nil), args)
						return
					}
					ret, err = i.Increment(ctx, typedArgs[0])
					return
				},
			},
			"script": {
				MakeArg: func() interface{} {
					var ret [1]ScriptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ScriptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ScriptArg)(nil), args)
						return
					}
					ret, err = i.Script(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type DebuggingClient struct {
	Cli rpc.GenericClient
}

func (c DebuggingClient) FirstStep(ctx context.Context, __arg FirstStepArg) (res FirstStepResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.debugging.firstStep", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c DebuggingClient) SecondStep(ctx context.Context, __arg SecondStepArg) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.debugging.secondStep", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c DebuggingClient) Increment(ctx context.Context, __arg IncrementArg) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.debugging.increment", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c DebuggingClient) Script(ctx context.Context, __arg ScriptArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.debugging.script", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
