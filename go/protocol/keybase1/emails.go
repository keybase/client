// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/emails.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type EmailLookupResult struct {
	Email EmailAddress `codec:"email" json:"email"`
	Uid   *UID         `codec:"uid,omitempty" json:"uid,omitempty"`
}

func (o EmailLookupResult) DeepCopy() EmailLookupResult {
	return EmailLookupResult{
		Email: o.Email.DeepCopy(),
		Uid: (func(x *UID) *UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Uid),
	}
}

type EmailAddressVerifiedMsg struct {
	Email EmailAddress `codec:"email" json:"email"`
}

func (o EmailAddressVerifiedMsg) DeepCopy() EmailAddressVerifiedMsg {
	return EmailAddressVerifiedMsg{
		Email: o.Email.DeepCopy(),
	}
}

type EmailAddressChangedMsg struct {
	Email EmailAddress `codec:"email" json:"email"`
}

func (o EmailAddressChangedMsg) DeepCopy() EmailAddressChangedMsg {
	return EmailAddressChangedMsg{
		Email: o.Email.DeepCopy(),
	}
}

type AddEmailArg struct {
	SessionID  int                `codec:"sessionID" json:"sessionID"`
	Email      EmailAddress       `codec:"email" json:"email"`
	Visibility IdentityVisibility `codec:"visibility" json:"visibility"`
}

type DeleteEmailArg struct {
	SessionID int          `codec:"sessionID" json:"sessionID"`
	Email     EmailAddress `codec:"email" json:"email"`
}

type EditEmailArg struct {
	SessionID  int                `codec:"sessionID" json:"sessionID"`
	OldEmail   EmailAddress       `codec:"oldEmail" json:"oldEmail"`
	Email      EmailAddress       `codec:"email" json:"email"`
	Visibility IdentityVisibility `codec:"visibility" json:"visibility"`
}

type SetPrimaryEmailArg struct {
	SessionID int          `codec:"sessionID" json:"sessionID"`
	Email     EmailAddress `codec:"email" json:"email"`
}

type SendVerificationEmailArg struct {
	SessionID int          `codec:"sessionID" json:"sessionID"`
	Email     EmailAddress `codec:"email" json:"email"`
}

type SetVisibilityEmailArg struct {
	SessionID  int                `codec:"sessionID" json:"sessionID"`
	Email      EmailAddress       `codec:"email" json:"email"`
	Visibility IdentityVisibility `codec:"visibility" json:"visibility"`
}

type SetVisibilityAllEmailArg struct {
	SessionID  int                `codec:"sessionID" json:"sessionID"`
	Visibility IdentityVisibility `codec:"visibility" json:"visibility"`
}

type GetEmailsArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type EmailsInterface interface {
	AddEmail(context.Context, AddEmailArg) error
	DeleteEmail(context.Context, DeleteEmailArg) error
	EditEmail(context.Context, EditEmailArg) error
	SetPrimaryEmail(context.Context, SetPrimaryEmailArg) error
	SendVerificationEmail(context.Context, SendVerificationEmailArg) error
	SetVisibilityEmail(context.Context, SetVisibilityEmailArg) error
	SetVisibilityAllEmail(context.Context, SetVisibilityAllEmailArg) error
	GetEmails(context.Context, int) ([]Email, error)
}

func EmailsProtocol(i EmailsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.emails",
		Methods: map[string]rpc.ServeHandlerDescription{
			"addEmail": {
				MakeArg: func() interface{} {
					var ret [1]AddEmailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddEmailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddEmailArg)(nil), args)
						return
					}
					err = i.AddEmail(ctx, typedArgs[0])
					return
				},
			},
			"deleteEmail": {
				MakeArg: func() interface{} {
					var ret [1]DeleteEmailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteEmailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteEmailArg)(nil), args)
						return
					}
					err = i.DeleteEmail(ctx, typedArgs[0])
					return
				},
			},
			"editEmail": {
				MakeArg: func() interface{} {
					var ret [1]EditEmailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EditEmailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EditEmailArg)(nil), args)
						return
					}
					err = i.EditEmail(ctx, typedArgs[0])
					return
				},
			},
			"setPrimaryEmail": {
				MakeArg: func() interface{} {
					var ret [1]SetPrimaryEmailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetPrimaryEmailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetPrimaryEmailArg)(nil), args)
						return
					}
					err = i.SetPrimaryEmail(ctx, typedArgs[0])
					return
				},
			},
			"sendVerificationEmail": {
				MakeArg: func() interface{} {
					var ret [1]SendVerificationEmailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SendVerificationEmailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SendVerificationEmailArg)(nil), args)
						return
					}
					err = i.SendVerificationEmail(ctx, typedArgs[0])
					return
				},
			},
			"setVisibilityEmail": {
				MakeArg: func() interface{} {
					var ret [1]SetVisibilityEmailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetVisibilityEmailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetVisibilityEmailArg)(nil), args)
						return
					}
					err = i.SetVisibilityEmail(ctx, typedArgs[0])
					return
				},
			},
			"setVisibilityAllEmail": {
				MakeArg: func() interface{} {
					var ret [1]SetVisibilityAllEmailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetVisibilityAllEmailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetVisibilityAllEmailArg)(nil), args)
						return
					}
					err = i.SetVisibilityAllEmail(ctx, typedArgs[0])
					return
				},
			},
			"getEmails": {
				MakeArg: func() interface{} {
					var ret [1]GetEmailsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetEmailsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetEmailsArg)(nil), args)
						return
					}
					ret, err = i.GetEmails(ctx, typedArgs[0].SessionID)
					return
				},
			},
		},
	}
}

type EmailsClient struct {
	Cli rpc.GenericClient
}

func (c EmailsClient) AddEmail(ctx context.Context, __arg AddEmailArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.emails.addEmail", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c EmailsClient) DeleteEmail(ctx context.Context, __arg DeleteEmailArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.emails.deleteEmail", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c EmailsClient) EditEmail(ctx context.Context, __arg EditEmailArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.emails.editEmail", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c EmailsClient) SetPrimaryEmail(ctx context.Context, __arg SetPrimaryEmailArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.emails.setPrimaryEmail", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c EmailsClient) SendVerificationEmail(ctx context.Context, __arg SendVerificationEmailArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.emails.sendVerificationEmail", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c EmailsClient) SetVisibilityEmail(ctx context.Context, __arg SetVisibilityEmailArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.emails.setVisibilityEmail", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c EmailsClient) SetVisibilityAllEmail(ctx context.Context, __arg SetVisibilityAllEmailArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.emails.setVisibilityAllEmail", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c EmailsClient) GetEmails(ctx context.Context, sessionID int) (res []Email, err error) {
	__arg := GetEmailsArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.emails.getEmails", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
