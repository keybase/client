package libkbfs

import "golang.org/x/net/context"

type favReq struct {
	refresh  bool
	toAdd    []Favorite
	toDel    []Favorite
	favs     chan<- []Favorite
	done     chan<- error
	canceled <-chan struct{}
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

func (f *Favorites) handleReq(ctx context.Context, req favReq) {
	// Tie the calling context together with this one.
	if req.canceled != nil {
		var cancel context.CancelFunc
		ctx, cancel = context.WithCancel(ctx)
		defer cancel()
		// Wait for either the request to complete or be cancelled.
		go func() {
			select {
			case <-req.canceled:
				req.done <- context.Canceled
				cancel()
			case <-ctx.Done():
			}
		}()
	}

	kbpki := f.config.KBPKI()
	// Fetch a new list if:
	//  * The user asked us to refresh
	//  * We haven't fetched it before
	//  * The user wants the list of favorites.  TODO: use the cached list
	//    once we have proper invalidation from the server.
	if req.refresh || f.cache == nil || req.favs != nil {
		f.cache = make(map[Favorite]bool)
		folders, err := kbpki.FavoriteList(ctx)
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
		err := kbpki.FavoriteAdd(ctx, fav.toKBFolder())
		if err != nil {
			req.done <- err
			return
		}
	}

	for _, fav := range req.toDel {
		// Since our cache isn't necessarily up-to-date, always delete
		// the favorite.
		err := kbpki.FavoriteDelete(ctx, fav.toKBFolder())
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
		ctx := context.Background() // TODO: add debug tags
		f.handleReq(ctx, req)
	}
}

// Shutdown shuts down this Favorites instance.
func (f *Favorites) Shutdown() {
	close(f.reqChan)
}

func (f *Favorites) sendReq(ctx context.Context, req favReq) error {
	errChan := make(chan error, 1)
	req.done = errChan
	req.canceled = ctx.Done()
	f.reqChan <- req
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
	f.reqChan <- favReq{refresh: true, done: make(chan error, 1)}
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
