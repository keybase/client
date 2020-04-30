// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/contacts.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ContactComponent struct {
	Label       string          `codec:"label" json:"label"`
	PhoneNumber *RawPhoneNumber `codec:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	Email       *EmailAddress   `codec:"email,omitempty" json:"email,omitempty"`
}

func (o ContactComponent) DeepCopy() ContactComponent {
	return ContactComponent{
		Label: o.Label,
		PhoneNumber: (func(x *RawPhoneNumber) *RawPhoneNumber {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.PhoneNumber),
		Email: (func(x *EmailAddress) *EmailAddress {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Email),
	}
}

type Contact struct {
	Name       string             `codec:"name" json:"name"`
	Components []ContactComponent `codec:"components" json:"components"`
}

func (o Contact) DeepCopy() Contact {
	return Contact{
		Name: o.Name,
		Components: (func(x []ContactComponent) []ContactComponent {
			if x == nil {
				return nil
			}
			ret := make([]ContactComponent, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Components),
	}
}

type ProcessedContact struct {
	ContactIndex int               `codec:"contactIndex" json:"contactIndex"`
	ContactName  string            `codec:"contactName" json:"contactName"`
	Component    ContactComponent  `codec:"component" json:"component"`
	Resolved     bool              `codec:"resolved" json:"resolved"`
	Uid          UID               `codec:"uid" json:"uid"`
	Username     string            `codec:"username" json:"username"`
	FullName     string            `codec:"fullName" json:"fullName"`
	Following    bool              `codec:"following" json:"following"`
	ServiceMap   map[string]string `codec:"serviceMap" json:"serviceMap"`
	Assertion    string            `codec:"assertion" json:"assertion"`
	DisplayName  string            `codec:"displayName" json:"displayName"`
	DisplayLabel string            `codec:"displayLabel" json:"displayLabel"`
}

func (o ProcessedContact) DeepCopy() ProcessedContact {
	return ProcessedContact{
		ContactIndex: o.ContactIndex,
		ContactName:  o.ContactName,
		Component:    o.Component.DeepCopy(),
		Resolved:     o.Resolved,
		Uid:          o.Uid.DeepCopy(),
		Username:     o.Username,
		FullName:     o.FullName,
		Following:    o.Following,
		ServiceMap: (func(x map[string]string) map[string]string {
			if x == nil {
				return nil
			}
			ret := make(map[string]string, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.ServiceMap),
		Assertion:    o.Assertion,
		DisplayName:  o.DisplayName,
		DisplayLabel: o.DisplayLabel,
	}
}

type ContactListResolutionResult struct {
	NewlyResolved []ProcessedContact `codec:"newlyResolved" json:"newlyResolved"`
	Resolved      []ProcessedContact `codec:"resolved" json:"resolved"`
}

func (o ContactListResolutionResult) DeepCopy() ContactListResolutionResult {
	return ContactListResolutionResult{
		NewlyResolved: (func(x []ProcessedContact) []ProcessedContact {
			if x == nil {
				return nil
			}
			ret := make([]ProcessedContact, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.NewlyResolved),
		Resolved: (func(x []ProcessedContact) []ProcessedContact {
			if x == nil {
				return nil
			}
			ret := make([]ProcessedContact, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Resolved),
	}
}

type LookupContactListArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	Contacts  []Contact `codec:"contacts" json:"contacts"`
}

type SaveContactListArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	Contacts  []Contact `codec:"contacts" json:"contacts"`
}

type LookupSavedContactsListArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetContactsForUserRecommendationsArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ContactsInterface interface {
	LookupContactList(context.Context, LookupContactListArg) ([]ProcessedContact, error)
	SaveContactList(context.Context, SaveContactListArg) (ContactListResolutionResult, error)
	LookupSavedContactsList(context.Context, int) ([]ProcessedContact, error)
	GetContactsForUserRecommendations(context.Context, int) ([]ProcessedContact, error)
}

func ContactsProtocol(i ContactsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.contacts",
		Methods: map[string]rpc.ServeHandlerDescription{
			"lookupContactList": {
				MakeArg: func() interface{} {
					var ret [1]LookupContactListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LookupContactListArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LookupContactListArg)(nil), args)
						return
					}
					ret, err = i.LookupContactList(ctx, typedArgs[0])
					return
				},
			},
			"saveContactList": {
				MakeArg: func() interface{} {
					var ret [1]SaveContactListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaveContactListArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaveContactListArg)(nil), args)
						return
					}
					ret, err = i.SaveContactList(ctx, typedArgs[0])
					return
				},
			},
			"lookupSavedContactsList": {
				MakeArg: func() interface{} {
					var ret [1]LookupSavedContactsListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LookupSavedContactsListArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LookupSavedContactsListArg)(nil), args)
						return
					}
					ret, err = i.LookupSavedContactsList(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getContactsForUserRecommendations": {
				MakeArg: func() interface{} {
					var ret [1]GetContactsForUserRecommendationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetContactsForUserRecommendationsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetContactsForUserRecommendationsArg)(nil), args)
						return
					}
					ret, err = i.GetContactsForUserRecommendations(ctx, typedArgs[0].SessionID)
					return
				},
			},
		},
	}
}

type ContactsClient struct {
	Cli rpc.GenericClient
}

func (c ContactsClient) LookupContactList(ctx context.Context, __arg LookupContactListArg) (res []ProcessedContact, err error) {
	err = c.Cli.Call(ctx, "keybase.1.contacts.lookupContactList", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ContactsClient) SaveContactList(ctx context.Context, __arg SaveContactListArg) (res ContactListResolutionResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.contacts.saveContactList", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ContactsClient) LookupSavedContactsList(ctx context.Context, sessionID int) (res []ProcessedContact, err error) {
	__arg := LookupSavedContactsListArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.contacts.lookupSavedContactsList", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ContactsClient) GetContactsForUserRecommendations(ctx context.Context, sessionID int) (res []ProcessedContact, err error) {
	__arg := GetContactsForUserRecommendationsArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.contacts.getContactsForUserRecommendations", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
