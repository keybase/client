package libkbfs

import (
	"sync"

	"golang.org/x/net/context"
)

// favReq represents a request to access the logged-in user's
// favorites list.  A single request can do one or more of the
// following: refresh the current cached list, add a favorite, remove
// a favorite, and get all the favorites.  When the request is done,
// the resulting error (or nil) is sent over the done channel.  The
// given ctx is used for all network operations.
type favReq struct {
	// Request types
	refresh bool
	toAdd   []Favorite
	toDel   []Favorite
	favs    chan<- []Favorite

	// Signaled when the request is done.  Protected by
	// Favorites.inFlightLock.
	done []chan<- error

	// Context
	ctx context.Context
}

// Favorites manages a user's favorite list.
type Favorites struct {
	config Config

	// Channels for interacting with the favorites cache
	reqChan chan favReq

	// cache tracks the favorites for this user, that we know about.
	// It may not be consistent with the server's view of the user's
	// favorites list, if other devices have modified the list since
	// the last refresh.
	cache map[Favorite]bool

	inFlightLock sync.Mutex
	inFlightAdds map[Favorite]favReq
}

func newFavoritesWithChan(config Config, reqChan chan favReq) *Favorites {
	f := &Favorites{
		config:       config,
		reqChan:      reqChan,
		inFlightAdds: make(map[Favorite]favReq),
	}
	go f.loop()
	return f
}

// NewFavorites constructs a new Favorites instance.
func NewFavorites(config Config) *Favorites {
	return newFavoritesWithChan(config, make(chan favReq, 100))
}

func (f *Favorites) handleReq(req favReq) (err error) {
	defer func() {
		f.inFlightLock.Lock()
		defer f.inFlightLock.Unlock()
		for _, ch := range req.done {
			ch <- err
		}
		for _, fav := range req.toAdd {
			delete(f.inFlightAdds, fav)
		}
	}()

	kbpki := f.config.KBPKI()
	// Fetch a new list if:
	//  * The user asked us to refresh
	//  * We haven't fetched it before
	//  * The user wants the list of favorites.  TODO: use the cached list
	//    once we have proper invalidation from the server.
	if req.refresh || f.cache == nil || req.favs != nil {
		f.cache = make(map[Favorite]bool)
		folders, err := kbpki.FavoriteList(req.ctx)
		if err != nil {
			return err
		}

		for _, folder := range folders {
			f.cache[*NewFavoriteFromFolder(folder)] = true
		}
		username, _, err := f.config.KBPKI().GetCurrentUserInfo(req.ctx)
		if err == nil {
			// Add favorites for the current user, that cannot be deleted.
			f.cache[Favorite{string(username), true}] = true
			f.cache[Favorite{string(username), false}] = true
		}
	}

	for _, fav := range req.toAdd {
		if f.cache[fav] {
			continue
		}
		err := kbpki.FavoriteAdd(req.ctx, fav.toKBFolder())
		if err != nil {
			f.config.MakeLogger("").CDebugf(req.ctx,
				"Failure adding favorite %v: %v", fav, err)
			return err
		}
		f.cache[fav] = true
	}

	for _, fav := range req.toDel {
		// Since our cache isn't necessarily up-to-date, always delete
		// the favorite.
		folder := fav.toKBFolder()
		err := kbpki.FavoriteDelete(req.ctx, folder)
		if err != nil {
			return err
		}
		if !folder.Private {
			// Public folders may be stored under a different name,
			// pending CORE-2695.  TODO: remove me!
			folder.Name = folder.Name + ReaderSep + "public"
			err := kbpki.FavoriteDelete(req.ctx, folder)
			if err != nil {
				return err
			}
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
	}
}

// Shutdown shuts down this Favorites instance.
func (f *Favorites) Shutdown() {
	close(f.reqChan)
}

func (f *Favorites) waitOnErrChan(ctx context.Context,
	errChan <-chan error) (retry bool, err error) {
	select {
	case <-ctx.Done():
		return false, ctx.Err()
	case err := <-errChan:
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

func (f *Favorites) sendReq(ctx context.Context, req favReq) error {
	errChan := make(chan error, 1)
	req.done = append(req.done, errChan)
	req.ctx = ctx
	select {
	case f.reqChan <- req:
	case <-ctx.Done():
		return ctx.Err()
	}
	// With a direct sendReq call, we'll never have a shared request,
	// so no need to check the retry status.
	_, err := f.waitOnErrChan(ctx, errChan)
	return err
}

func (f *Favorites) startOrJoinAddReq(
	ctx context.Context, fav Favorite) (*favReq, <-chan error) {
	f.inFlightLock.Lock()
	defer f.inFlightLock.Unlock()
	req, ok := f.inFlightAdds[fav]
	var startReq *favReq
	if !ok {
		req = favReq{ctx: ctx, toAdd: []Favorite{fav}}
		f.inFlightAdds[fav] = req
		startReq = &req
	}
	errChan := make(chan error, 1)
	req.done = append(req.done, errChan)
	return startReq, errChan
}

// Add adds a favorite to your favorites list.
func (f *Favorites) Add(ctx context.Context, fav Favorite) error {
	doAdd := true
	var err error
	for doAdd {
		startReq, errChan := f.startOrJoinAddReq(ctx, fav)
		if startReq != nil {
			return f.sendReq(ctx, *startReq)
		}
		doAdd, err = f.waitOnErrChan(ctx, errChan)
	}
	return err
}

// AddAsync initiates a request to add this favorite to your favorites
// list, if one is not already in flight, but it doesn't wait for the
// result.  (It could block while kicking off the request, if lots of
// different favorite operations are in flight.)
func (f *Favorites) AddAsync(ctx context.Context, fav Favorite) {
	startReq, _ := f.startOrJoinAddReq(ctx, fav)
	if startReq != nil {
		select {
		case f.reqChan <- *startReq:
		case <-ctx.Done():
			return
		}
	}
}

// Delete deletes a favorite from the favorites list.  It is
// idempotent.
func (f *Favorites) Delete(ctx context.Context, fav Favorite) error {
	return f.sendReq(ctx, favReq{toDel: []Favorite{fav}})
}

// RefreshCache refreshes the cached list of favorites.
func (f *Favorites) RefreshCache(ctx context.Context) {
	// This request is non-blocking, so use a throw-away done channel
	// and context.
	req := favReq{
		refresh: true,
		done:    []chan<- error{make(chan error, 1)},
		ctx:     context.Background(),
	}
	select {
	case f.reqChan <- req:
	case <-ctx.Done():
		return
	}
}

// Get returns the logged-in users list of favorites. It
// doesn't use the cache.
func (f *Favorites) Get(ctx context.Context) ([]Favorite, error) {
	favChan := make(chan []Favorite, 1)
	req := favReq{
		favs: favChan,
	}
	err := f.sendReq(ctx, req)
	if err != nil {
		return nil, err
	}
	return <-favChan, nil
}
