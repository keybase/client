package avatars

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	name      string
	format    keybase1.AvatarFormat
	path      string
	remoteURL *string
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

func (a avatarLoadSpec) staleKnownURL(name string, format keybase1.AvatarFormat) *string {
	for _, stale := range a.stales {
		if stale.name == name && stale.format == format {
			return stale.remoteURL
		}
	}
	return nil
}

type populateArg struct {
	name   string
	format keybase1.AvatarFormat
	url    keybase1.AvatarUrl
}

type remoteFetchArg struct {
	names   []string
	formats []keybase1.AvatarFormat
	cb      chan keybase1.LoadAvatarsRes
	errCb   chan error
}

type lruEntry struct {
	Path string
	URL  *string
}

func (l lruEntry) GetPath() string {
	return l.Path
}

type FullCachingSource struct {
	libkb.Contextified
	sync.Mutex
	started              bool
	diskLRU              *lru.DiskLRU
	diskLRUCleanerCancel context.CancelFunc
	staleThreshold       time.Duration
	simpleSource         libkb.AvatarLoaderSource

	populateCacheCh chan populateArg

	prepareDirs sync.Once

	usersMissBatch  func(interface{})
	teamsMissBatch  func(interface{})
	usersStaleBatch func(interface{})
	teamsStaleBatch func(interface{})

	// testing
	populateSuccessCh chan struct{}
	tempDir           string
}

var _ libkb.AvatarLoaderSource = (*FullCachingSource)(nil)

func NewFullCachingSource(g *libkb.GlobalContext, staleThreshold time.Duration, size int) *FullCachingSource {
	s := &FullCachingSource{
		Contextified:   libkb.NewContextified(g),
		diskLRU:        lru.NewDiskLRU("avatars", 1, size),
		staleThreshold: staleThreshold,
		simpleSource:   NewSimpleSource(),
	}
	batcher := func(intBatched interface{}, intSingle interface{}) interface{} {
		reqs, _ := intBatched.([]remoteFetchArg)
		single, _ := intSingle.(remoteFetchArg)
		return append(reqs, single)
	}
	reset := func() interface{} {
		return []remoteFetchArg{}
	}
	actor := func(loadFn func(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)) func(interface{}) {
		return func(intBatched interface{}) {
			reqs, _ := intBatched.([]remoteFetchArg)
			s.makeRemoteFetchRequests(reqs, loadFn)
		}
	}
	usersMissBatch, _ := libkb.ThrottleBatch(
		actor(s.simpleSource.LoadUsers), batcher, reset, 100*time.Millisecond, false,
	)
	teamsMissBatch, _ := libkb.ThrottleBatch(
		actor(s.simpleSource.LoadTeams), batcher, reset, 100*time.Millisecond, false,
	)
	usersStaleBatch, _ := libkb.ThrottleBatch(
		actor(s.simpleSource.LoadUsers), batcher, reset, 5000*time.Millisecond, false,
	)
	teamsStaleBatch, _ := libkb.ThrottleBatch(
		actor(s.simpleSource.LoadTeams), batcher, reset, 5000*time.Millisecond, false,
	)
	s.usersMissBatch = usersMissBatch
	s.teamsMissBatch = teamsMissBatch
	s.usersStaleBatch = usersStaleBatch
	s.teamsStaleBatch = teamsStaleBatch
	return s
}

func (c *FullCachingSource) makeRemoteFetchRequests(reqs []remoteFetchArg,
	loadFn func(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)) {
	mctx := libkb.NewMetaContextBackground(c.G())
	namesSet := make(map[string]bool)
	formatsSet := make(map[keybase1.AvatarFormat]bool)
	for _, req := range reqs {
		for _, name := range req.names {
			namesSet[name] = true
		}
		for _, format := range req.formats {
			formatsSet[format] = true
		}
	}
	genErrors := func(err error) {
		for _, req := range reqs {
			req.errCb <- err
		}
	}
	extractRes := func(req remoteFetchArg, ires keybase1.LoadAvatarsRes) (res keybase1.LoadAvatarsRes) {
		res.Picmap = make(map[string]map[keybase1.AvatarFormat]keybase1.AvatarUrl)
		for _, name := range req.names {
			iformats, ok := ires.Picmap[name]
			if !ok {
				continue
			}
			if _, ok := res.Picmap[name]; !ok {
				res.Picmap[name] = make(map[keybase1.AvatarFormat]keybase1.AvatarUrl)
			}
			for _, format := range req.formats {
				res.Picmap[name][format] = iformats[format]
			}
		}
		return res
	}
	names := make([]string, 0, len(namesSet))
	formats := make([]keybase1.AvatarFormat, 0, len(formatsSet))
	for name := range namesSet {
		names = append(names, name)
	}
	for format := range formatsSet {
		formats = append(formats, format)
	}
	c.debug(mctx, "makeRemoteFetchRequests: names: %d formats: %d", len(names), len(formats))
	res, err := loadFn(mctx, names, formats)
	if err != nil {
		genErrors(err)
		return
	}
	for _, req := range reqs {
		req.cb <- extractRes(req, res)
	}
}

func (c *FullCachingSource) StartBackgroundTasks(mctx libkb.MetaContext) {
	defer mctx.Trace("FullCachingSource.StartBackgroundTasks", nil)()
	c.Lock()
	defer c.Unlock()
	if c.started {
		return
	}
	c.started = true
	go c.monitorAppState(mctx)
	c.populateCacheCh = make(chan populateArg, 100)
	for i := 0; i < 10; i++ {
		go c.populateCacheWorker(mctx)
	}
	mctx, cancel := mctx.WithContextCancel()
	c.diskLRUCleanerCancel = cancel
	go lru.CleanOutOfSyncWithDelay(mctx, c.diskLRU, c.getCacheDir(mctx), 10*time.Second)
}

func (c *FullCachingSource) StopBackgroundTasks(mctx libkb.MetaContext) {
	defer mctx.Trace("FullCachingSource.StopBackgroundTasks", nil)()
	c.Lock()
	defer c.Unlock()
	if !c.started {
		return
	}
	c.started = false
	close(c.populateCacheCh)
	if c.diskLRUCleanerCancel != nil {
		c.diskLRUCleanerCancel()
	}
	if err := c.diskLRU.Flush(mctx.Ctx(), mctx.G()); err != nil {
		c.debug(mctx, "StopBackgroundTasks: unable to flush diskLRU %v", err)
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
		if state == keybase1.MobileAppState_BACKGROUND {
			c.debug(m, "monitorAppState: backgrounded")
			if err := c.diskLRU.Flush(m.Ctx(), m.G()); err != nil {
				c.debug(m, "monitorAppState: unable to flush diskLRU %v", err)
			}
		}
	}
}

func (c *FullCachingSource) processLRUHit(entry lru.DiskLRUEntry) (res lruEntry) {
	var ok bool
	if _, ok = entry.Value.(map[string]interface{}); ok {
		jstr, _ := json.Marshal(entry.Value)
		_ = json.Unmarshal(jstr, &res)
		return res
	}
	path, _ := entry.Value.(string)
	res.Path = path
	return res
}

func (c *FullCachingSource) specLoad(m libkb.MetaContext, names []string, formats []keybase1.AvatarFormat) (res avatarLoadSpec, err error) {
	for _, name := range names {
		for _, format := range formats {
			key := c.avatarKey(name, format)
			found, ientry, err := c.diskLRU.Get(m.Ctx(), m.G(), key)
			if err != nil {
				return res, err
			}
			lp := avatarLoadPair{
				name:   name,
				format: format,
			}

			// If we found something in the index, let's make sure we have it on the disk as well.
			entry := c.processLRUHit(ientry)
			if found {
				lp.path = c.normalizeFilenameFromCache(m, entry.Path)
				lp.remoteURL = entry.URL
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
				if c.isStale(m, ientry) {
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
		if file, err = os.CreateTemp(c.getCacheDir(m), "avatar"); err != nil {
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
		lentry := c.processLRUHit(*ent)
		file := c.normalizeFilenameFromCache(m, lentry.GetPath())
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
		url := arg.url.String()
		resp, err := libkb.ProxyHTTPGet(m.G(), m.G().GetEnv(), url, "FullCachingSource: Avatar")
		if err != nil {
			c.debug(m, "populateCacheWorker: failed to download avatar: %s", err)
			continue
		}
		// Find any previous path we stored this image at on the disk
		var previousEntry lruEntry
		var previousPath string
		key := c.avatarKey(arg.name, arg.format)
		found, ent, err := c.diskLRU.Get(m.Ctx(), m.G(), key)
		if err != nil {
			c.debug(m, "populateCacheWorker: failed to read previous entry in LRU: %s", err)
			err = libkb.DiscardAndCloseBody(resp)
			if err != nil {
				c.debug(m, "populateCacheWorker: error closing body: %+v", err)
			}
			continue
		}
		if found {
			previousEntry = c.processLRUHit(ent)
			previousPath = c.normalizeFilenameFromCache(m, previousEntry.Path)
		}

		// Save to disk
		path, err := c.commitAvatarToDisk(m, resp.Body, previousPath)
		discardErr := libkb.DiscardAndCloseBody(resp)
		if discardErr != nil {
			c.debug(m, "populateCacheWorker: error closing body: %+v", discardErr)
		}
		if err != nil {
			c.debug(m, "populateCacheWorker: failed to write to disk: %s", err)
			continue
		}
		v := lruEntry{
			Path: path,
			URL:  &url,
		}
		evicted, err := c.diskLRU.Put(m.Ctx(), m.G(), key, v)
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

func (c *FullCachingSource) dispatchPopulateFromRes(m libkb.MetaContext, res keybase1.LoadAvatarsRes,
	spec avatarLoadSpec) {
	c.Lock()
	defer c.Unlock()
	if !c.started {
		return
	}
	for name, rec := range res.Picmap {
		for format, url := range rec {
			if url != "" {
				knownURL := spec.staleKnownURL(name, format)
				if knownURL == nil || *knownURL != url.String() {
					c.populateCacheCh <- populateArg{
						name:   name,
						format: format,
						url:    url,
					}
				} else {
					c.debug(m, "dispatchPopulateFromRes: skipping name: %s format: %s, stale known", name,
						format)
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
	users bool) (res keybase1.LoadAvatarsRes, err error) {
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
		var loadRes keybase1.LoadAvatarsRes
		cb := make(chan keybase1.LoadAvatarsRes, 1)
		errCb := make(chan error, 1)
		arg := remoteFetchArg{
			names:   missNames,
			formats: missFormats,
			cb:      cb,
			errCb:   errCb,
		}
		if users {
			c.usersMissBatch(arg)
		} else {
			c.teamsMissBatch(arg)
		}
		select {
		case loadRes = <-cb:
		case err = <-errCb:
		}
		if err == nil {
			c.mergeRes(&res, loadRes)
			c.dispatchPopulateFromRes(m, loadRes, loadSpec)
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
			var loadRes keybase1.LoadAvatarsRes
			cb := make(chan keybase1.LoadAvatarsRes, 1)
			errCb := make(chan error, 1)
			arg := remoteFetchArg{
				names:   staleNames,
				formats: staleFormats,
				cb:      cb,
				errCb:   errCb,
			}
			if users {
				c.usersStaleBatch(arg)
			} else {
				c.teamsStaleBatch(arg)
			}
			select {
			case loadRes = <-cb:
			case err = <-errCb:
			}
			if err == nil {
				c.dispatchPopulateFromRes(m, loadRes, loadSpec)
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
	defer m.Trace("FullCachingSource.LoadUsers", &err)()
	return c.loadNames(m, usernames, formats, true)
}

func (c *FullCachingSource) LoadTeams(m libkb.MetaContext, teams []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer m.Trace("FullCachingSource.LoadTeams", &err)()
	return c.loadNames(m, teams, formats, false)
}

func (c *FullCachingSource) ClearCacheForName(m libkb.MetaContext, name string, formats []keybase1.AvatarFormat) (err error) {
	defer m.Trace(fmt.Sprintf("FullCachingSource.ClearCacheForUser(%q,%v)", name, formats), &err)()
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
