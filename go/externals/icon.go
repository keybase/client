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

func ServiceHasFullIcon(key string) bool {
	switch normalizeIconKey(key) {
	case "btc", "facebook", "github", "hackernews", "pgp", "reddit", "rooter",
		"stellar", "twitter", "web", "zcash":
		return false
	}
	// Parameterized proofs should have full icons.
	return true
}

func MakeIcons(mctx libkb.MetaContext, serviceKey, imgName string, size int) (res []keybase1.SizedImage) {
	for _, factor := range []int{1, 2} {
		factorix := ""
		if factor > 1 {
			factorix = fmt.Sprintf("@%vx", factor)
		}

		res = append(res, keybase1.SizedImage{
			Path: strings.Join([]string{
				libkb.SiteURILookup[mctx.G().Env.GetRunMode()],
				"images/paramproofs/services",
				normalizeIconKey(serviceKey),
				fmt.Sprintf("%v_%v%v.png", imgName, size, factorix),
			}, "/"),
			Width: size * factor,
		})
	}
	return res
}
