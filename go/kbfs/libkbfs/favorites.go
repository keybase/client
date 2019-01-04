// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/syndtr/goleveldb/leveldb"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

const (
	disableFavoritesEnvVar           = "KEYBASE_DISABLE_FAVORITES"
	favoritesCacheExpirationTime     = time.Hour * 24 * 7 // one week
	kbfsFavoritesCacheSubfolder      = "kbfs_favorites"
	favoritesDiskCacheFilename       = "kbfsFavorites.leveldb"
	favoritesDiskCacheVersion        = 1
	favoritesDiskCacheStorageVersion = 1
)

var errNoFavoritesCache = errors.New("Disk favorites cache not present")

type errIncorrectFavoritesCacheVersion struct {
	cache   string
	version int
}

func (e errIncorrectFavoritesCacheVersion) Error() string {
	return fmt.Sprintf("decoding of %s favorites cache failed: version was %d",
		e.cache, e.version)
}

type favToAdd struct {
	Favorite

	// created, if set to true, indicates that this is the first time the TLF has
	// ever existed. It is only used when adding the TLF to favorites
	created bool
}

func (f favToAdd) ToKBFolder() keybase1.Folder {
	return f.Favorite.ToKBFolder(f.created)
}

// favReq represents a request to access the logged-in user's
// favorites list.  A single request can do one or more of the
// following: refresh the current cached list, add a favorite, remove
// a favorite, and get all the favorites.  When the request is done,
// the resulting error (or nil) is sent over the done channel.  The
// given ctx is used for all network operations.
type favReq struct {
	// Request types
	clear   bool
	refresh bool
	toAdd   []favToAdd
	toDel   []Favorite
	favs    chan<- []Favorite

	// Closed when the request is done.
	done chan struct{}
	// Set before done is closed
	err error

	// Context
	ctx context.Context
}

// Favorites manages a user's favorite list.
type Favorites struct {
	config   Config
	disabled bool
	log      logger.Logger

	// Channels for interacting with the favorites cache
	reqChan chan *favReq

	wg kbfssync.RepeatedWaitGroup

	// cache tracks the favorites for this user, that we know about.
	// It may not be consistent with the server's view of the user's
	// favorites list, if other devices have modified the list since
	// the last refresh.
	cache           map[Favorite]bool
	cacheExpireTime time.Time

	diskCache *levelDb

	inFlightLock sync.Mutex
	inFlightAdds map[favToAdd]*favReq

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
		config:       config,
		reqChan:      reqChan,
		inFlightAdds: make(map[favToAdd]*favReq),
		log:          log,
	}

	return f
}

// NewFavorites constructs a new Favorites instance.
func NewFavorites(config Config) *Favorites {
	return newFavoritesWithChan(config, make(chan *favReq, 100))
}

type favoritesCacheForDisk struct {
	version int
	cache   map[Favorite]bool
}
type favoritesCacheEncryptedForDisk struct {
	version        int
	encryptedCache []byte
}

func (f *Favorites) readCacheFromDisk(ctx context.Context) error {
	// Read the encrypted cache from disk
	db, err := openVersionedLevelDB(f.log, f.config.StorageRoot(),
		kbfsFavoritesCacheSubfolder, favoritesDiskCacheStorageVersion,
		favoritesDiskCacheFilename)
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
	if decodedData.version != favoritesDiskCacheStorageVersion {
		return errIncorrectFavoritesCacheVersion{cache: "serialized",
			version: decodedData.version}
	}

	// Send the data to the service to be decrypted
	decryptedData, err := f.config.KeybaseService().DecryptFavorites(ctx,
		decodedData.encryptedCache)
	if err != nil {
		return err
	}

	// Decode the data into the a map
	var cache favoritesCacheForDisk
	err = f.config.Codec().Decode(decryptedData, &cache)
	if err != nil {
		return err
	}
	if cache.version != favoritesDiskCacheVersion {
		return errIncorrectFavoritesCacheVersion{cache: "encrypted",
			version: decodedData.version}
	}

	f.cache = cache.cache
	return nil
}

func (f *Favorites) writeCacheToDisk(ctx context.Context) error {
	if f.diskCache == nil {
		return errNoFavoritesCache
	}
	// Encode the cache map into a byte buffer
	cacheForDisk := favoritesCacheForDisk{
		cache:   f.cache,
		version: favoritesDiskCacheVersion,
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
	// the levelDb.
	cacheEncryptedForDisk := favoritesCacheEncryptedForDisk{
		encryptedCache: data,
		version:        favoritesDiskCacheStorageVersion,
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
		delete(f.inFlightAdds, fav)
	}
}

// sendChangesToEditHistory notes any deleted favorites and removes them
// from this user's kbfsedits.UserHistory.
func (f *Favorites) sendChangesToEditHistory(oldCache map[Favorite]bool) {
	for oldFav := range oldCache {
		if !f.cache[oldFav] {
			f.config.UserHistory().ClearTLF(tlf.CanonicalName(oldFav.Name),
				oldFav.Type)
		}
	}
	for newFav := range f.cache {
		if !oldCache[newFav] {
			f.config.KBFSOps().RefreshEditHistory(newFav)
		}
	}
}

func (f *Favorites) handleReq(req *favReq) (err error) {
	defer func() { f.closeReq(req, err) }()

	kbpki := f.config.KBPKI()
	// Fetch a new list if:
	//  * The user asked us to refresh
	//  * We haven't fetched it before
	//  * It's stale
	if req.refresh || f.cache == nil || f.config.Clock().Now().After(
		f.cacheExpireTime) && !req.clear {

		// load cache from server
		folders, err := kbpki.FavoriteList(req.ctx)
		if err != nil {
			if req.refresh || f.cache == nil {
				// if we're supposed to refresh the cache and it's not
				// working, mark the current cache expired.
				now := f.config.Clock().Now()
				if now.After(f.cacheExpireTime) {
					f.cacheExpireTime = now
				}
				return err
			}
			// If we weren't explicitly asked to refresh, we can return possibly
			// stale favorites rather than return nothing.
			f.log.CDebugf(req.ctx,
				"Serving possibly stale favorites; new data could not be"+
					" fetched: %v", err)
		} else { // Successfully got new favorites from server.
			oldCache := f.cache
			f.cache = make(map[Favorite]bool)
			f.cacheExpireTime = libkb.ForceWallClock(f.config.Clock().Now()).Add(
				favoritesCacheExpirationTime)
			for _, folder := range folders {
				f.cache[*NewFavoriteFromFolder(folder)] = true
			}
			session, err := f.config.KBPKI().GetCurrentSession(req.ctx)
			if err == nil {
				// Add favorites for the current user, that cannot be deleted.
				f.cache[Favorite{string(session.Name), tlf.Private}] = true
				f.cache[Favorite{string(session.Name), tlf.Public}] = true
				err = f.writeCacheToDisk(req.ctx)
				if err != nil {
					f.log.CWarningf(req.ctx,
						"Could not write favorites to disk cache: %v", err)
				}
			}
			if oldCache != nil {
				f.sendChangesToEditHistory(oldCache)
			}
		}
	} else if req.clear {
		f.cache = nil
		return nil
	}

	for _, fav := range req.toAdd {
		if !fav.created && f.cache[fav.Favorite] {
			continue
		}
		err := kbpki.FavoriteAdd(req.ctx, fav.ToKBFolder())
		if err != nil {
			f.log.CDebugf(req.ctx,
				"Failure adding favorite %v: %v", fav, err)
			return err
		}
		f.cache[fav.Favorite] = true
	}

	for _, fav := range req.toDel {
		// Since our cache isn't necessarily up-to-date, always delete
		// the favorite.
		folder := fav.ToKBFolder(false)
		err := kbpki.FavoriteDelete(req.ctx, folder)
		if err != nil {
			return err
		}
		delete(f.cache, fav)
		f.config.UserHistory().ClearTLF(tlf.CanonicalName(fav.Name), fav.Type)
	}

	if req.favs != nil {
		favorites := make([]Favorite, 0, len(f.cache))
		for fav := range f.cache {
			favorites = append(favorites, fav)
		}
		req.favs <- favorites
	}

	return nil
}

func (f *Favorites) loop() {
	for req := range f.reqChan {
		f.handleReq(req)
		f.wg.Done()
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
	if f.diskCache != nil {
		err := f.diskCache.Close()
		if err != nil {
			f.log.CWarningf(context.Background(),
				"Could not close disk favorites cache: %v", err)
		}
	}
	return f.wg.Wait(context.Background())
}

func (f *Favorites) hasShutdown() bool {
	f.muShutdown.RLock()
	defer f.muShutdown.RUnlock()
	return f.shutdown
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
	ctx context.Context, fav favToAdd) (req *favReq, doSend bool) {
	f.inFlightLock.Lock()
	defer f.inFlightLock.Unlock()
	req, ok := f.inFlightAdds[fav]
	if !ok {
		req = &favReq{
			ctx:   ctx,
			toAdd: []favToAdd{fav},
			done:  make(chan struct{}),
		}
		f.inFlightAdds[fav] = req
		doSend = true
	}
	return req, doSend
}

// Add adds a favorite to your favorites list.
func (f *Favorites) Add(ctx context.Context, fav favToAdd) error {
	if f.disabled {
		return nil
	}
	if f.hasShutdown() {
		return ShutdownHappenedError{}
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
func (f *Favorites) AddAsync(ctx context.Context, fav favToAdd) {
	if f.disabled || f.hasShutdown() {
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
func (f *Favorites) Delete(ctx context.Context, fav Favorite) error {
	if f.disabled {
		return nil
	}
	if f.hasShutdown() {
		return ShutdownHappenedError{}
	}
	return f.sendReq(ctx, &favReq{
		ctx:   ctx,
		toDel: []Favorite{fav},
		done:  make(chan struct{}),
	})
}

// RefreshCache refreshes the cached list of favorites.
func (f *Favorites) RefreshCache(ctx context.Context) {
	if f.disabled || f.hasShutdown() {
		return
	}
	// This request is non-blocking, so use a throw-away done channel
	// and context.
	req := &favReq{
		refresh: true,
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

// ClearCache clears the cached list of favorites.
func (f *Favorites) ClearCache(ctx context.Context) {
	if f.disabled || f.hasShutdown() {
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
func (f *Favorites) Get(ctx context.Context) ([]Favorite, error) {
	if f.disabled {
		session, err := f.config.KBPKI().GetCurrentSession(ctx)
		if err == nil {
			// Add favorites only for the current user.
			return []Favorite{
				{string(session.Name), tlf.Private},
				{string(session.Name), tlf.Public},
			}, nil
		}
		return nil, nil
	}
	if f.hasShutdown() {
		return nil, ShutdownHappenedError{}
	}
	favChan := make(chan []Favorite, 1)
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
