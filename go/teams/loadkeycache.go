package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type uvAndKey struct {
	UV  keybase1.UserVersion
	Key keybase1.PublicKeyV2NaCl
}

// loadKeyCache is a short-lived cache for loading keys and linkmaps for TeamLoader.
// It must be short-lived since it has no expiration or eviction.
// Not threadsafe.
type loadKeyCache struct {
	userKeyCache     map[keybase1.UID]map[keybase1.KID]uvAndKey
	userLinkMapCache map[keybase1.UID]map[keybase1.Seqno]keybase1.LinkID
	cacheHits        int64
}

func newLoadKeyCache() *loadKeyCache {
	return &loadKeyCache{
		userKeyCache:     make(map[keybase1.UID]map[keybase1.KID]uvAndKey),
		userLinkMapCache: make(map[keybase1.UID]map[keybase1.Seqno]keybase1.LinkID),
	}
}

func (c *loadKeyCache) loadKeyV2(mctx libkb.MetaContext, world LoaderContext, uid keybase1.UID, kid keybase1.KID) (
	uv keybase1.UserVersion, pubKey *keybase1.PublicKeyV2NaCl, linkMap linkMapT, err error) {
	mctx, tbs := mctx.WithTimeBuckets()
	defer tbs.Record("loadKeyCache.loadKeyV2")()

	m2, ok := c.userKeyCache[uid]
	if ok {
		v, ok := m2[kid]
		if ok {
			c.cacheHits++
			return v.UV, &v.Key, c.userLinkMapCache[uid], nil
		}
	}

	uv, pubKey, linkMap, err = world.loadKeyV2(mctx.Ctx(), uid, kid)
	if err != nil {
		return
	}

	if c.userKeyCache[uid] == nil {
		c.userKeyCache[uid] = make(map[keybase1.KID]uvAndKey)
	}
	c.userKeyCache[uid][kid] = uvAndKey{
		UV:  uv,
		Key: *pubKey,
	}
	c.userLinkMapCache[uid] = linkMap
	return uv, pubKey, linkMap, nil
}
