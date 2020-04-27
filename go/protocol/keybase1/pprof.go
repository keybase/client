// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/pprof.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ProcessorProfileArg struct {
	SessionID              int         `codec:"sessionID" json:"sessionID"`
	ProfileFile            string      `codec:"profileFile" json:"profileFile"`
	ProfileDurationSeconds DurationSec `codec:"profileDurationSeconds" json:"profileDurationSeconds"`
}

type HeapProfileArg struct {
	SessionID   int    `codec:"sessionID" json:"sessionID"`
	ProfileFile string `codec:"profileFile" json:"profileFile"`
}

type LogProcessorProfileArg struct {
	SessionID              int         `codec:"sessionID" json:"sessionID"`
	LogDirForMobile        string      `codec:"logDirForMobile" json:"logDirForMobile"`
	ProfileDurationSeconds DurationSec `codec:"profileDurationSeconds" json:"profileDurationSeconds"`
}

type TraceArg struct {
	SessionID            int         `codec:"sessionID" json:"sessionID"`
	TraceFile            string      `codec:"traceFile" json:"traceFile"`
	TraceDurationSeconds DurationSec `codec:"traceDurationSeconds" json:"traceDurationSeconds"`
}

type LogTraceArg struct {
	SessionID            int         `codec:"sessionID" json:"sessionID"`
	LogDirForMobile      string      `codec:"logDirForMobile" json:"logDirForMobile"`
	TraceDurationSeconds DurationSec `codec:"traceDurationSeconds" json:"traceDurationSeconds"`
}

type PprofInterface interface {
	ProcessorProfile(context.Context, ProcessorProfileArg) error
	HeapProfile(context.Context, HeapProfileArg) error
	LogProcessorProfile(context.Context, LogProcessorProfileArg) error
	Trace(context.Context, TraceArg) error
	LogTrace(context.Context, LogTraceArg) error
}

func PprofProtocol(i PprofInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.pprof",
		Methods: map[string]rpc.ServeHandlerDescription{
			"processorProfile": {
				MakeArg: func() interface{} {
					var ret [1]ProcessorProfileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ProcessorProfileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ProcessorProfileArg)(nil), args)
						return
					}
					err = i.ProcessorProfile(ctx, typedArgs[0])
					return
				},
			},
			"heapProfile": {
				MakeArg: func() interface{} {
					var ret [1]HeapProfileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HeapProfileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HeapProfileArg)(nil), args)
						return
					}
					err = i.HeapProfile(ctx, typedArgs[0])
					return
				},
			},
			"logProcessorProfile": {
				MakeArg: func() interface{} {
					var ret [1]LogProcessorProfileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LogProcessorProfileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LogProcessorProfileArg)(nil), args)
						return
					}
					err = i.LogProcessorProfile(ctx, typedArgs[0])
					return
				},
			},
			"trace": {
				MakeArg: func() interface{} {
					var ret [1]TraceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TraceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TraceArg)(nil), args)
						return
					}
					err = i.Trace(ctx, typedArgs[0])
					return
				},
			},
			"logTrace": {
				MakeArg: func() interface{} {
					var ret [1]LogTraceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LogTraceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LogTraceArg)(nil), args)
						return
					}
					err = i.LogTrace(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type PprofClient struct {
	Cli rpc.GenericClient
}

func (c PprofClient) ProcessorProfile(ctx context.Context, __arg ProcessorProfileArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pprof.processorProfile", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PprofClient) HeapProfile(ctx context.Context, __arg HeapProfileArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pprof.heapProfile", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PprofClient) LogProcessorProfile(ctx context.Context, __arg LogProcessorProfileArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pprof.logProcessorProfile", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PprofClient) Trace(ctx context.Context, __arg TraceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pprof.trace", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PprofClient) LogTrace(ctx context.Context, __arg LogTraceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pprof.logTrace", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
