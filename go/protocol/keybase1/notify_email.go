// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_email.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type EmailAddressVerifiedArg struct {
	EmailAddress EmailAddress `codec:"emailAddress" json:"emailAddress"`
}

type EmailsChangedArg struct {
	List     []Email      `codec:"list" json:"list"`
	Category string       `codec:"category" json:"category"`
	Email    EmailAddress `codec:"email" json:"email"`
}

type NotifyEmailAddressInterface interface {
	EmailAddressVerified(context.Context, EmailAddress) error
	EmailsChanged(context.Context, EmailsChangedArg) error
}

func NotifyEmailAddressProtocol(i NotifyEmailAddressInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyEmailAddress",
		Methods: map[string]rpc.ServeHandlerDescription{
			"emailAddressVerified": {
				MakeArg: func() interface{} {
					var ret [1]EmailAddressVerifiedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EmailAddressVerifiedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EmailAddressVerifiedArg)(nil), args)
						return
					}
					err = i.EmailAddressVerified(ctx, typedArgs[0].EmailAddress)
					return
				},
			},
			"emailsChanged": {
				MakeArg: func() interface{} {
					var ret [1]EmailsChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EmailsChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EmailsChangedArg)(nil), args)
						return
					}
					err = i.EmailsChanged(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyEmailAddressClient struct {
	Cli rpc.GenericClient
}

func (c NotifyEmailAddressClient) EmailAddressVerified(ctx context.Context, emailAddress EmailAddress) (err error) {
	__arg := EmailAddressVerifiedArg{EmailAddress: emailAddress}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyEmailAddress.emailAddressVerified", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyEmailAddressClient) EmailsChanged(ctx context.Context, __arg EmailsChangedArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyEmailAddress.emailsChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}
