// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/favorites"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

const (
	disableFavoritesEnvVar           = "KEYBASE_DISABLE_FAVORITES"
	favoritesCacheExpirationTime     = time.Hour * 24 * 7 // one week
	kbfsFavoritesCacheSubfolder      = "kbfs_favorites"
	favoritesDiskCacheFilename       = "kbfsFavorites.leveldb"
	favoritesDiskCacheVersion        = 2
	favoritesDiskCacheStorageVersion = 1
	// How long to block on favorites refresh when cache is expired (e.g.,
	// on startup). Reasonably low in case we're offline.
	favoritesServerTimeoutWhenCacheExpired = 500 * time.Millisecond
	favoritesBackgroundRefreshTimeout      = 15 * time.Second
	favoritesBufferedReqInterval           = 5 * time.Second
)

var errNoFavoritesCache = errors.New("disk favorites cache not present")

type errIncorrectFavoritesCacheVersion struct {
	cache   string
	version int
}

func (e errIncorrectFavoritesCacheVersion) Error() string {
	return fmt.Sprintf("decoding of %s favorites cache failed: version was %d",
		e.cache, e.version)
}

// favReq represents a request to access the logged-in user's
// favorites list.  A single request can do one or more of the
// following: refresh the current cached list, add a favorite, remove
// a favorite, and get all the favorites.  When the request is done,
// the resulting error (or nil) is sent over the done channel.  The
// given ctx is used for all network operations.
type favReq struct {
	// Request types
	clear       bool
	refresh     bool
	buffered    bool
	toAdd       []favorites.ToAdd
	toDel       []favorites.Folder
	favs        chan<- []favorites.Folder
	favsAll     chan<- keybase1.FavoritesResult
	homeTLFInfo *homeTLFInfo

	// For asynchronous refreshes, pass in the Favorites from the server here
	favResult *keybase1.FavoritesResult

	// Closed when the request is done.
	done chan struct{}
	// Set before done is closed
	err error

	// Context
	ctx context.Context
}

type homeTLFInfo struct {
	PublicTeamID  keybase1.TeamID
	PrivateTeamID keybase1.TeamID
}

// Favorites manages a user's favorite list.
type Favorites struct {
	config   Config
	disabled bool
	log      logger.Logger

	// homeTLFInfo stores the IDs for the logged-in user's home TLFs
	homeTLFInfo homeTLFInfo

	// Channel for interacting with the favorites cache
	reqChan         chan *favReq
	bufferedReqChan chan *favReq
	// Channel that is full when there is already a refresh queued
	refreshWaiting chan struct{}

	wg kbfssync.RepeatedWaitGroup

	// cache tracks the favorites for this user, that we know about.
	// It may not be consistent with the server's view of the user's
	// favorites list, if other devices have modified the list since
	// the last refresh and this device is offline.
	// When another device modifies the favorites [or new or ignored] list,
	// the server will try to alert the other devices to refresh.
	favCache        map[favorites.Folder]favorites.Data
	newCache        map[favorites.Folder]favorites.Data
	ignoredCache    map[favorites.Folder]favorites.Data
	cacheExpireTime time.Time

	diskCache *LevelDb

	inFlightLock sync.Mutex
	inFlightAdds map[favorites.Folder]*favReq

	muShutdown sync.RWMutex
	shutdown   bool
}

func newFavoritesWithChan(config Config, reqChan chan *favReq) *Favorites {
	disableVal := strings.ToLower(os.Getenv(disableFavoritesEnvVar))
	log := config.MakeLogger("FAV")
	if len(disableVal) > 0 && disableVal != "0" && disableVal != "false" &&
		disableVal != "no" {
		log.CDebugf(nil,
			"Disable favorites due to env var %s=%s",
			disableFavoritesEnvVar, disableVal)
		return &Favorites{
			config:   config,
			disabled: true,
			log:      log,
		}
	}

	f := &Favorites{
		config:          config,
		reqChan:         reqChan,
		bufferedReqChan: make(chan *favReq, 1),
		refreshWaiting:  make(chan struct{}, 1),
		inFlightAdds:    make(map[favorites.Folder]*favReq),
		log:             log,
	}

	return f
}

// NewFavorites constructs a new Favorites instance.
func NewFavorites(config Config) *Favorites {
	return newFavoritesWithChan(config, make(chan *favReq, 100))
}

type favoritesCacheForDisk struct {
	Version      int
	FavCache     map[favorites.Folder]favorites.Data
	NewCache     map[favorites.Folder]favorites.Data
	IgnoredCache map[favorites.Folder]favorites.Data
}
type favoritesCacheEncryptedForDisk struct {
	Version        int
	EncryptedCache []byte
}

func (f *Favorites) readCacheFromDisk(ctx context.Context) error {
	// Read the encrypted cache from disk
	var db *LevelDb
	var err error
	if f.config.IsTestMode() {
		db, err = openLevelDB(storage.NewMemStorage())
	} else {
		db, err = openVersionedLevelDB(f.log, f.config.StorageRoot(),
			kbfsFavoritesCacheSubfolder, favoritesDiskCacheStorageVersion,
			favoritesDiskCacheFilename)
	}
	if err != nil {
		return err
	}
	f.diskCache = db
	session, err := f.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}
	user := []byte(string(session.UID))
	data, err := db.Get(user, nil)
	if err == leveldb.ErrNotFound {
		f.log.CInfof(ctx, "No favorites cache found for user %v", user)
		return nil
	} else if err != nil {
		return err
	}

	// decode the data from the file and ensure its version is correct
	var decodedData favoritesCacheEncryptedForDisk
	err = f.config.Codec().Decode(data, &decodedData)
	if err != nil {
		return err
	}
	if decodedData.Version != favoritesDiskCacheStorageVersion {
		return errIncorrectFavoritesCacheVersion{cache: "serialized",
			version: decodedData.Version}
	}

	// Send the data to the service to be decrypted
	decryptedData, err := f.config.KeybaseService().DecryptFavorites(ctx,
		decodedData.EncryptedCache)
	if err != nil {
		return err
	}

	// Decode the data into the a map
	var cacheDecoded favoritesCacheForDisk
	err = f.config.Codec().Decode(decryptedData, &cacheDecoded)
	if err != nil {
		return err
	}
	if cacheDecoded.Version != favoritesDiskCacheVersion {
		return errIncorrectFavoritesCacheVersion{cache: "encrypted",
			version: decodedData.Version}
	}

	f.favCache = cacheDecoded.FavCache
	f.newCache = cacheDecoded.NewCache
	f.ignoredCache = cacheDecoded.IgnoredCache
	return nil
}

func (f *Favorites) writeCacheToDisk(ctx context.Context) error {
	if f.diskCache == nil {
		return errNoFavoritesCache
	}
	// Encode the cache map into a byte buffer
	cacheForDisk := favoritesCacheForDisk{
		FavCache:     f.favCache,
		NewCache:     f.newCache,
		IgnoredCache: f.ignoredCache,
		Version:      favoritesDiskCacheVersion,
	}
	cacheSerialized, err := f.config.Codec().Encode(cacheForDisk)
	if err != nil {
		return err
	}

	// Send the byte buffer to the service for encryption
	data, err := f.config.KeybaseService().EncryptFavorites(ctx,
		cacheSerialized)
	if err != nil {
		return err
	}

	// Encode the encrypted data in a versioned struct before writing it to
	// the LevelDb.
	cacheEncryptedForDisk := favoritesCacheEncryptedForDisk{
		EncryptedCache: data,
		Version:        favoritesDiskCacheStorageVersion,
	}
	encodedData, err := f.config.Codec().Encode(cacheEncryptedForDisk)
	if err != nil {
		return err
	}

	// Write the encrypted cache to disk
	session, err := f.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}
	user := []byte(string(session.UID))
	return f.diskCache.Put(user, encodedData, nil)
}

// InitForTest starts the Favorites cache's internal processing loop without
// loading cached favorites from disk.
func (f *Favorites) InitForTest() {
	go f.loop()
}

// Initialize loads the favorites cache from disk and starts listening for
// requests asynchronously.
func (f *Favorites) Initialize(ctx context.Context) {
	// load cache from disk
	err := f.readCacheFromDisk(ctx)
	if err != nil {
		f.log.CWarningf(nil,
			"Failed to read cached favorites from disk: %v", err)
	}

	// launch background loop
	go f.loop()
}

func (f *Favorites) closeReq(req *favReq, err error) {
	f.inFlightLock.Lock()
	defer f.inFlightLock.Unlock()
	req.err = err
	close(req.done)
	for _, fav := range req.toAdd {
		delete(f.inFlightAdds, fav.Folder)
	}
}

func (f *Favorites) crossCheckWithEditHistory() {
	// NOTE: Ideally we would wait until all edit activity processing
	// had completed in the FBO before we do these checks, but I think
	// in practice when the mtime changes, it'll be the edit activity
	// processing that actually kicks off these favorites activity,
	// and so that particular race won't be an issue.  If we see
	// weirdness here though, it might be worth revisiting that
	// assumption.

	// The mtime attached to the favorites data returned by the API
	// server is updated both on git activity, background collection,
	// and pure deletion ops, none of which add new interesting
	// content to the TLF.  So, fix the favorite times to be the
	// latest known edit history times, if possible.  If not possible,
	// that means the TLF is definitely not included in the latest
	// list of TLF edit activity; so set these to be lower than the
	// minimum known time, if they're not already.
	var minTime keybase1.Time
	uh := f.config.UserHistory()
	tlfsWithNoHistory := make(map[favorites.Folder]favorites.Data)
	for fav, data := range f.favCache {
		h := uh.GetTlfHistory(tlf.CanonicalName(fav.Name), fav.Type)
		if h.ServerTime == 0 {
			if data.TlfMtime != nil {
				tlfsWithNoHistory[fav] = data
			}
			continue
		}
		if minTime == 0 || h.ServerTime < minTime {
			minTime = h.ServerTime
		}
		if data.TlfMtime == nil || *data.TlfMtime > h.ServerTime {
			t := h.ServerTime
			data.TlfMtime = &t
			f.favCache[fav] = data
		}
	}

	// Make sure all TLFs that aren't in the recent edit history get a
	// timestamp that's smaller than the minimum time in the edit
	// history.
	if minTime > 0 {
		for fav, data := range tlfsWithNoHistory {
			if *data.TlfMtime > minTime {
				t := minTime - 1
				data.TlfMtime = &t
				f.favCache[fav] = data
			}
		}
	}
}

// sendChangesToEditHistory notes any deleted favorites and removes them
// from this user's kbfsedits.UserHistory.
func (f *Favorites) sendChangesToEditHistory(oldCache map[favorites.Folder]favorites.Data) (changed bool) {
	for oldFav := range oldCache {
		if _, present := f.favCache[oldFav]; !present {
			f.config.UserHistory().ClearTLF(tlf.CanonicalName(oldFav.Name),
				oldFav.Type)
			changed = true
		}
	}
	for newFav, newFavData := range f.favCache {
		oldFavData, present := oldCache[newFav]
		if !present {
			f.config.KBFSOps().RefreshEditHistory(newFav)
			changed = true
		} else if newFavData.TlfMtime != nil &&
			(oldFavData.TlfMtime == nil ||
				(*newFavData.TlfMtime > *oldFavData.TlfMtime)) {
			changed = true
		}
	}

	return changed
}

func favoriteToFolder(fav favorites.Folder, data favorites.Data) keybase1.Folder {
	return keybase1.Folder{
		Name:         fav.Name,
		Private:      data.Private,
		Created:      false,
		FolderType:   data.FolderType,
		TeamID:       data.TeamID,
		ResetMembers: data.ResetMembers,
		Mtime:        data.TlfMtime,
	}
}

func (f *Favorites) handleReq(req *favReq) (err error) {
	defer f.wg.Done()

	changed := false
	defer func() {
		f.closeReq(req, err)
		if changed {
			f.config.Reporter().NotifyFavoritesChanged(req.ctx)
		}
	}()

	if req.refresh && !req.buffered {
		<-f.refreshWaiting
	}

	kbpki := f.config.KBPKI()
	// Fetch a new list if:
	//  (1) The user asked us to refresh
	//  (2) We haven't fetched it before
	//  (3) It's stale
	//
	// If just (3), use a short timeout so we can return the correct result
	// quickly when offline.
	needFetch := (req.refresh || f.favCache == nil) && !req.clear
	wantFetch := f.config.Clock().Now().After(f.cacheExpireTime) && !req.clear

	for _, fav := range req.toAdd {
		// This check for adds is critical and we should definitely leave it
		// in. We've had issues in the past with spamming the API server with
		// adding the same favorite multiple times. We don't have the same
		// problem with deletes, because after the user deletes it, they aren't
		// accessing the folder again. But with adds, we could be going through
		// this code on basically every folder access. Favorite deletes from
		// another device result in a notification to this device, so a race
		// condition where we miss an "add" can't happen.
		_, present := f.favCache[fav.Folder]
		if !fav.Created && present {
			continue
		}
		err := kbpki.FavoriteAdd(req.ctx, fav.ToKBFolderHandle())
		if err != nil {
			f.log.CDebugf(req.ctx,
				"Failure adding favorite %v: %v", fav, err)
			return err
		}
		needFetch = true
		changed = true
	}

	for _, fav := range req.toDel {
		// Since our cache isn't necessarily up-to-date, always delete
		// the favorite.
		folder := fav.ToKBFolderHandle(false)
		err := kbpki.FavoriteDelete(req.ctx, folder)
		if err != nil {
			return err
		}
		f.config.UserHistory().ClearTLF(tlf.CanonicalName(fav.Name), fav.Type)
		changed = true
		// Simply delete here instead of triggering another list as an
		// optimization because there's nothing additional we need from core.
		delete(f.favCache, fav)
	}

	if needFetch || wantFetch {
		getCtx := req.ctx
		if !needFetch {
			var cancel context.CancelFunc
			getCtx, cancel = context.WithTimeout(req.ctx,
				favoritesServerTimeoutWhenCacheExpired)
			defer cancel()
		}
		// Load the cache from the server. This possibly already happened
		// asynchronously and was included in the request.
		var favResult keybase1.FavoritesResult
		if req.favResult == nil {
			favResult, err = kbpki.FavoriteList(getCtx)
		} else {
			favResult = *req.favResult
		}
		if err != nil {
			if needFetch {
				// if we're supposed to refresh the cache and it's not
				// working, mark the current cache expired.
				now := f.config.Clock().Now()
				if now.Before(f.cacheExpireTime) {
					f.cacheExpireTime = now
				}
				return err
			}
			// If we weren't explicitly asked to refresh, we can return possibly
			// stale favorites rather than return nothing.
			if err == context.DeadlineExceeded {
				newCtx, _ := context.WithTimeout(context.Background(),
					favoritesBackgroundRefreshTimeout)
				go f.RefreshCache(newCtx, FavoritesRefreshModeBlocking)
			}
			f.log.CDebugf(req.ctx,
				"Serving possibly stale favorites; new data could not be"+
					" fetched: %v", err)
		} else { // Successfully got new favorites from server.
			session, sessionErr := kbpki.GetCurrentSession(req.ctx)
			oldCache := f.favCache
			f.newCache = make(map[favorites.Folder]favorites.Data)
			f.favCache = make(map[favorites.Folder]favorites.Data)
			f.ignoredCache = make(map[favorites.Folder]favorites.Data)
			f.cacheExpireTime = libkb.ForceWallClock(f.config.Clock().Now()).Add(
				favoritesCacheExpirationTime)
			for _, folder := range favResult.FavoriteFolders {
				f.favCache[*favorites.NewFolderFromProtocol(
					folder)] = favorites.DataFrom(folder)
				if sessionErr != nil && folder.Name == string(session.Name) {
					if folder.Private {
						f.homeTLFInfo.PrivateTeamID = *folder.TeamID
					} else {
						f.homeTLFInfo.PublicTeamID = *folder.TeamID
					}
				}
			}
			f.crossCheckWithEditHistory()
			for _, folder := range favResult.IgnoredFolders {
				f.ignoredCache[*favorites.NewFolderFromProtocol(
					folder)] = favorites.DataFrom(folder)
			}
			for _, folder := range favResult.NewFolders {
				f.newCache[*favorites.NewFolderFromProtocol(
					folder)] = favorites.DataFrom(folder)
			}
			if sessionErr == nil {
				// Add favorites for the current user, that cannot be
				// deleted.  Only overwrite them (with a 0 mtime) if
				// they weren't already part of the favorites list.
				selfPriv := favorites.Folder{
					Name: string(session.Name),
					Type: tlf.Private,
				}
				if _, ok := f.favCache[selfPriv]; !ok {
					f.favCache[selfPriv] = favorites.Data{
						Name:       string(session.Name),
						FolderType: tlf.Private.FolderType(),
						TeamID:     &f.homeTLFInfo.PrivateTeamID,
						Private:    true,
					}
				}
				selfPub := favorites.Folder{
					Name: string(session.Name),
					Type: tlf.Public,
				}
				if _, ok := f.favCache[selfPub]; !ok {
					f.favCache[selfPub] = favorites.Data{
						Name:       string(session.Name),
						FolderType: tlf.Public.FolderType(),
						TeamID:     &f.homeTLFInfo.PublicTeamID,
						Private:    false,
					}
				}
				err = f.writeCacheToDisk(req.ctx)
				if err != nil {
					f.log.CWarningf(req.ctx,
						"Could not write favorites to disk cache: %v", err)
				}
			}
			if oldCache != nil {
				changed = f.sendChangesToEditHistory(oldCache)
			}
		}
	} else if req.clear {
		f.favCache = nil
		changed = true
		return nil
	}

	if req.favs != nil {
		favorites := make([]favorites.Folder, 0, len(f.favCache))
		for fav := range f.favCache {
			favorites = append(favorites, fav)
		}
		req.favs <- favorites
	}

	if req.favsAll != nil {
		favFolders := make([]keybase1.Folder, 0, len(f.favCache))
		newFolders := make([]keybase1.Folder, 0, len(f.newCache))
		ignoredFolders := make([]keybase1.Folder, 0, len(f.ignoredCache))

		for fav, data := range f.favCache {
			favFolders = append(favFolders, favoriteToFolder(fav, data))
		}
		for fav, data := range f.newCache {
			newFolders = append(newFolders, favoriteToFolder(fav, data))
		}
		for fav, data := range f.ignoredCache {
			ignoredFolders = append(ignoredFolders, favoriteToFolder(fav, data))
		}

		req.favsAll <- keybase1.FavoritesResult{
			NewFolders:      newFolders,
			IgnoredFolders:  ignoredFolders,
			FavoriteFolders: favFolders,
		}
	}

	if req.homeTLFInfo != nil {
		f.homeTLFInfo = *req.homeTLFInfo
	}

	return nil
}

func (f *Favorites) loop() {
	bufferedTicker := time.NewTicker(favoritesBufferedReqInterval)
	defer bufferedTicker.Stop()

	for {
		select {
		case req, ok := <-f.reqChan:
			if !ok {
				return
			}
			f.handleReq(req)
		case <-bufferedTicker.C:
			select {
			case req, ok := <-f.bufferedReqChan:
				if !ok {
					return
				}
				// Don't block the wait group on buffered requests
				// until we're actually processing one.
				f.wg.Add(1)
				f.handleReq(req)
			default:
			}
		}
	}
}

// Shutdown shuts down this Favorites instance.
func (f *Favorites) Shutdown() error {
	if f.disabled {
		return nil
	}

	f.muShutdown.Lock()
	defer f.muShutdown.Unlock()
	f.shutdown = true
	close(f.reqChan)
	close(f.bufferedReqChan)
	if f.diskCache != nil {
		err := f.diskCache.Close()
		if err != nil {
			f.log.CWarningf(context.Background(),
				"Could not close disk favorites cache: %v", err)
		}
	}
	return f.wg.Wait(context.Background())
}

func (f *Favorites) waitOnReq(ctx context.Context,
	req *favReq) (retry bool, err error) {
	select {
	case <-ctx.Done():
		return false, ctx.Err()
	case <-req.done:
		err = req.err
		// If the request was canceled due to a context timeout that
		// wasn't our own, try it again.
		if err == context.Canceled || err == context.DeadlineExceeded {
			select {
			case <-ctx.Done():
				return false, err
			default:
				return true, nil
			}
		}
		return false, err
	}
}

func (f *Favorites) sendReq(ctx context.Context, req *favReq) error {
	f.wg.Add(1)
	select {
	case f.reqChan <- req:
	case <-ctx.Done():
		f.wg.Done()
		err := ctx.Err()
		f.closeReq(req, err)
		return err
	}
	// With a direct sendReq call, we'll never have a shared request,
	// so no need to check the retry status.
	_, err := f.waitOnReq(ctx, req)
	return err
}

func (f *Favorites) startOrJoinAddReq(
	ctx context.Context, fav favorites.ToAdd) (req *favReq, doSend bool) {
	f.inFlightLock.Lock()
	defer f.inFlightLock.Unlock()
	req, ok := f.inFlightAdds[fav.Folder]
	if !ok {
		req = &favReq{
			ctx:   ctx,
			toAdd: []favorites.ToAdd{fav},
			done:  make(chan struct{}),
		}
		f.inFlightAdds[fav.Folder] = req
		doSend = true
	}
	return req, doSend
}

// Add adds a favorite to your favorites list.
func (f *Favorites) Add(ctx context.Context, fav favorites.ToAdd) error {
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()

	if f.disabled {
		return nil
	}
	if f.shutdown {
		return data.ShutdownHappenedError{}
	}
	doAdd := true
	var err error
	// Retry until we get an error that wasn't related to someone
	// else's context being canceled.
	for doAdd {
		req, doSend := f.startOrJoinAddReq(ctx, fav)
		if doSend {
			return f.sendReq(ctx, req)
		}
		doAdd, err = f.waitOnReq(ctx, req)
	}
	return err
}

// AddAsync initiates a request to add this favorite to your favorites
// list, if one is not already in flight, but it doesn't wait for the
// result.  (It could block while kicking off the request, if lots of
// different favorite operations are in flight.)  The given context is
// used only for enqueuing the request on an internal queue, not for
// any resulting I/O.
func (f *Favorites) AddAsync(ctx context.Context, fav favorites.ToAdd) {
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()

	if f.disabled || f.shutdown {
		return
	}
	// Use a fresh context, since we want the request to succeed even
	// if the original context is canceled.
	req, doSend := f.startOrJoinAddReq(context.Background(), fav)
	if doSend {
		f.wg.Add(1)
		select {
		case f.reqChan <- req:
		case <-ctx.Done():
			f.wg.Done()
			err := ctx.Err()
			f.closeReq(req, err)
			return
		}
	}
}

// Delete deletes a favorite from the favorites list.  It is
// idempotent.
func (f *Favorites) Delete(ctx context.Context, fav favorites.Folder) error {
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()

	if f.disabled {
		return nil
	}
	if f.shutdown {
		return data.ShutdownHappenedError{}
	}
	return f.sendReq(ctx, &favReq{
		ctx:   ctx,
		toDel: []favorites.Folder{fav},
		done:  make(chan struct{}),
	})
}

// FavoritesRefreshMode controls how a favorites refresh happens.
type FavoritesRefreshMode int

const (
	// FavoritesRefreshModeInMainFavoritesLoop means to refresh the favorites
	// in the main loop, blocking any favorites requests after until the refresh
	// is done.
	FavoritesRefreshModeInMainFavoritesLoop = iota
	// FavoritesRefreshModeBlocking means to refresh the favorites outside
	// of the main loop.
	FavoritesRefreshModeBlocking
)

// RefreshCache refreshes the cached list of favorites.
//
// In FavoritesRefreshModeBlocking, request the favorites in this function,
// then send them to the main goroutine to be processed. This should be called
// in a separate goroutine from anything mission-critical, because it might wait
// on network for up to 15 seconds.
//
// In FavoritesRefreshModeInMainFavoritesLoop, this just sets up a request and
// sends it to the main goroutine to process it - this is useful if e.g.
// the favorites cache has not been initialized at all and cannot serve any
// requests until this refresh is completed.
func (f *Favorites) RefreshCache(ctx context.Context, mode FavoritesRefreshMode) {
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()
	if f.disabled || f.shutdown {
		return
	}

	// Insert something into the refreshWaiting channel to guarantee that we
	// are the only current refresh.
	select {
	case f.refreshWaiting <- struct{}{}:
	default:
		// There is already a refresh in the queue
		return
	}
	// This request is non-blocking, so use a throw-away done channel
	// and context. Note that in the `blocking` mode, this context will only
	// be relevant for the brief moment the main loop processes the results
	// generated in the below network request.
	req := &favReq{
		refresh: true,
		done:    make(chan struct{}),
		ctx:     context.Background(),
	}
	f.wg.Add(1)

	if mode == FavoritesRefreshModeBlocking {
		favResult, err := f.config.KBPKI().FavoriteList(ctx)
		if err != nil {
			f.log.CDebugf(ctx, "Failed to refresh cached Favorites: %+v", err)
			// Because the request will not make it to the main processing
			// loop, mark it as done and clear the refresh channel here.
			f.wg.Done()
			<-f.refreshWaiting
			return
		}
		req.favResult = &favResult
	}
	select {
	case f.reqChan <- req:
		go func() {
			<-req.done
			if req.err != nil {
				f.log.CDebugf(ctx, "Failed to refresh cached Favorites ("+
					"error in main loop): %+v", req.err)
			}
		}()
	case <-ctx.Done():
		// Because the request will not make it to the main processing
		// loop, mark it as done and clear the refresh channel here.
		f.wg.Done()
		<-f.refreshWaiting
		return
	}
}

// RefreshCacheWhenMTimeChanged refreshes the cached favorites, but
// does so with rate-limiting, so that it doesn't hit the server too
// often.
func (f *Favorites) RefreshCacheWhenMTimeChanged(ctx context.Context) {
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()
	if f.disabled || f.shutdown {
		return
	}

	req := &favReq{
		refresh:  true,
		buffered: true,
		done:     make(chan struct{}),
		ctx:      context.Background(),
	}
	select {
	case f.bufferedReqChan <- req:
		go func() {
			<-req.done
			if req.err != nil {
				f.log.CDebugf(ctx, "Failed to refresh cached Favorites ("+
					"error in main loop): %+v", req.err)
			}
		}()
	default:
		// There's already a buffered request waiting.
	}
}

// ClearCache clears the cached list of favorites.
func (f *Favorites) ClearCache(ctx context.Context) {
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()
	if f.disabled || f.shutdown {
		return
	}
	// This request is non-blocking, so use a throw-away done channel
	// and context.
	req := &favReq{
		clear:   true,
		refresh: false,
		done:    make(chan struct{}),
		ctx:     context.Background(),
	}
	f.wg.Add(1)
	select {
	case f.reqChan <- req:
	case <-ctx.Done():
		f.wg.Done()
		return
	}
}

// Get returns the logged-in user's list of favorites. It uses the cache.
func (f *Favorites) Get(ctx context.Context) ([]favorites.Folder, error) {
	if f.disabled {
		session, err := f.config.KBPKI().GetCurrentSession(ctx)
		if err == nil {
			// Add favorites only for the current user.
			return []favorites.Folder{
				{Name: string(session.Name), Type: tlf.Private},
				{Name: string(session.Name), Type: tlf.Public},
			}, nil
		}
		return nil, nil
	}
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()
	if f.shutdown {
		return nil, data.ShutdownHappenedError{}
	}
	favChan := make(chan []favorites.Folder, 1)
	req := &favReq{
		ctx:  ctx,
		favs: favChan,
		done: make(chan struct{}),
	}
	err := f.sendReq(ctx, req)
	if err != nil {
		return nil, err
	}
	return <-favChan, nil
}

// setHomeTLFInfo should be called when a new user logs in so that their home
// TLFs can be returned as favorites.
func (f *Favorites) setHomeTLFInfo(ctx context.Context, info homeTLFInfo) {
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()
	if f.shutdown {
		return
	}
	// This request is non-blocking, so use a throw-away done channel
	// and context.
	req := &favReq{
		homeTLFInfo: &info,
		done:        make(chan struct{}),
		ctx:         context.Background(),
	}
	f.wg.Add(1)
	select {
	case f.reqChan <- req:
	case <-ctx.Done():
		f.wg.Done()
		return
	}
}

// GetAll returns the logged-in user's list of favorite, new, and ignored TLFs.
// It uses the cache.
func (f *Favorites) GetAll(ctx context.Context) (keybase1.FavoritesResult,
	error) {
	if f.disabled {
		session, err := f.config.KBPKI().GetCurrentSession(ctx)
		if err == nil {
			// Add favorites only for the current user.
			return keybase1.FavoritesResult{
				FavoriteFolders: []keybase1.Folder{
					{
						Name:       string(session.Name),
						Private:    false,
						Created:    false,
						FolderType: keybase1.FolderType_PUBLIC,
						TeamID:     &f.homeTLFInfo.PublicTeamID,
					},
					{
						Name:       string(session.Name),
						Private:    true,
						Created:    false,
						FolderType: keybase1.FolderType_PRIVATE,
						TeamID:     &f.homeTLFInfo.PrivateTeamID,
					},
				},
			}, nil
		}
		return keybase1.FavoritesResult{}, nil
	}
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()

	if f.shutdown {
		return keybase1.FavoritesResult{}, data.ShutdownHappenedError{}
	}
	favChan := make(chan keybase1.FavoritesResult, 1)
	req := &favReq{
		ctx:     ctx,
		favsAll: favChan,
		done:    make(chan struct{}),
	}
	err := f.sendReq(ctx, req)
	if err != nil {
		return keybase1.FavoritesResult{}, err
	}
	return <-favChan, nil
}
