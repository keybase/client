package avatars

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func CreateSourceFromEnvAndInstall(g *libkb.GlobalContext) {
	var s libkb.AvatarLoaderSource
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
	g.SetAvatarLoader(s)
}

func ServiceInit(g *libkb.GlobalContext, httpSrv *manager.Srv, source libkb.AvatarLoaderSource) *Srv {
	m := libkb.NewMetaContextBackground(g)
	source.StartBackgroundTasks(m)
	s := NewSrv(g, httpSrv, source) // start the http srv up
	g.PushShutdownHook(func(mctx libkb.MetaContext) error {
		source.StopBackgroundTasks(mctx)
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
