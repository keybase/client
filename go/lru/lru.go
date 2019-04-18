package lru

import (
	json "encoding/json"
	"reflect"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	context "golang.org/x/net/context"
)

type Cache struct {
	sync.Mutex
	mem     *lru.Cache
	version int
	typ     reflect.Type
	stats   stats
}

type stats struct {
	memHit    int
	diskHit   int
	diskStale int
	miss      int
}

func NewLRU(ctx libkb.LRUContext, sz int, version int, exampleObj interface{}) *Cache {
	cache, err := lru.New(sz)
	if err != nil {
		ctx.GetLog().Fatalf("Bad LRU constructor: %s", err.Error())
	}
	return &Cache{
		mem:     cache,
		version: version,
		typ:     reflect.TypeOf(exampleObj),
	}
}

type diskWrapper struct {
	Version  int           `codec:"v"`
	Data     string        `codex:"d"`
	CachedAt keybase1.Time `codec:"t"`
}

func (c *Cache) ClearMemory() {
	c.mem.Purge()
}

func (c *Cache) Get(ctx context.Context, lctx libkb.LRUContext, k libkb.LRUKeyer) (interface{}, error) {
	c.Lock()
	defer c.Unlock()
	val, ok := c.mem.Get(k.MemKey())
	if ok {
		c.stats.memHit++
		lctx.GetVDebugLog().CLogf(ctx, libkb.VLog3, "lru(%v): mem hit", k.MemKey())
		return val, nil
	}
	var w diskWrapper
	ok, err := lctx.GetKVStore().GetInto(&w, k.DbKey())
	if err != nil {
		return nil, err
	}
	if !ok {
		c.stats.miss++
		lctx.GetVDebugLog().CLogf(ctx, libkb.VLog3, "lru(%v): miss", k.DbKey())
		return nil, nil
	}
	if w.Version != c.version {
		c.stats.diskStale++
		lctx.GetVDebugLog().CLogf(ctx, libkb.VLog0, "lru(%v), old version: %d < %d", k.DbKey(), w.Version, c.version)
		return nil, nil
	}
	var ret interface{}
	if len(w.Data) > 0 {
		tmp := reflect.New(c.typ)
		ret = tmp.Interface()

		if err = jsonw.EnsureMaxDepthBytesDefault([]byte(w.Data)); err != nil {
			return nil, err
		}

		if err = json.Unmarshal([]byte(w.Data), ret); err != nil {
			return nil, err
		}
	}
	c.stats.diskHit++
	lctx.GetVDebugLog().CLogf(ctx, libkb.VLog3, "lru(%v): disk hit", k.DbKey())
	c.mem.Add(k.MemKey(), ret)
	return ret, nil
}

func (c *Cache) Put(ctx context.Context, lctx libkb.LRUContext, k libkb.LRUKeyer, v interface{}) error {
	c.Lock()
	defer c.Unlock()
	var data string
	if v != nil {
		b, err := json.Marshal(v)
		if err != nil {
			return err
		}
		data = string(b)
	}
	w := diskWrapper{
		Version:  c.version,
		Data:     data,
		CachedAt: keybase1.ToTime(lctx.GetClock().Now()),
	}
	lctx.GetKVStore().PutObj(k.DbKey(), nil, w)
	c.mem.Add(k.MemKey(), v)
	return nil
}

func (c *Cache) OnLogout(mctx libkb.MetaContext) error {
	c.ClearMemory()
	return nil
}

func (c *Cache) OnDbNuke(mctx libkb.MetaContext) error {
	c.ClearMemory()
	return nil
}

var _ libkb.LRUer = (*Cache)(nil)
