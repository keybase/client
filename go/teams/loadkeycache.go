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

func (c *loadKeyCache) loadKeyV2(mctx libkb.MetaContext, uid keybase1.UID, kid keybase1.KID) (
	uv keybase1.UserVersion, pubKey *keybase1.PublicKeyV2NaCl, linkMap linkMapT, err error) {
	mctx, tbs := mctx.WithTimeBuckets()
	defer tbs.Record("loadKeyCache.loadKeyV2")()

	// Look in the cache first
	m2, ok := c.userKeyCache[uid]
	if ok {
		v, ok := m2[kid]
		if ok {
			c.cacheHits++
			return v.UV, &v.Key, c.userLinkMapCache[uid], nil
		}
	}

	// Load the user. LoadKeyV2 handles punching through the cache when needed.
	user, upak, _, err := mctx.G().GetUPAKLoader().LoadKeyV2(mctx.Ctx(), uid, kid)
	if err != nil {
		return uv, pubKey, linkMap, err
	}
	if user == nil || upak == nil {
		return uv, pubKey, linkMap, libkb.NotFoundError{}
	}

	// Put all the user's keys into the cache
	c.userLinkMapCache[uid] = upak.SeqnoLinkIDs
	if c.userKeyCache[uid] == nil {
		c.userKeyCache[uid] = make(map[keybase1.KID]uvAndKey)
	}
	for _, user := range append(upak.PastIncarnations, upak.Current) {
		pubKey, ok := user.DeviceKeys[kid]
		if ok {
			c.userKeyCache[uid][kid] = uvAndKey{
				UV:  user.ToUserVersion(),
				Key: pubKey,
			}
		}
	}

	// Get from the just-updated cache
	v, ok := c.userKeyCache[uid][kid]
	if !ok {
		return uv, nil, nil, libkb.NotFoundError{Msg: "Not found: Key for user"}
	}
	return v.UV, &v.Key, c.userLinkMapCache[uid], nil
}
