package avatars

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/url"
	"os"
	"path/filepath"
	"sync"
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
	diskLRU        *lru.DiskLRU
	staleThreshold time.Duration
	simpleSource   Source

	populateCacheCh chan populateArg

	prepareDirs sync.Once

	// testing
	populateSuccessCh chan struct{}
	tempDir           string
}

var _ Source = (*FullCachingSource)(nil)

func NewFullCachingSource(staleThreshold time.Duration, size int) *FullCachingSource {
	return &FullCachingSource{
		diskLRU:        lru.NewDiskLRU("avatars", 1, size),
		staleThreshold: staleThreshold,
		simpleSource:   NewSimpleSource(),
	}
}

func (c *FullCachingSource) StartBackgroundTasks(m libkb.MetaContext) {
	go c.monitorAppState(m)
	c.populateCacheCh = make(chan populateArg, 100)
	for i := 0; i < 10; i++ {
		go c.populateCacheWorker(m)
	}
	go lru.CleanOutOfSyncWithDelay(m, c.diskLRU, c.getCacheDir(m), 10*time.Second)
}

func (c *FullCachingSource) StopBackgroundTasks(m libkb.MetaContext) {
	close(c.populateCacheCh)
	if err := c.diskLRU.Flush(m.Ctx(), m.G()); err != nil {
		c.debug(m, "StopBackgroundTasks: unable to flush diskLRU %v", err)
	}
}

func (c *FullCachingSource) debug(m libkb.MetaContext, msg string, args ...interface{}) {
	m.Debug("Avatars.FullCachingSource: %s", fmt.Sprintf(msg, args...))
}

func (c *FullCachingSource) avatarKey(name string, format keybase1.AvatarFormat) string {
	return fmt.Sprintf("%s:%s", name, format.String())
}

func (c *FullCachingSource) isStale(m libkb.MetaContext, item lru.DiskLRUEntry) bool {
	return m.G().GetClock().Now().Sub(item.Ctime) > c.staleThreshold
}

func (c *FullCachingSource) monitorAppState(m libkb.MetaContext) {
	c.debug(m, "monitorAppState: starting up")
	state := keybase1.MobileAppState_FOREGROUND
	for {
		state = <-m.G().MobileAppState.NextUpdate(&state)
		switch state {
		case keybase1.MobileAppState_BACKGROUND:
			c.debug(m, "monitorAppState: backgrounded")
			if err := c.diskLRU.Flush(m.Ctx(), m.G()); err != nil {
				c.debug(m, "monitorAppState: unable to flush diskLRU %v", err)
			}
		}
	}
}

func (c *FullCachingSource) specLoad(m libkb.MetaContext, names []string, formats []keybase1.AvatarFormat) (res avatarLoadSpec, err error) {
	for _, name := range names {
		for _, format := range formats {
			key := c.avatarKey(name, format)
			found, entry, err := c.diskLRU.Get(m.Ctx(), m.G(), key)
			if err != nil {
				return res, err
			}
			lp := avatarLoadPair{
				name:   name,
				format: format,
			}

			// If we found something in the index, let's make sure we have it on the disk as well.
			if found {
				lp.path = c.normalizeFilenameFromCache(m, entry.Value.(string))
				var file *os.File
				if file, err = os.Open(lp.path); err != nil {
					c.debug(m, "specLoad: error loading hit: file: %s err: %s", lp.path, err)
					if err := c.diskLRU.Remove(m.Ctx(), m.G(), key); err != nil {
						c.debug(m, "specLoad: unable to remove from LRU %v", err)
					}
					// Not a true hit if we don't have it on the disk as well
					found = false
				} else {
					file.Close()
				}
			}
			if found {
				if c.isStale(m, entry) {
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

func (c *FullCachingSource) getCacheDir(m libkb.MetaContext) string {
	if len(c.tempDir) > 0 {
		return c.tempDir
	}
	return filepath.Join(m.G().GetCacheDir(), "avatars")
}

func (c *FullCachingSource) getFullFilename(fileName string) string {
	return fileName + ".avatar"
}

// normalizeFilenameFromCache substitutes the existing cache dir value into the
// file path since it's possible for the path to the cache dir to change,
// especially on mobile.
func (c *FullCachingSource) normalizeFilenameFromCache(mctx libkb.MetaContext, file string) string {
	file = filepath.Base(file)
	return filepath.Join(c.getCacheDir(mctx), file)
}

func (c *FullCachingSource) commitAvatarToDisk(m libkb.MetaContext, data io.ReadCloser, previousPath string) (path string, err error) {
	c.prepareDirs.Do(func() {
		err := os.MkdirAll(c.getCacheDir(m), os.ModePerm)
		c.debug(m, "creating directory for avatars %q: %v", c.getCacheDir(m), err)
	})

	var file *os.File
	shouldRename := false
	if len(previousPath) > 0 {
		// We already have the image, let's re-use the same file
		c.debug(m, "commitAvatarToDisk: using previous path: %s", previousPath)
		if file, err = os.OpenFile(previousPath, os.O_RDWR, os.ModeAppend); err != nil {
			// NOTE: Even if we don't have this file anymore (e.g. user
			// raced us to remove it manually), OpenFile will not error
			// out, but create a new file on given path.
			return path, err
		}
		path = file.Name()
	} else {
		if file, err = ioutil.TempFile(c.getCacheDir(m), "avatar"); err != nil {
			return path, err
		}
		shouldRename = true
	}
	_, err = io.Copy(file, data)
	file.Close()
	if err != nil {
		return path, err
	}
	// Rename with correct extension
	if shouldRename {
		path = c.getFullFilename(file.Name())
		if err = os.Rename(file.Name(), path); err != nil {
			return path, err
		}
	}
	return path, nil
}

func (c *FullCachingSource) removeFile(m libkb.MetaContext, ent *lru.DiskLRUEntry) {
	if ent != nil {
		file := c.normalizeFilenameFromCache(m, ent.Value.(string))
		if err := os.Remove(file); err != nil {
			c.debug(m, "removeFile: failed to remove: file: %s err: %s", file, err)
		} else {
			c.debug(m, "removeFile: successfully removed: %s", file)
		}
	}
}

func (c *FullCachingSource) populateCacheWorker(m libkb.MetaContext) {
	for arg := range c.populateCacheCh {
		c.debug(m, "populateCacheWorker: fetching: name: %s format: %s url: %s", arg.name,
			arg.format, arg.url)
		// Grab image data first
		resp, err := libkb.ProxyHTTPGet(m.G().Env, arg.url.String())
		if err != nil {
			c.debug(m, "populateCacheWorker: failed to download avatar: %s", err)
			continue
		}
		// Find any previous path we stored this image at on the disk
		var previousPath string
		key := c.avatarKey(arg.name, arg.format)
		found, ent, err := c.diskLRU.Get(m.Ctx(), m.G(), key)
		if err != nil {
			c.debug(m, "populateCacheWorker: failed to read previous entry in LRU: %s", err)
			libkb.DiscardAndCloseBody(resp)
			continue
		}
		if found {
			previousPath = c.normalizeFilenameFromCache(m, ent.Value.(string))
		}

		// Save to disk
		path, err := c.commitAvatarToDisk(m, resp.Body, previousPath)
		libkb.DiscardAndCloseBody(resp)
		if err != nil {
			c.debug(m, "populateCacheWorker: failed to write to disk: %s", err)
			continue
		}
		evicted, err := c.diskLRU.Put(m.Ctx(), m.G(), key, path)
		if err != nil {
			c.debug(m, "populateCacheWorker: failed to put into LRU: %s", err)
			continue
		}
		// Remove any evicted file (if there is one)
		c.removeFile(m, evicted)

		if c.populateSuccessCh != nil {
			c.populateSuccessCh <- struct{}{}
		}
	}
}

func (c *FullCachingSource) dispatchPopulateFromRes(m libkb.MetaContext, res keybase1.LoadAvatarsRes) {
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

func (c *FullCachingSource) makeURL(m libkb.MetaContext, path string) keybase1.AvatarUrl {
	raw := fmt.Sprintf("file://%s", fileUrlize(path))
	u, err := url.Parse(raw)
	if err != nil {
		c.debug(m, "makeURL: invalid URL: %s", err)
		return keybase1.MakeAvatarURL("")
	}
	final := fmt.Sprintf("file://%s", u.EscapedPath())
	return keybase1.MakeAvatarURL(final)
}

func (c *FullCachingSource) mergeRes(res *keybase1.LoadAvatarsRes, m keybase1.LoadAvatarsRes) {
	for username, rec := range m.Picmap {
		for format, url := range rec {
			res.Picmap[username][format] = url
		}
	}
}

func (c *FullCachingSource) loadNames(m libkb.MetaContext, names []string, formats []keybase1.AvatarFormat,
	remoteFetch func(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)) (res keybase1.LoadAvatarsRes, err error) {
	loadSpec, err := c.specLoad(m, names, formats)
	if err != nil {
		return res, err
	}
	c.debug(m, "loadNames: hits: %d stales: %d misses: %d", len(loadSpec.hits), len(loadSpec.stales),
		len(loadSpec.misses))

	// Fill in the hits
	allocRes(&res, names)
	for _, hit := range loadSpec.hits {
		res.Picmap[hit.name][hit.format] = c.makeURL(m, hit.path)
	}
	// Fill in stales
	for _, stale := range loadSpec.stales {
		res.Picmap[stale.name][stale.format] = c.makeURL(m, stale.path)
	}

	// Go get the misses
	missNames, missFormats := loadSpec.missDetails()
	if len(missNames) > 0 {
		loadRes, err := remoteFetch(m, missNames, missFormats)
		if err == nil {
			c.mergeRes(&res, loadRes)
			c.dispatchPopulateFromRes(m, loadRes)
		} else {
			c.debug(m, "loadNames: failed to load server miss reqs: %s", err)
		}
	}
	// Spawn off a goroutine to reload stales
	staleNames, staleFormats := loadSpec.staleDetails()
	if len(staleNames) > 0 {
		go func() {
			m := m.BackgroundWithLogTags()
			c.debug(m, "loadNames: spawning stale background load: names: %d",
				len(staleNames))
			loadRes, err := remoteFetch(m, staleNames, staleFormats)
			if err == nil {
				c.dispatchPopulateFromRes(m, loadRes)
			} else {
				c.debug(m, "loadNames: failed to load server stale reqs: %s", err)
			}
		}()
	}
	return res, nil
}

func (c *FullCachingSource) clearName(m libkb.MetaContext, name string, formats []keybase1.AvatarFormat) (err error) {
	for _, format := range formats {
		key := c.avatarKey(name, format)
		found, ent, err := c.diskLRU.Get(m.Ctx(), m.G(), key)
		if err != nil {
			return err
		}
		if found {
			c.removeFile(m, &ent)
			if err := c.diskLRU.Remove(m.Ctx(), m.G(), key); err != nil {
				return err
			}
		}
	}
	return nil
}

func (c *FullCachingSource) LoadUsers(m libkb.MetaContext, usernames []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer m.TraceTimed("FullCachingSource.LoadUsers", func() error { return err })()
	return c.loadNames(m, usernames, formats, c.simpleSource.LoadUsers)
}

func (c *FullCachingSource) LoadTeams(m libkb.MetaContext, teams []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer m.TraceTimed("FullCachingSource.LoadTeams", func() error { return err })()
	return c.loadNames(m, teams, formats, c.simpleSource.LoadTeams)
}

func (c *FullCachingSource) ClearCacheForName(m libkb.MetaContext, name string, formats []keybase1.AvatarFormat) (err error) {
	defer m.TraceTimed(fmt.Sprintf("FullCachingSource.ClearCacheForUser(%q,%v)", name, formats), func() error { return err })()
	return c.clearName(m, name, formats)
}

func (c *FullCachingSource) OnDbNuke(m libkb.MetaContext) error {
	if c.diskLRU != nil {
		if err := c.diskLRU.CleanOutOfSync(m, c.getCacheDir(m)); err != nil {
			c.debug(m, "unable to run clean: %v", err)
		}
	}
	return nil
}
