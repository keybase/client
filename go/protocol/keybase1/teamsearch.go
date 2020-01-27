// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/teamsearch.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type TeamSearchItem struct {
	Id           TeamID   `codec:"id" json:"id"`
	Name         string   `codec:"name" json:"name"`
	Description  *string  `codec:"description,omitempty" json:"description,omitempty"`
	MemberCount  int      `codec:"memberCount" json:"memberCount"`
	LastActive   Time     `codec:"lastActive" json:"lastActive"`
	InTeam       bool     `codec:"inTeam" json:"inTeam"`
	PublicAdmins []string `codec:"publicAdmins" json:"publicAdmins"`
}

func (o TeamSearchItem) DeepCopy() TeamSearchItem {
	return TeamSearchItem{
		Id:   o.Id.DeepCopy(),
		Name: o.Name,
		Description: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Description),
		MemberCount: o.MemberCount,
		LastActive:  o.LastActive.DeepCopy(),
		InTeam:      o.InTeam,
		PublicAdmins: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.PublicAdmins),
	}
}

type TeamSearchRes struct {
	Results []TeamSearchItem `codec:"results" json:"results"`
}

func (o TeamSearchRes) DeepCopy() TeamSearchRes {
	return TeamSearchRes{
		Results: (func(x []TeamSearchItem) []TeamSearchItem {
			if x == nil {
				return nil
			}
			ret := make([]TeamSearchItem, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Results),
	}
}

type TeamSearchArg struct {
	Query string `codec:"query" json:"query"`
	Limit int    `codec:"limit" json:"limit"`
}

type TeamSearchInterface interface {
	TeamSearch(context.Context, TeamSearchArg) (TeamSearchRes, error)
}

func TeamSearchProtocol(i TeamSearchInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.teamSearch",
		Methods: map[string]rpc.ServeHandlerDescription{
			"teamSearch": {
				MakeArg: func() interface{} {
					var ret [1]TeamSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamSearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamSearchArg)(nil), args)
						return
					}
					ret, err = i.TeamSearch(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type TeamSearchClient struct {
	Cli rpc.GenericClient
}

func (c TeamSearchClient) TeamSearch(ctx context.Context, __arg TeamSearchArg) (res TeamSearchRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.teamSearch.teamSearch", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
