// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/phone_numbers.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

// Phone number support for TOFU chats.
type UserPhoneNumber struct {
	PhoneNumber PhoneNumber        `codec:"phoneNumber" json:"phone_number"`
	Verified    bool               `codec:"verified" json:"verified"`
	Superseded  bool               `codec:"superseded" json:"superseded"`
	Visibility  IdentityVisibility `codec:"visibility" json:"visibility"`
	Ctime       UnixTime           `codec:"ctime" json:"ctime"`
}

func (o UserPhoneNumber) DeepCopy() UserPhoneNumber {
	return UserPhoneNumber{
		PhoneNumber: o.PhoneNumber.DeepCopy(),
		Verified:    o.Verified,
		Superseded:  o.Superseded,
		Visibility:  o.Visibility.DeepCopy(),
		Ctime:       o.Ctime.DeepCopy(),
	}
}

type PhoneNumberLookupResult struct {
	PhoneNumber        RawPhoneNumber `codec:"phoneNumber" json:"phone_number"`
	CoercedPhoneNumber PhoneNumber    `codec:"coercedPhoneNumber" json:"coerced_phone_number"`
	Err                *string        `codec:"err,omitempty" json:"err,omitempty"`
	Uid                *UID           `codec:"uid,omitempty" json:"uid,omitempty"`
}

func (o PhoneNumberLookupResult) DeepCopy() PhoneNumberLookupResult {
	return PhoneNumberLookupResult{
		PhoneNumber:        o.PhoneNumber.DeepCopy(),
		CoercedPhoneNumber: o.CoercedPhoneNumber.DeepCopy(),
		Err: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Err),
		Uid: (func(x *UID) *UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Uid),
	}
}

type PhoneNumberChangedMsg struct {
	PhoneNumber PhoneNumber `codec:"phoneNumber" json:"phone"`
}

func (o PhoneNumberChangedMsg) DeepCopy() PhoneNumberChangedMsg {
	return PhoneNumberChangedMsg{
		PhoneNumber: o.PhoneNumber.DeepCopy(),
	}
}

type AddPhoneNumberArg struct {
	SessionID   int                `codec:"sessionID" json:"sessionID"`
	PhoneNumber PhoneNumber        `codec:"phoneNumber" json:"phoneNumber"`
	Visibility  IdentityVisibility `codec:"visibility" json:"visibility"`
}

type EditPhoneNumberArg struct {
	SessionID      int                `codec:"sessionID" json:"sessionID"`
	OldPhoneNumber PhoneNumber        `codec:"oldPhoneNumber" json:"oldPhoneNumber"`
	PhoneNumber    PhoneNumber        `codec:"phoneNumber" json:"phoneNumber"`
	Visibility     IdentityVisibility `codec:"visibility" json:"visibility"`
}

type VerifyPhoneNumberArg struct {
	SessionID   int         `codec:"sessionID" json:"sessionID"`
	PhoneNumber PhoneNumber `codec:"phoneNumber" json:"phoneNumber"`
	Code        string      `codec:"code" json:"code"`
}

type ResendVerificationForPhoneNumberArg struct {
	SessionID   int         `codec:"sessionID" json:"sessionID"`
	PhoneNumber PhoneNumber `codec:"phoneNumber" json:"phoneNumber"`
}

type GetPhoneNumbersArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeletePhoneNumberArg struct {
	SessionID   int         `codec:"sessionID" json:"sessionID"`
	PhoneNumber PhoneNumber `codec:"phoneNumber" json:"phoneNumber"`
}

type SetVisibilityPhoneNumberArg struct {
	SessionID   int                `codec:"sessionID" json:"sessionID"`
	PhoneNumber PhoneNumber        `codec:"phoneNumber" json:"phoneNumber"`
	Visibility  IdentityVisibility `codec:"visibility" json:"visibility"`
}

type SetVisibilityAllPhoneNumberArg struct {
	SessionID  int                `codec:"sessionID" json:"sessionID"`
	Visibility IdentityVisibility `codec:"visibility" json:"visibility"`
}

type PhoneNumbersInterface interface {
	AddPhoneNumber(context.Context, AddPhoneNumberArg) error
	EditPhoneNumber(context.Context, EditPhoneNumberArg) error
	VerifyPhoneNumber(context.Context, VerifyPhoneNumberArg) error
	ResendVerificationForPhoneNumber(context.Context, ResendVerificationForPhoneNumberArg) error
	GetPhoneNumbers(context.Context, int) ([]UserPhoneNumber, error)
	DeletePhoneNumber(context.Context, DeletePhoneNumberArg) error
	SetVisibilityPhoneNumber(context.Context, SetVisibilityPhoneNumberArg) error
	SetVisibilityAllPhoneNumber(context.Context, SetVisibilityAllPhoneNumberArg) error
}

func PhoneNumbersProtocol(i PhoneNumbersInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.phoneNumbers",
		Methods: map[string]rpc.ServeHandlerDescription{
			"addPhoneNumber": {
				MakeArg: func() interface{} {
					var ret [1]AddPhoneNumberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddPhoneNumberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddPhoneNumberArg)(nil), args)
						return
					}
					err = i.AddPhoneNumber(ctx, typedArgs[0])
					return
				},
			},
			"editPhoneNumber": {
				MakeArg: func() interface{} {
					var ret [1]EditPhoneNumberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EditPhoneNumberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EditPhoneNumberArg)(nil), args)
						return
					}
					err = i.EditPhoneNumber(ctx, typedArgs[0])
					return
				},
			},
			"verifyPhoneNumber": {
				MakeArg: func() interface{} {
					var ret [1]VerifyPhoneNumberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]VerifyPhoneNumberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]VerifyPhoneNumberArg)(nil), args)
						return
					}
					err = i.VerifyPhoneNumber(ctx, typedArgs[0])
					return
				},
			},
			"resendVerificationForPhoneNumber": {
				MakeArg: func() interface{} {
					var ret [1]ResendVerificationForPhoneNumberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ResendVerificationForPhoneNumberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ResendVerificationForPhoneNumberArg)(nil), args)
						return
					}
					err = i.ResendVerificationForPhoneNumber(ctx, typedArgs[0])
					return
				},
			},
			"getPhoneNumbers": {
				MakeArg: func() interface{} {
					var ret [1]GetPhoneNumbersArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPhoneNumbersArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPhoneNumbersArg)(nil), args)
						return
					}
					ret, err = i.GetPhoneNumbers(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"deletePhoneNumber": {
				MakeArg: func() interface{} {
					var ret [1]DeletePhoneNumberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeletePhoneNumberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeletePhoneNumberArg)(nil), args)
						return
					}
					err = i.DeletePhoneNumber(ctx, typedArgs[0])
					return
				},
			},
			"setVisibilityPhoneNumber": {
				MakeArg: func() interface{} {
					var ret [1]SetVisibilityPhoneNumberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetVisibilityPhoneNumberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetVisibilityPhoneNumberArg)(nil), args)
						return
					}
					err = i.SetVisibilityPhoneNumber(ctx, typedArgs[0])
					return
				},
			},
			"setVisibilityAllPhoneNumber": {
				MakeArg: func() interface{} {
					var ret [1]SetVisibilityAllPhoneNumberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetVisibilityAllPhoneNumberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetVisibilityAllPhoneNumberArg)(nil), args)
						return
					}
					err = i.SetVisibilityAllPhoneNumber(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type PhoneNumbersClient struct {
	Cli rpc.GenericClient
}

func (c PhoneNumbersClient) AddPhoneNumber(ctx context.Context, __arg AddPhoneNumberArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.phoneNumbers.addPhoneNumber", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PhoneNumbersClient) EditPhoneNumber(ctx context.Context, __arg EditPhoneNumberArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.phoneNumbers.editPhoneNumber", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PhoneNumbersClient) VerifyPhoneNumber(ctx context.Context, __arg VerifyPhoneNumberArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.phoneNumbers.verifyPhoneNumber", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PhoneNumbersClient) ResendVerificationForPhoneNumber(ctx context.Context, __arg ResendVerificationForPhoneNumberArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.phoneNumbers.resendVerificationForPhoneNumber", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PhoneNumbersClient) GetPhoneNumbers(ctx context.Context, sessionID int) (res []UserPhoneNumber, err error) {
	__arg := GetPhoneNumbersArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.phoneNumbers.getPhoneNumbers", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c PhoneNumbersClient) DeletePhoneNumber(ctx context.Context, __arg DeletePhoneNumberArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.phoneNumbers.deletePhoneNumber", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PhoneNumbersClient) SetVisibilityPhoneNumber(ctx context.Context, __arg SetVisibilityPhoneNumberArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.phoneNumbers.setVisibilityPhoneNumber", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c PhoneNumbersClient) SetVisibilityAllPhoneNumber(ctx context.Context, __arg SetVisibilityAllPhoneNumberArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.phoneNumbers.setVisibilityAllPhoneNumber", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
