// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/reachability.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type Reachable int

const (
	Reachable_UNKNOWN Reachable = 0
	Reachable_YES     Reachable = 1
	Reachable_NO      Reachable = 2
)

func (o Reachable) DeepCopy() Reachable { return o }

var ReachableMap = map[string]Reachable{
	"UNKNOWN": 0,
	"YES":     1,
	"NO":      2,
}

var ReachableRevMap = map[Reachable]string{
	0: "UNKNOWN",
	1: "YES",
	2: "NO",
}

func (e Reachable) String() string {
	if v, ok := ReachableRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Reachability struct {
	Reachable Reachable `codec:"reachable" json:"reachable"`
}

func (o Reachability) DeepCopy() Reachability {
	return Reachability{
		Reachable: o.Reachable.DeepCopy(),
	}
}

type ReachabilityChangedArg struct {
	Reachability Reachability `codec:"reachability" json:"reachability"`
}

type StartReachabilityArg struct {
}

type CheckReachabilityArg struct {
}

type ReachabilityInterface interface {
	ReachabilityChanged(context.Context, Reachability) error
	// Start reachability checks and return current status, which
	// may be cached.
	StartReachability(context.Context) (Reachability, error)
	// Performs a reachability check. This is not a cached response.
	CheckReachability(context.Context) (Reachability, error)
}

func ReachabilityProtocol(i ReachabilityInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.reachability",
		Methods: map[string]rpc.ServeHandlerDescription{
			"reachabilityChanged": {
				MakeArg: func() interface{} {
					var ret [1]ReachabilityChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ReachabilityChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ReachabilityChangedArg)(nil), args)
						return
					}
					err = i.ReachabilityChanged(ctx, typedArgs[0].Reachability)
					return
				},
			},
			"startReachability": {
				MakeArg: func() interface{} {
					var ret [1]StartReachabilityArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.StartReachability(ctx)
					return
				},
			},
			"checkReachability": {
				MakeArg: func() interface{} {
					var ret [1]CheckReachabilityArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.CheckReachability(ctx)
					return
				},
			},
		},
	}
}

type ReachabilityClient struct {
	Cli rpc.GenericClient
}

func (c ReachabilityClient) ReachabilityChanged(ctx context.Context, reachability Reachability) (err error) {
	__arg := ReachabilityChangedArg{Reachability: reachability}
	err = c.Cli.Notify(ctx, "keybase.1.reachability.reachabilityChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

// Start reachability checks and return current status, which
// may be cached.
func (c ReachabilityClient) StartReachability(ctx context.Context) (res Reachability, err error) {
	err = c.Cli.Call(ctx, "keybase.1.reachability.startReachability", []interface{}{StartReachabilityArg{}}, &res, 0*time.Millisecond)
	return
}

// Performs a reachability check. This is not a cached response.
func (c ReachabilityClient) CheckReachability(ctx context.Context) (res Reachability, err error) {
	err = c.Cli.Call(ctx, "keybase.1.reachability.checkReachability", []interface{}{CheckReachabilityArg{}}, &res, 0*time.Millisecond)
	return
}
