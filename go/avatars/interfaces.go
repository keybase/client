package avatars

import (
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Source interface {
	LoadUsers(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)
	LoadTeams(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)

	ClearCacheForName(libkb.MetaContext, string, []keybase1.AvatarFormat) error
	OnCacheCleared(libkb.MetaContext) // Called after leveldb data goes away after db nuke

	StartBackgroundTasks(libkb.MetaContext)
	StopBackgroundTasks(libkb.MetaContext)
}

func CreateSourceFromEnv(g *libkb.GlobalContext) (s Source) {
	typ := g.Env.GetAvatarSource()
	switch typ {
	case "simple":
		s = NewSimpleSource()
	case "url":
		s = NewURLCachingSource(time.Hour /* staleThreshold */, 20000)
	case "full":
		maxSize := 10000
		if g.GetAppType() == libkb.MobileAppType {
			maxSize = 2000
		}
		// When changing staleThreshold here, serverside avatar change
		// notification dismiss time should be adjusted as well.
		s = NewFullCachingSource(time.Hour /* staleThreshold */, maxSize)
	}
	m := libkb.NewMetaContextBackground(g)
	s.StartBackgroundTasks(m)
	g.PushShutdownHook(func() error {
		s.StopBackgroundTasks(m)
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
