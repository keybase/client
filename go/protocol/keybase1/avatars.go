// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/avatars.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type AvatarUrl string

func (o AvatarUrl) DeepCopy() AvatarUrl {
	return o
}

type AvatarFormat string

func (o AvatarFormat) DeepCopy() AvatarFormat {
	return o
}

type LoadAvatarsRes struct {
	Picmap map[string]map[AvatarFormat]AvatarUrl `codec:"picmap" json:"picmap"`
}

func (o LoadAvatarsRes) DeepCopy() LoadAvatarsRes {
	return LoadAvatarsRes{
		Picmap: (func(x map[string]map[AvatarFormat]AvatarUrl) map[string]map[AvatarFormat]AvatarUrl {
			if x == nil {
				return nil
			}
			ret := make(map[string]map[AvatarFormat]AvatarUrl, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := (func(x map[AvatarFormat]AvatarUrl) map[AvatarFormat]AvatarUrl {
					if x == nil {
						return nil
					}
					ret := make(map[AvatarFormat]AvatarUrl, len(x))
					for k, v := range x {
						kCopy := k.DeepCopy()
						vCopy := v.DeepCopy()
						ret[kCopy] = vCopy
					}
					return ret
				})(v)
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Picmap),
	}
}

type AvatarClearCacheMsg struct {
	Name    string           `codec:"name" json:"name"`
	Formats []AvatarFormat   `codec:"formats" json:"formats"`
	Typ     AvatarUpdateType `codec:"typ" json:"typ"`
}

func (o AvatarClearCacheMsg) DeepCopy() AvatarClearCacheMsg {
	return AvatarClearCacheMsg{
		Name: o.Name,
		Formats: (func(x []AvatarFormat) []AvatarFormat {
			if x == nil {
				return nil
			}
			ret := make([]AvatarFormat, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Formats),
		Typ: o.Typ.DeepCopy(),
	}
}

type LoadUserAvatarsArg struct {
	Names   []string       `codec:"names" json:"names"`
	Formats []AvatarFormat `codec:"formats" json:"formats"`
}

type LoadTeamAvatarsArg struct {
	Names   []string       `codec:"names" json:"names"`
	Formats []AvatarFormat `codec:"formats" json:"formats"`
}

type AvatarsInterface interface {
	LoadUserAvatars(context.Context, LoadUserAvatarsArg) (LoadAvatarsRes, error)
	LoadTeamAvatars(context.Context, LoadTeamAvatarsArg) (LoadAvatarsRes, error)
}

func AvatarsProtocol(i AvatarsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.avatars",
		Methods: map[string]rpc.ServeHandlerDescription{
			"loadUserAvatars": {
				MakeArg: func() interface{} {
					var ret [1]LoadUserAvatarsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadUserAvatarsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadUserAvatarsArg)(nil), args)
						return
					}
					ret, err = i.LoadUserAvatars(ctx, typedArgs[0])
					return
				},
			},
			"loadTeamAvatars": {
				MakeArg: func() interface{} {
					var ret [1]LoadTeamAvatarsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadTeamAvatarsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadTeamAvatarsArg)(nil), args)
						return
					}
					ret, err = i.LoadTeamAvatars(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type AvatarsClient struct {
	Cli rpc.GenericClient
}

func (c AvatarsClient) LoadUserAvatars(ctx context.Context, __arg LoadUserAvatarsArg) (res LoadAvatarsRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.avatars.loadUserAvatars", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c AvatarsClient) LoadTeamAvatars(ctx context.Context, __arg LoadTeamAvatarsArg) (res LoadAvatarsRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.avatars.loadTeamAvatars", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
