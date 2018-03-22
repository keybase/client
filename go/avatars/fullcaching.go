package avatars

import (
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/lru"
	"github.com/keybase/client/go/protocol/keybase1"
)

type avatarLoadPair struct {
	name   string
	format keybase1.AvatarFormat
	path   string
}

type avatarLoadSpec struct {
	hits   []avatarLoadPair
	misses []avatarLoadPair
	stales []avatarLoadPair
}

func (a avatarLoadSpec) details(l []avatarLoadPair) (names []string, formats []keybase1.AvatarFormat) {
	fmap := make(map[keybase1.AvatarFormat]bool)
	umap := make(map[string]bool)
	for _, m := range l {
		umap[m.name] = true
		fmap[m.format] = true
	}
	for u := range umap {
		names = append(names, u)
	}
	for f := range fmap {
		formats = append(formats, f)
	}
	return names, formats
}

func (a avatarLoadSpec) missDetails() ([]string, []keybase1.AvatarFormat) {
	return a.details(a.misses)
}

func (a avatarLoadSpec) staleDetails() ([]string, []keybase1.AvatarFormat) {
	return a.details(a.stales)
}

type populateArg struct {
	name   string
	format keybase1.AvatarFormat
	url    keybase1.AvatarUrl
}

type FullCachingSource struct {
	libkb.Contextified

	diskLRU        *lru.DiskLRU
	staleThreshold time.Duration
	fallbackSource Source
	simpleSource   Source
	httpSrv        *libkb.HTTPSrv
	fallbackMode   bool

	populateCacheCh chan populateArg

	// testing
	populateSuccessCh chan struct{}
	tempDir           string
	forceHTTPSrv      bool
}

var _ Source = (*FullCachingSource)(nil)

func NewFullCachingSource(g *libkb.GlobalContext, staleThreshold time.Duration, size int,
	fallbackSource Source) *FullCachingSource {
	return &FullCachingSource{
		Contextified:   libkb.NewContextified(g),
		diskLRU:        lru.NewDiskLRU("avatars", 1, size),
		staleThreshold: staleThreshold,
		fallbackSource: fallbackSource,
		simpleSource:   NewSimpleSource(g),
		httpSrv:        libkb.NewHTTPSrv(g, libkb.NewPortRangeListenerSource(7000, 8000)),
	}
}

func (c *FullCachingSource) StartBackgroundTasks() {
	c.fallbackSource.StartBackgroundTasks()
	go c.monitorAppState()
	c.populateCacheCh = make(chan populateArg, 100)
	for i := 0; i < 10; i++ {
		go c.populateCacheWorker()
	}
	// On mobile, using an HTTP interface is simpler so use it instead.
	if c.httpServerMode() {
		c.startHTTPServer(context.Background())
	}
}

func (c *FullCachingSource) StopBackgroundTasks() {
	c.fallbackSource.StopBackgroundTasks()
	close(c.populateCacheCh)
	c.fallbackMode = false
	c.diskLRU.Flush(context.Background(), c.G())
	if c.httpServerMode() {
		c.httpSrv.Stop()
	}
}

func (c *FullCachingSource) httpServerMode() bool {
	return c.forceHTTPSrv || c.G().GetAppType() == libkb.MobileAppType
}

func (c *FullCachingSource) debug(ctx context.Context, msg string, args ...interface{}) {
	c.G().Log.CDebugf(ctx, "Avatars.FullCachingSource: %s", fmt.Sprintf(msg, args...))
}

func (c *FullCachingSource) avatarKey(name string, format keybase1.AvatarFormat) string {
	return fmt.Sprintf("%s:%s", name, format.String())
}

func (c *FullCachingSource) isStale(item lru.DiskLRUEntry) bool {
	return c.G().GetClock().Now().Sub(item.Ctime) > c.staleThreshold
}

func (c *FullCachingSource) startHTTPServer(ctx context.Context) {
	if err := c.httpSrv.Start(); err != nil {
		c.debug(ctx, "failed to start local http server, defaulting to simple mode")
		c.fallbackMode = true
	} else {
		c.fallbackMode = false
		c.httpSrv.HandleFunc("/a", c.serveHTTPAvatar)
	}
}

func (c *FullCachingSource) monitorAppState() {
	c.debug(context.Background(), "monitorAppState: starting up")
	for {
		state := <-c.G().AppState.NextUpdate()
		ctx := context.Background()
		switch state {
		case keybase1.AppState_FOREGROUND:
			c.debug(ctx, "monitorAppState: foregrounded")
			if c.httpServerMode() && !c.httpSrv.Active() {
				c.debug(ctx, "monitorAppState: starting http server")
				c.startHTTPServer(ctx)
			}
		case keybase1.AppState_BACKGROUND:
			c.debug(ctx, "monitorAppState: backgrounded")
			if c.httpServerMode() && c.httpSrv.Active() {
				c.debug(ctx, "monitorAppState: backgrounded, stopping http server")
				c.httpSrv.Stop()
			}
			c.diskLRU.Flush(ctx, c.G())
		}
	}
}

func (c *FullCachingSource) specLoad(ctx context.Context, names []string, formats []keybase1.AvatarFormat) (res avatarLoadSpec, err error) {
	for _, name := range names {
		for _, format := range formats {
			key := c.avatarKey(name, format)
			found, entry, err := c.diskLRU.Get(ctx, c.G(), key)
			if err != nil {
				return res, err
			}
			lp := avatarLoadPair{
				name:   name,
				format: format,
			}

			// If we found something in the index, let's make sure we have it on the disk as well.
			if found {
				lp.path = entry.Value.(string)
				var file *os.File
				if file, err = os.Open(lp.path); err != nil {
					c.debug(ctx, "specLoad: error loading hit: file: %s err: %s", lp.path, err)
					c.diskLRU.Remove(ctx, c.G(), key)
					// Not a true hit if we don't have it on the disk as well
					found = false
				} else {
					file.Close()
				}
			}
			if found {
				if c.isStale(entry) {
					res.stales = append(res.stales, lp)
				} else {
					res.hits = append(res.hits, lp)
				}
			} else {
				res.misses = append(res.misses, lp)
			}
		}
	}
	return res, nil
}

func (c *FullCachingSource) getCacheDir() string {
	if len(c.tempDir) > 0 {
		return c.tempDir
	}
	return c.G().GetCacheDir()
}

func (c *FullCachingSource) commitAvatarToDisk(ctx context.Context, data io.ReadCloser, previousPath string) (path string, err error) {
	var file *os.File
	if len(previousPath) > 0 {
		// We already have the image, let's re-use the same file
		c.debug(ctx, "commitAvatarToDisk: using previous path: %s", previousPath)
		file, err = os.OpenFile(previousPath, os.O_RDWR, os.ModeAppend)
	} else {
		file, err = ioutil.TempFile(c.getCacheDir(), "avatar")
	}
	if err != nil {
		return path, err
	}
	defer file.Close()
	_, err = io.Copy(file, data)
	if err != nil {
		return path, err
	}
	path = file.Name()
	return path, nil
}

func (c *FullCachingSource) removeFile(ctx context.Context, ent *lru.DiskLRUEntry) {
	if ent != nil {
		file := ent.Value.(string)
		if err := os.Remove(file); err != nil {
			c.debug(ctx, "removeFile: failed to remove: file: %s err: %s", file, err)
		} else {
			c.debug(ctx, "removeFile: successfully removed: %s", file)
		}
	}
}

func (c *FullCachingSource) populateCacheWorker() {
	for arg := range c.populateCacheCh {
		ctx := context.Background()
		c.debug(ctx, "populateCacheWorker: fetching: name: %s format: %s url: %s", arg.name,
			arg.format, arg.url)
		// Grab image data first
		resp, err := http.Get(arg.url.String())
		if err != nil {
			c.debug(ctx, "populateCacheWorker: failed to download avatar: %s", err)
			continue
		}
		// Find any previous path we stored this image at on the disk
		var previousPath string
		key := c.avatarKey(arg.name, arg.format)
		found, ent, err := c.diskLRU.Get(ctx, c.G(), key)
		if err != nil {
			c.debug(ctx, "populateCacheWorker: failed to read previous entry in LRU: %s", err)
			continue
		}
		if found {
			previousPath = ent.Value.(string)
		}

		// Save to disk
		path, err := c.commitAvatarToDisk(ctx, resp.Body, previousPath)
		if err != nil {
			c.debug(ctx, "populateCacheWorker: failed to write to disk: %s", err)
			continue
		}
		evicted, err := c.diskLRU.Put(ctx, c.G(), key, path)
		if err != nil {
			c.debug(ctx, "populateCacheWorker: failed to put into LRU: %s", err)
			continue
		}
		// Remove any evicted file (if there is one)
		c.removeFile(ctx, evicted)

		if c.populateSuccessCh != nil {
			c.populateSuccessCh <- struct{}{}
		}
	}
}

func (c *FullCachingSource) dispatchPopulateFromRes(ctx context.Context, res keybase1.LoadAvatarsRes) {
	for name, rec := range res.Picmap {
		for format, url := range rec {
			if url != "" {
				c.populateCacheCh <- populateArg{
					name:   name,
					format: format,
					url:    url,
				}
			}
		}
	}
}

func (c *FullCachingSource) serveHTTPAvatar(w http.ResponseWriter, req *http.Request) {
	path := req.URL.Query().Get("p")
	// Check path prefix
	file, err := os.Open(path)
	if err != nil {
		c.debug(context.Background(), "serveHTTPAvatar: failed to read: file: %s err: %s", path, err)
		return
	}
	c.debug(context.Background(), "serveHTTPAvatar: successfully read file: %s", path)
	w.Header().Add("Cache-Control", "no-cache")
	io.Copy(w, file)
	file.Close()
}

func (c *FullCachingSource) makeURL(path string) keybase1.AvatarUrl {
	if c.httpServerMode() {
		addr, _ := c.httpSrv.Addr()
		return keybase1.MakeAvatarURL(fmt.Sprintf("http://%s/a?p=%s", addr, path))
	}
	return keybase1.MakeAvatarURL(fmt.Sprintf("file://%s", path))
}

func (c *FullCachingSource) mergeRes(res *keybase1.LoadAvatarsRes, m keybase1.LoadAvatarsRes) {
	for username, rec := range m.Picmap {
		for format, url := range rec {
			res.Picmap[username][format] = url
		}
	}
}

func (c *FullCachingSource) loadNames(ctx context.Context, names []string, formats []keybase1.AvatarFormat,
	remoteFetch func(context.Context, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)) (res keybase1.LoadAvatarsRes, err error) {
	loadSpec, err := c.specLoad(ctx, names, formats)
	if err != nil {
		return res, err
	}
	c.debug(ctx, "loadNames: hits: %d stales: %d misses: %d", len(loadSpec.hits), len(loadSpec.stales),
		len(loadSpec.misses))

	// Fill in the hits
	allocRes(&res, names)
	for _, hit := range loadSpec.hits {
		res.Picmap[hit.name][hit.format] = c.makeURL(hit.path)
	}
	// Fill in stales
	for _, stale := range loadSpec.stales {
		res.Picmap[stale.name][stale.format] = c.makeURL(stale.path)
	}

	// Go get the misses
	missNames, missFormats := loadSpec.missDetails()
	if len(missNames) > 0 {
		loadRes, err := remoteFetch(ctx, missNames, missFormats)
		if err == nil {
			c.mergeRes(&res, loadRes)
			c.dispatchPopulateFromRes(ctx, loadRes)
		} else {
			c.debug(ctx, "loadNames: failed to load server miss reqs: %s", err)
		}
	}
	// Spawn off a goroutine to reload stales
	staleNames, staleFormats := loadSpec.staleDetails()
	if len(staleNames) > 0 {
		go func() {
			c.debug(context.Background(), "loadNames: spawning stale background load: names: %d",
				len(staleNames))
			loadRes, err := remoteFetch(context.Background(), staleNames, staleFormats)
			if err == nil {
				c.dispatchPopulateFromRes(ctx, loadRes)
			} else {
				c.debug(ctx, "loadNames: failed to load server stale reqs: %s", err)
			}
		}()
	}
	return res, nil
}

func (c *FullCachingSource) LoadUsers(ctx context.Context, usernames []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer c.G().Trace("FullCachingSource.LoadUsers", func() error { return err })()
	// If we failed to startup our HTTP server, we just don't do any caching
	if c.fallbackMode {
		return c.fallbackSource.LoadUsers(ctx, usernames, formats)
	}
	return c.loadNames(ctx, usernames, formats, c.simpleSource.LoadUsers)
}

func (c *FullCachingSource) LoadTeams(ctx context.Context, teams []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer c.G().Trace("FullCachingSource.LoadTeams", func() error { return err })()
	if c.fallbackMode {
		return c.fallbackSource.LoadTeams(ctx, teams, formats)
	}
	return c.loadNames(ctx, teams, formats, c.simpleSource.LoadTeams)
}
