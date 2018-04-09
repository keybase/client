package stellar

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func loadMeUpk(ctx context.Context, g *libkb.GlobalContext) (res *keybase1.UserPlusKeysV2, err error) {
	loadMeArg := libkb.NewLoadUserArgWithContext(ctx, g).
		WithUID(g.ActiveDevice.UID()).
		WithSelf(true)
	upkv2, _, err := g.GetUPAKLoader().LoadV2(loadMeArg)
	if err != nil {
		return res, err
	}
	if upkv2 == nil {
		return res, fmt.Errorf("could not load logged-in user")
	}
	return &upkv2.Current, nil
}
