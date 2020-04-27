// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_saltpack.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type SaltpackOperationType int

const (
	SaltpackOperationType_ENCRYPT SaltpackOperationType = 0
	SaltpackOperationType_DECRYPT SaltpackOperationType = 1
	SaltpackOperationType_SIGN    SaltpackOperationType = 2
	SaltpackOperationType_VERIFY  SaltpackOperationType = 3
)

func (o SaltpackOperationType) DeepCopy() SaltpackOperationType { return o }

var SaltpackOperationTypeMap = map[string]SaltpackOperationType{
	"ENCRYPT": 0,
	"DECRYPT": 1,
	"SIGN":    2,
	"VERIFY":  3,
}

var SaltpackOperationTypeRevMap = map[SaltpackOperationType]string{
	0: "ENCRYPT",
	1: "DECRYPT",
	2: "SIGN",
	3: "VERIFY",
}

func (e SaltpackOperationType) String() string {
	if v, ok := SaltpackOperationTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SaltpackOperationStartArg struct {
	OpType   SaltpackOperationType `codec:"opType" json:"opType"`
	Filename string                `codec:"filename" json:"filename"`
}

type SaltpackOperationProgressArg struct {
	OpType        SaltpackOperationType `codec:"opType" json:"opType"`
	Filename      string                `codec:"filename" json:"filename"`
	BytesComplete int64                 `codec:"bytesComplete" json:"bytesComplete"`
	BytesTotal    int64                 `codec:"bytesTotal" json:"bytesTotal"`
}

type SaltpackOperationDoneArg struct {
	OpType   SaltpackOperationType `codec:"opType" json:"opType"`
	Filename string                `codec:"filename" json:"filename"`
}

type NotifySaltpackInterface interface {
	SaltpackOperationStart(context.Context, SaltpackOperationStartArg) error
	SaltpackOperationProgress(context.Context, SaltpackOperationProgressArg) error
	SaltpackOperationDone(context.Context, SaltpackOperationDoneArg) error
}

func NotifySaltpackProtocol(i NotifySaltpackInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifySaltpack",
		Methods: map[string]rpc.ServeHandlerDescription{
			"saltpackOperationStart": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackOperationStartArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackOperationStartArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackOperationStartArg)(nil), args)
						return
					}
					err = i.SaltpackOperationStart(ctx, typedArgs[0])
					return
				},
			},
			"saltpackOperationProgress": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackOperationProgressArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackOperationProgressArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackOperationProgressArg)(nil), args)
						return
					}
					err = i.SaltpackOperationProgress(ctx, typedArgs[0])
					return
				},
			},
			"saltpackOperationDone": {
				MakeArg: func() interface{} {
					var ret [1]SaltpackOperationDoneArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaltpackOperationDoneArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaltpackOperationDoneArg)(nil), args)
						return
					}
					err = i.SaltpackOperationDone(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifySaltpackClient struct {
	Cli rpc.GenericClient
}

func (c NotifySaltpackClient) SaltpackOperationStart(ctx context.Context, __arg SaltpackOperationStartArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifySaltpack.saltpackOperationStart", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifySaltpackClient) SaltpackOperationProgress(ctx context.Context, __arg SaltpackOperationProgressArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifySaltpack.saltpackOperationProgress", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifySaltpackClient) SaltpackOperationDone(ctx context.Context, __arg SaltpackOperationDoneArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifySaltpack.saltpackOperationDone", []interface{}{__arg}, 0*time.Millisecond)
	return
}
