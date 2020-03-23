// Auto-generated to Go types and interfaces using avdl-compiler v1.4.8 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/invite_friends.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type EmailInvites struct {
	CommaSeparatedEmailsFromUser *string         `codec:"commaSeparatedEmailsFromUser,omitempty" json:"commaSeparatedEmailsFromUser,omitempty"`
	EmailsFromContacts           *[]EmailAddress `codec:"emailsFromContacts,omitempty" json:"emailsFromContacts,omitempty"`
}

func (o EmailInvites) DeepCopy() EmailInvites {
	return EmailInvites{
		CommaSeparatedEmailsFromUser: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.CommaSeparatedEmailsFromUser),
		EmailsFromContacts: (func(x *[]EmailAddress) *[]EmailAddress {
			if x == nil {
				return nil
			}
			tmp := (func(x []EmailAddress) []EmailAddress {
				if x == nil {
					return nil
				}
				ret := make([]EmailAddress, len(x))
				for i, v := range x {
					vCopy := v.DeepCopy()
					ret[i] = vCopy
				}
				return ret
			})((*x))
			return &tmp
		})(o.EmailsFromContacts),
	}
}

type InvitePeopleArg struct {
	Emails EmailInvites     `codec:"emails" json:"emails"`
	Phones []RawPhoneNumber `codec:"phones" json:"phones"`
}

type InviteFriendsInterface interface {
	InvitePeople(context.Context, InvitePeopleArg) error
}

func InviteFriendsProtocol(i InviteFriendsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.inviteFriends",
		Methods: map[string]rpc.ServeHandlerDescription{
			"invitePeople": {
				MakeArg: func() interface{} {
					var ret [1]InvitePeopleArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]InvitePeopleArg)
					if !ok {
						err = rpc.NewTypeError((*[1]InvitePeopleArg)(nil), args)
						return
					}
					err = i.InvitePeople(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type InviteFriendsClient struct {
	Cli rpc.GenericClient
}

func (c InviteFriendsClient) InvitePeople(ctx context.Context, __arg InvitePeopleArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.inviteFriends.invitePeople", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
