package stellar

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func loadUvUpk(ctx context.Context, g *libkb.GlobalContext, uv keybase1.UserVersion) (res *keybase1.UserPlusKeysV2, err error) {
	loadArg := libkb.NewLoadUserArgWithContext(ctx, g).WithUID(uv.Uid)
	upkv2, _, err := g.GetUPAKLoader().LoadV2(loadArg)
	if err != nil {
		return nil, err
	}
	if upkv2 == nil {
		return nil, fmt.Errorf("could not load user: %v (nil)", uv.String())
	}
	if upkv2.Current.EldestSeqno == uv.EldestSeqno {
		return &upkv2.Current, nil
	}
	for _, incarnation := range upkv2.PastIncarnations {
		if incarnation.EldestSeqno == uv.EldestSeqno {
			return &incarnation, nil
		}
	}
	return nil, fmt.Errorf("could not load user: %v (v)", uv.String())
}

func loadOwnLatestPuk(ctx context.Context, g *libkb.GlobalContext) (gen keybase1.PerUserKeyGeneration, seed libkb.PerUserKeySeed, err error) {
	pukring, err := g.GetPerUserKeyring()
	if err != nil {
		return 0, seed, err
	}
	m := libkb.NewMetaContext(ctx, g)
	err = pukring.Sync(m)
	if err != nil {
		return 0, seed, err
	}
	gen = pukring.CurrentGeneration()
	seed, err = pukring.GetSeedByGeneration(m, gen)
	return gen, seed, err
}
