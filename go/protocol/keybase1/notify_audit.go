// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_audit.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type RootAuditErrorArg struct {
	Message string `codec:"message" json:"message"`
}

type BoxAuditErrorArg struct {
	Message string `codec:"message" json:"message"`
}

type NotifyAuditInterface interface {
	RootAuditError(context.Context, string) error
	BoxAuditError(context.Context, string) error
}

func NotifyAuditProtocol(i NotifyAuditInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyAudit",
		Methods: map[string]rpc.ServeHandlerDescription{
			"rootAuditError": {
				MakeArg: func() interface{} {
					var ret [1]RootAuditErrorArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RootAuditErrorArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RootAuditErrorArg)(nil), args)
						return
					}
					err = i.RootAuditError(ctx, typedArgs[0].Message)
					return
				},
			},
			"boxAuditError": {
				MakeArg: func() interface{} {
					var ret [1]BoxAuditErrorArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BoxAuditErrorArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BoxAuditErrorArg)(nil), args)
						return
					}
					err = i.BoxAuditError(ctx, typedArgs[0].Message)
					return
				},
			},
		},
	}
}

type NotifyAuditClient struct {
	Cli rpc.GenericClient
}

func (c NotifyAuditClient) RootAuditError(ctx context.Context, message string) (err error) {
	__arg := RootAuditErrorArg{Message: message}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyAudit.rootAuditError", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyAuditClient) BoxAuditError(ctx context.Context, message string) (err error) {
	__arg := BoxAuditErrorArg{Message: message}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyAudit.boxAuditError", []interface{}{__arg}, 0*time.Millisecond)
	return
}
