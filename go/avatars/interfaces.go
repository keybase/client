package avatars

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Source interface {
	LoadUsers(ctx context.Context, usernames []string, formats []keybase1.AvatarFormat) (keybase1.LoadUserAvatarsRes, error)
}

func CreateSourceFromEnv(g *libkb.GlobalContext) Source {
	return NewSimpleSource(g)
}
