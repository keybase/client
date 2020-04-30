// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/usersearch.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type APIUserServiceID string

func (o APIUserServiceID) DeepCopy() APIUserServiceID {
	return o
}

type APIUserKeybaseResult struct {
	Username   string  `codec:"username" json:"username"`
	Uid        UID     `codec:"uid" json:"uid"`
	PictureUrl *string `codec:"pictureUrl,omitempty" json:"picture_url,omitempty"`
	FullName   *string `codec:"fullName,omitempty" json:"full_name,omitempty"`
	RawScore   float64 `codec:"rawScore" json:"raw_score"`
	Stellar    *string `codec:"stellar,omitempty" json:"stellar,omitempty"`
	IsFollowee bool    `codec:"isFollowee" json:"is_followee"`
}

func (o APIUserKeybaseResult) DeepCopy() APIUserKeybaseResult {
	return APIUserKeybaseResult{
		Username: o.Username,
		Uid:      o.Uid.DeepCopy(),
		PictureUrl: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.PictureUrl),
		FullName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.FullName),
		RawScore: o.RawScore,
		Stellar: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Stellar),
		IsFollowee: o.IsFollowee,
	}
}

type APIUserServiceResult struct {
	ServiceName APIUserServiceID `codec:"serviceName" json:"service_name"`
	Username    string           `codec:"username" json:"username"`
	PictureUrl  string           `codec:"pictureUrl" json:"picture_url"`
	Bio         string           `codec:"bio" json:"bio"`
	Location    string           `codec:"location" json:"location"`
	FullName    string           `codec:"fullName" json:"full_name"`
	Confirmed   *bool            `codec:"confirmed,omitempty" json:"confirmed,omitempty"`
}

func (o APIUserServiceResult) DeepCopy() APIUserServiceResult {
	return APIUserServiceResult{
		ServiceName: o.ServiceName.DeepCopy(),
		Username:    o.Username,
		PictureUrl:  o.PictureUrl,
		Bio:         o.Bio,
		Location:    o.Location,
		FullName:    o.FullName,
		Confirmed: (func(x *bool) *bool {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Confirmed),
	}
}

type APIUserServiceSummary struct {
	ServiceName APIUserServiceID `codec:"serviceName" json:"service_name"`
	Username    string           `codec:"username" json:"username"`
}

func (o APIUserServiceSummary) DeepCopy() APIUserServiceSummary {
	return APIUserServiceSummary{
		ServiceName: o.ServiceName.DeepCopy(),
		Username:    o.Username,
	}
}

type ImpTofuSearchResult struct {
	Assertion       string `codec:"assertion" json:"assertion"`
	AssertionValue  string `codec:"assertionValue" json:"assertionValue"`
	AssertionKey    string `codec:"assertionKey" json:"assertionKey"`
	Label           string `codec:"label" json:"label"`
	PrettyName      string `codec:"prettyName" json:"prettyName"`
	KeybaseUsername string `codec:"keybaseUsername" json:"keybaseUsername"`
}

func (o ImpTofuSearchResult) DeepCopy() ImpTofuSearchResult {
	return ImpTofuSearchResult{
		Assertion:       o.Assertion,
		AssertionValue:  o.AssertionValue,
		AssertionKey:    o.AssertionKey,
		Label:           o.Label,
		PrettyName:      o.PrettyName,
		KeybaseUsername: o.KeybaseUsername,
	}
}

type APIUserSearchResult struct {
	Score           float64                                    `codec:"score" json:"score"`
	Keybase         *APIUserKeybaseResult                      `codec:"keybase,omitempty" json:"keybase,omitempty"`
	Service         *APIUserServiceResult                      `codec:"service,omitempty" json:"service,omitempty"`
	Contact         *ProcessedContact                          `codec:"contact,omitempty" json:"contact,omitempty"`
	Imptofu         *ImpTofuSearchResult                       `codec:"imptofu,omitempty" json:"imptofu,omitempty"`
	ServicesSummary map[APIUserServiceID]APIUserServiceSummary `codec:"servicesSummary" json:"services_summary"`
	RawScore        float64                                    `codec:"rawScore" json:"rawScore"`
}

func (o APIUserSearchResult) DeepCopy() APIUserSearchResult {
	return APIUserSearchResult{
		Score: o.Score,
		Keybase: (func(x *APIUserKeybaseResult) *APIUserKeybaseResult {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Keybase),
		Service: (func(x *APIUserServiceResult) *APIUserServiceResult {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Service),
		Contact: (func(x *ProcessedContact) *ProcessedContact {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Contact),
		Imptofu: (func(x *ImpTofuSearchResult) *ImpTofuSearchResult {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Imptofu),
		ServicesSummary: (func(x map[APIUserServiceID]APIUserServiceSummary) map[APIUserServiceID]APIUserServiceSummary {
			if x == nil {
				return nil
			}
			ret := make(map[APIUserServiceID]APIUserServiceSummary, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.ServicesSummary),
		RawScore: o.RawScore,
	}
}

type NonUserDetails struct {
	IsNonUser            bool                  `codec:"isNonUser" json:"isNonUser"`
	AssertionValue       string                `codec:"assertionValue" json:"assertionValue"`
	AssertionKey         string                `codec:"assertionKey" json:"assertionKey"`
	Description          string                `codec:"description" json:"description"`
	Contact              *ProcessedContact     `codec:"contact,omitempty" json:"contact,omitempty"`
	Service              *APIUserServiceResult `codec:"service,omitempty" json:"service,omitempty"`
	SiteIcon             []SizedImage          `codec:"siteIcon" json:"siteIcon"`
	SiteIconDarkmode     []SizedImage          `codec:"siteIconDarkmode" json:"siteIconDarkmode"`
	SiteIconFull         []SizedImage          `codec:"siteIconFull" json:"siteIconFull"`
	SiteIconFullDarkmode []SizedImage          `codec:"siteIconFullDarkmode" json:"siteIconFullDarkmode"`
}

func (o NonUserDetails) DeepCopy() NonUserDetails {
	return NonUserDetails{
		IsNonUser:      o.IsNonUser,
		AssertionValue: o.AssertionValue,
		AssertionKey:   o.AssertionKey,
		Description:    o.Description,
		Contact: (func(x *ProcessedContact) *ProcessedContact {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Contact),
		Service: (func(x *APIUserServiceResult) *APIUserServiceResult {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Service),
		SiteIcon: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIcon),
		SiteIconDarkmode: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconDarkmode),
		SiteIconFull: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconFull),
		SiteIconFullDarkmode: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconFullDarkmode),
	}
}

type EmailOrPhoneNumberSearchResult struct {
	Input          string `codec:"input" json:"input"`
	Assertion      string `codec:"assertion" json:"assertion"`
	AssertionValue string `codec:"assertionValue" json:"assertionValue"`
	AssertionKey   string `codec:"assertionKey" json:"assertionKey"`
	FoundUser      bool   `codec:"foundUser" json:"foundUser"`
	Username       string `codec:"username" json:"username"`
	FullName       string `codec:"fullName" json:"fullName"`
}

func (o EmailOrPhoneNumberSearchResult) DeepCopy() EmailOrPhoneNumberSearchResult {
	return EmailOrPhoneNumberSearchResult{
		Input:          o.Input,
		Assertion:      o.Assertion,
		AssertionValue: o.AssertionValue,
		AssertionKey:   o.AssertionKey,
		FoundUser:      o.FoundUser,
		Username:       o.Username,
		FullName:       o.FullName,
	}
}

type GetNonUserDetailsArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Assertion string `codec:"assertion" json:"assertion"`
}

type UserSearchArg struct {
	Query                  string `codec:"query" json:"query"`
	Service                string `codec:"service" json:"service"`
	MaxResults             int    `codec:"maxResults" json:"maxResults"`
	IncludeServicesSummary bool   `codec:"includeServicesSummary" json:"includeServicesSummary"`
	IncludeContacts        bool   `codec:"includeContacts" json:"includeContacts"`
}

type BulkEmailOrPhoneSearchArg struct {
	SessionID    int           `codec:"sessionID" json:"sessionID"`
	Emails       string        `codec:"emails" json:"emails"`
	PhoneNumbers []PhoneNumber `codec:"phoneNumbers" json:"phoneNumbers"`
}

type UserSearchInterface interface {
	GetNonUserDetails(context.Context, GetNonUserDetailsArg) (NonUserDetails, error)
	UserSearch(context.Context, UserSearchArg) ([]APIUserSearchResult, error)
	BulkEmailOrPhoneSearch(context.Context, BulkEmailOrPhoneSearchArg) ([]EmailOrPhoneNumberSearchResult, error)
}

func UserSearchProtocol(i UserSearchInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.userSearch",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getNonUserDetails": {
				MakeArg: func() interface{} {
					var ret [1]GetNonUserDetailsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetNonUserDetailsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetNonUserDetailsArg)(nil), args)
						return
					}
					ret, err = i.GetNonUserDetails(ctx, typedArgs[0])
					return
				},
			},
			"userSearch": {
				MakeArg: func() interface{} {
					var ret [1]UserSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UserSearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UserSearchArg)(nil), args)
						return
					}
					ret, err = i.UserSearch(ctx, typedArgs[0])
					return
				},
			},
			"bulkEmailOrPhoneSearch": {
				MakeArg: func() interface{} {
					var ret [1]BulkEmailOrPhoneSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BulkEmailOrPhoneSearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BulkEmailOrPhoneSearchArg)(nil), args)
						return
					}
					ret, err = i.BulkEmailOrPhoneSearch(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type UserSearchClient struct {
	Cli rpc.GenericClient
}

func (c UserSearchClient) GetNonUserDetails(ctx context.Context, __arg GetNonUserDetailsArg) (res NonUserDetails, err error) {
	err = c.Cli.Call(ctx, "keybase.1.userSearch.getNonUserDetails", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserSearchClient) UserSearch(ctx context.Context, __arg UserSearchArg) (res []APIUserSearchResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.userSearch.userSearch", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c UserSearchClient) BulkEmailOrPhoneSearch(ctx context.Context, __arg BulkEmailOrPhoneSearchArg) (res []EmailOrPhoneNumberSearchResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.userSearch.bulkEmailOrPhoneSearch", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
