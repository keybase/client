package avatars

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Source interface {
	LoadUsers(context.Context, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)
	LoadTeams(context.Context, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)
}

func CreateSourceFromEnv(g *libkb.GlobalContext) Source {
	return NewSimpleSource(g)
}
