package libkbfs

import "golang.org/x/net/context"

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

	// Signaled when the request is done
	done chan<- error

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
}

// NewFavorites constructs a new Favorites instance.
func NewFavorites(config Config) *Favorites {
	f := &Favorites{
		config:  config,
		reqChan: make(chan favReq),
	}
	go f.loop()
	return f
}

func (f *Favorites) handleReq(req favReq) {
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
			req.done <- err
			return
		}

		for _, folder := range folders {
			f.cache[*NewFavoriteFromFolder(folder)] = true
		}
	}

	for _, fav := range req.toAdd {
		// TODO: once we have proper cache invalidation from the API
		// server, we should only call FavoriteAdd if the folder isn't
		// already favorited.
		err := kbpki.FavoriteAdd(req.ctx, fav.toKBFolder())
		if err != nil {
			req.done <- err
			return
		}
	}

	for _, fav := range req.toDel {
		// Since our cache isn't necessarily up-to-date, always delete
		// the favorite.
		err := kbpki.FavoriteDelete(req.ctx, fav.toKBFolder())
		if err != nil {
			req.done <- err
			return
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

	req.done <- nil
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

func (f *Favorites) sendReq(ctx context.Context, req favReq) error {
	errChan := make(chan error, 1)
	req.done = errChan
	req.ctx = ctx
	select {
	case f.reqChan <- req:
	case <-ctx.Done():
		return ctx.Err()
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errChan:
		return err
	}
}

// Add adds a favorite to your favorites list, unless it
// already exists in the cached list of favorites.
func (f *Favorites) Add(ctx context.Context, fav Favorite) error {
	return f.sendReq(ctx, favReq{toAdd: []Favorite{fav}})
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
		done:    make(chan error, 1),
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
