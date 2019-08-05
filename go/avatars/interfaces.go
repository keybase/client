package avatars

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Source interface {
	LoadUsers(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)
	LoadTeams(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)

	ClearCacheForName(libkb.MetaContext, string, []keybase1.AvatarFormat) error
	OnDbNuke(libkb.MetaContext) error // Called after leveldb data goes away after db nuke

	StartBackgroundTasks(libkb.MetaContext)
	StopBackgroundTasks(libkb.MetaContext)
}

func CreateSourceFromEnvAndInstall(g *libkb.GlobalContext) (s Source) {
	typ := g.Env.GetAvatarSource()
	switch typ {
	case "simple":
		s = NewSimpleSource()
	case "url":
		s = NewURLCachingSource(time.Hour /* staleThreshold */, 20000)
	case "full":
		maxSize := 10000
		if g.IsMobileAppType() {
			maxSize = 2000
		}
		// When changing staleThreshold here, serverside avatar change
		// notification dismiss time should be adjusted as well.
		s = NewFullCachingSource(time.Hour /* staleThreshold */, maxSize)
	}
	g.AddDbNukeHook(s, fmt.Sprintf("AvatarLoader[%s]", typ))
	return s
}

func ServiceInit(g *libkb.GlobalContext, httpSrv *manager.Srv, source Source) {
	m := libkb.NewMetaContextBackground(g)
	source.StartBackgroundTasks(m)
	NewSrv(g, httpSrv, source) // start the http srv up
	g.PushShutdownHook(func() error {
		source.StopBackgroundTasks(m)
		return nil
	})
}

func allocRes(res *keybase1.LoadAvatarsRes, usernames []string) {
	res.Picmap = make(map[string]map[keybase1.AvatarFormat]keybase1.AvatarUrl)
	for _, u := range usernames {
		res.Picmap[u] = make(map[keybase1.AvatarFormat]keybase1.AvatarUrl)
	}
}
