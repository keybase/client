package avatars

import (
	"context"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Source interface {
	LoadUsers(context.Context, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)
	LoadTeams(context.Context, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)

	StartBackgroundTasks()
	StopBackgroundTasks()
}

func CreateSourceFromEnv(g *libkb.GlobalContext) (s Source) {
	typ := g.Env.GetAvatarSource()
	switch typ {
	case "simple":
		s = NewSimpleSource(g)
	case "url":
		s = NewURLCachingSource(g, time.Hour, 20000)
	case "full":
		maxSize := 10000
		if g.GetAppType() == libkb.MobileAppType {
			maxSize = 2000
		}
		s = NewFullCachingSource(g, time.Hour, maxSize)
	}
	s.StartBackgroundTasks()
	g.PushShutdownHook(func() error {
		s.StopBackgroundTasks()
		return nil
	})
	return s
}

func allocRes(res *keybase1.LoadAvatarsRes, usernames []string) {
	res.Picmap = make(map[string]map[keybase1.AvatarFormat]keybase1.AvatarUrl)
	for _, u := range usernames {
		res.Picmap[u] = make(map[keybase1.AvatarFormat]keybase1.AvatarUrl)
	}
}
