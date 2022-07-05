// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_favorites.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type FavoritesChangedArg struct {
	Uid UID `codec:"uid" json:"uid"`
}

type NotifyFavoritesInterface interface {
	FavoritesChanged(context.Context, UID) error
}

func NotifyFavoritesProtocol(i NotifyFavoritesInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyFavorites",
		Methods: map[string]rpc.ServeHandlerDescription{
			"favoritesChanged": {
				MakeArg: func() interface{} {
					var ret [1]FavoritesChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FavoritesChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FavoritesChangedArg)(nil), args)
						return
					}
					err = i.FavoritesChanged(ctx, typedArgs[0].Uid)
					return
				},
			},
		},
	}
}

type NotifyFavoritesClient struct {
	Cli rpc.GenericClient
}

func (c NotifyFavoritesClient) FavoritesChanged(ctx context.Context, uid UID) (err error) {
	__arg := FavoritesChangedArg{Uid: uid}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFavorites.favoritesChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}
