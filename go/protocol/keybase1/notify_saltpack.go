// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_saltpack.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type OperationType int

const (
	OperationType_ENCRYPT OperationType = 0
	OperationType_DECRYPT OperationType = 1
	OperationType_SIGN    OperationType = 2
	OperationType_VERIFY  OperationType = 3
)

func (o OperationType) DeepCopy() OperationType { return o }

var OperationTypeMap = map[string]OperationType{
	"ENCRYPT": 0,
	"DECRYPT": 1,
	"SIGN":    2,
	"VERIFY":  3,
}

var OperationTypeRevMap = map[OperationType]string{
	0: "ENCRYPT",
	1: "DECRYPT",
	2: "SIGN",
	3: "VERIFY",
}

func (e OperationType) String() string {
	if v, ok := OperationTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SaltpackOperationStartArg struct {
	OpType   OperationType `codec:"opType" json:"opType"`
	Filename string        `codec:"filename" json:"filename"`
}

type SaltpackOperationProgressArg struct {
	OpType        OperationType `codec:"opType" json:"opType"`
	Filename      string        `codec:"filename" json:"filename"`
	BytesComplete int64         `codec:"bytesComplete" json:"bytesComplete"`
	BytesTotal    int64         `codec:"bytesTotal" json:"bytesTotal"`
}

type SaltpackOperationDoneArg struct {
	OpType   OperationType `codec:"opType" json:"opType"`
	Filename string        `codec:"filename" json:"filename"`
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
