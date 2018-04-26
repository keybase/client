package libkb

import (
	"encoding/hex"

	lru "github.com/hashicorp/golang-lru"
	jsonw "github.com/keybase/go-jsonw"
)

type PayloadCache struct {
	Contextified
	cache *lru.Cache
}

func NewPayloadCache(g *GlobalContext, maxNumElements int) *PayloadCache {
	c, err := lru.New(maxNumElements)
	if err != nil {
		g.Log.Warning("failed to create PayloadCache LRU: %s", err)
		c = nil
	}

	return &PayloadCache{
		Contextified: NewContextified(g),
		cache:        c,
	}
}

func (p *PayloadCache) GetOrPrime(link *ChainLink) (*jsonw.Wrapper, error) {
	// check if failed to create cache in NewPayloadCache
	if p.cache == nil {
		p.G().Log.Debug("PayloadCache no LRU, unmarshal for %x", link.unpacked.payloadHash)
		payload, err := link.unpacked.Payload()
		if err != nil {
			return nil, err
		}
		return jsonw.Unmarshal(payload)
	}

	key := hex.EncodeToString(link.unpacked.payloadHash)

	obj, ok := p.cache.Get(key)
	if ok {
		jw, ok := obj.(*jsonw.Wrapper)
		if ok {
			return jw, nil
		}
	}

	payload, err := link.unpacked.Payload()
	if err != nil {
		return nil, err
	}

	jw, err := jsonw.Unmarshal(payload)
	if err != nil {
		return nil, err
	}

	p.cache.Add(key, jw)

	return jw, nil
}
