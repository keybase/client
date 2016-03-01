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
	favReqChan chan favReq

	// knownFavorites tracks the favorites for this user, that we know
	// about.  It may not include favorites that were added by other
	// devices.
	knownFavorites map[Favorite]bool
}

// NewFavorites constructs a new Favorites instance.
func NewFavorites(config Config) *Favorites {
	f := &Favorites{
		config:     config,
		favReqChan: make(chan favReq),
	}
	go f.favoritesLoop()
	return f
}

func (f *Favorites) handleFavReq(ctx context.Context, req favReq) {
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
	//  * The user wants the list of favorites.  TODO: use the cached list?
	if req.refresh || f.knownFavorites == nil || req.favs != nil {
		f.knownFavorites = make(map[Favorite]bool)
		folders, err := kbpki.FavoriteList(ctx)
		if err != nil {
			req.done <- err
			return
		}

		for _, folder := range folders {
			f.knownFavorites[*NewFavoriteFromFolder(folder)] = true
		}
	}

	for _, fav := range req.toAdd {
		// Only add the favorite if it's not already known.
		if _, ok := f.knownFavorites[fav]; !ok {
			err := kbpki.FavoriteAdd(ctx, fav.toKBFolder())
			if err != nil {
				req.done <- err
				return
			}
			f.knownFavorites[fav] = true
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
		delete(f.knownFavorites, fav)
	}

	if req.favs != nil {
		favorites := make([]Favorite, 0, len(f.knownFavorites))
		for fav := range f.knownFavorites {
			favorites = append(favorites, fav)
		}
		req.favs <- favorites
	}

	req.done <- nil
}

func (f *Favorites) favoritesLoop() {
	for req := range f.favReqChan {
		ctx := context.Background() // TODO: add debug tags
		f.handleFavReq(ctx, req)
	}
}

// Shutdown shuts down this Favorites instance.
func (f *Favorites) Shutdown() {
	close(f.favReqChan)
}

func (f *Favorites) sendReq(ctx context.Context, req favReq) error {
	errChan := make(chan error, 1)
	req.done = errChan
	req.canceled = ctx.Done()
	f.favReqChan <- req
	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errChan:
		return err
	}
}

// AddFavorite adds a favorite to your favorites list, unless it
// already exists in the cached list of favorites.
func (f *Favorites) AddFavorite(ctx context.Context, fav Favorite) error {
	return f.sendReq(ctx, favReq{toAdd: []Favorite{fav}})
}

// DeleteFavorite deletes a favorite from the favorites list.  It is
// idempotent.
func (f *Favorites) DeleteFavorite(ctx context.Context, fav Favorite) error {
	return f.sendReq(ctx, favReq{toDel: []Favorite{fav}})
}

// RefreshCachedFavorites refreshes the cached list of favorites.
func (f *Favorites) RefreshCachedFavorites(ctx context.Context) {
	f.favReqChan <- favReq{refresh: true, done: make(chan error, 1)}
}

// GetFavorites returns the logged-in users list of favorites. It
// doesn't use the cache.
func (f *Favorites) GetFavorites(ctx context.Context) ([]Favorite, error) {
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
