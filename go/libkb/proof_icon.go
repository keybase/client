package libkb

import (
	"fmt"
	"strings"

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

const ProofIconTypeSmall = "logo_black"
const ProofIconTypeSmallDarkmode = "logo_white"
const ProofIconTypeFull = "logo_full"
const ProofIconTypeFullDarkmode = "logo_full_darkmode"

func MakeProofIcons(mctx MetaContext, serviceKey, iconType string, size int) (res []keybase1.SizedImage) {
	for _, factor := range []int{1, 2} {
		factorix := ""
		if factor > 1 {
			factorix = fmt.Sprintf("@%vx", factor)
		}

		site := SiteURILookup[mctx.G().Env.GetRunMode()]
		if mctx.G().Env.GetRunMode() == DevelRunMode {
			site = strings.Replace(site, "localhost", "127.0.0.1", 1)
		}

		res = append(res, keybase1.SizedImage{
			Path: strings.Join([]string{site,
				"images/paramproofs/services",
				normalizeIconKey(serviceKey),
				// The 'c' query parameter is just for cache busting. It's ignored by the server.
				fmt.Sprintf("%v_%v%v.png?c=3", iconType, size, factorix),
			}, "/"),
			Width: size * factor,
		})
	}
	return res
}
