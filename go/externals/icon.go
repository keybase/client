package externals

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func normalizeIconKey(key string) string {
	switch key {
	case "bitcoin":
		return "btc"
	case "zcash.t", "zcash.z", "zcash.s":
		return "zcash"
	case "http", "https", "dns":
		return "web"
	default:
		return key
	}
}

func MakeIcons(mctx libkb.MetaContext, serviceKey, imgName string, size int) (res []keybase1.SizedImage) {
	for _, factor := range []int{1, 2} {
		factorix := ""
		if factor > 1 {
			factorix = fmt.Sprintf("@%vx", factor)
		}

		site := libkb.SiteURILookup[mctx.G().Env.GetRunMode()]
		if mctx.G().Env.GetRunMode() == libkb.DevelRunMode {
			site = strings.Replace(site, "localhost", "127.0.0.1", 1)
		}

		res = append(res, keybase1.SizedImage{
			Path: strings.Join([]string{site,
				"images/paramproofs/services",
				normalizeIconKey(serviceKey),
				fmt.Sprintf("%v_%v%v.png", imgName, size, factorix),
			}, "/"),
			Width: size * factor,
		})
	}
	return res
}
