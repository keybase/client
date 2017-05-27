// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type favToAdd struct {
	Favorite

	// created, if set to true, indicates that this is the first time the TLF has
	// ever existed. It is only used when adding the TLF to favorites
	created bool
}

func (f favToAdd) toKBFolder() keybase1.Folder {
	return f.Favorite.toKBFolder(f.created)
}

// favReq represents a request to access the logged-in user's
// favorites list.  A single request can do one or more of the
// following: refresh the current cached list, add a favorite, remove
// a favorite, and get all the favorites.  When the request is done,
// the resulting error (or nil) is sent over the done channel.  The
// given ctx is used for all network operations.
type favReq struct {
	// Request types
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
	config Config

	// Channels for interacting with the favorites cache
	reqChan chan *favReq

	wg kbfssync.RepeatedWaitGroup

	// cache tracks the favorites for this user, that we know about.
	// It may not be consistent with the server's view of the user's
	// favorites list, if other devices have modified the list since
	// the last refresh.
	cache map[Favorite]bool

	inFlightLock sync.Mutex
	inFlightAdds map[favToAdd]*favReq

	muShutdown sync.RWMutex
	shutdown   bool
}

func newFavoritesWithChan(config Config, reqChan chan *favReq) *Favorites {
	f := &Favorites{
		config:       config,
		reqChan:      reqChan,
		inFlightAdds: make(map[favToAdd]*favReq),
	}
	go f.loop()
	return f
}

// NewFavorites constructs a new Favorites instance.
func NewFavorites(config Config) *Favorites {
	return newFavoritesWithChan(config, make(chan *favReq, 100))
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

func (f *Favorites) handleReq(req *favReq) (err error) {
	defer func() { f.closeReq(req, err) }()

	kbpki := f.config.KBPKI()
	// Fetch a new list if:
	//  * The user asked us to refresh
	//  * We haven't fetched it before
	//  * The user wants the list of favorites.  TODO: use the cached list
	//    once we have proper invalidation from the server.
	if req.refresh || f.cache == nil || req.favs != nil {
		folders, err := kbpki.FavoriteList(req.ctx)
		if err != nil {
			return err
		}

		f.cache = make(map[Favorite]bool)
		for _, folder := range folders {
			f.cache[*NewFavoriteFromFolder(folder)] = true
		}
		session, err := f.config.KBPKI().GetCurrentSession(req.ctx)
		if err == nil {
			// Add favorites for the current user, that cannot be deleted.
			f.cache[Favorite{string(session.Name), tlf.Private}] = true
			f.cache[Favorite{string(session.Name), tlf.Public}] = true
		}
	}

	for _, fav := range req.toAdd {
		if !fav.created && f.cache[fav.Favorite] {
			continue
		}
		err := kbpki.FavoriteAdd(req.ctx, fav.toKBFolder())
		if err != nil {
			f.config.MakeLogger("").CDebugf(req.ctx,
				"Failure adding favorite %v: %v", fav, err)
			return err
		}
		f.cache[fav.Favorite] = true
	}

	for _, fav := range req.toDel {
		// Since our cache isn't necessarily up-to-date, always delete
		// the favorite.
		folder := fav.toKBFolder(false)
		err := kbpki.FavoriteDelete(req.ctx, folder)
		if err != nil {
			return err
		}
		delete(f.cache, fav)
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
	f.muShutdown.Lock()
	defer f.muShutdown.Unlock()
	f.shutdown = true
	close(f.reqChan)
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
	if f.hasShutdown() {
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
	if f.hasShutdown() {
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

// Get returns the logged-in users list of favorites. It
// doesn't use the cache.
func (f *Favorites) Get(ctx context.Context) ([]Favorite, error) {
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
