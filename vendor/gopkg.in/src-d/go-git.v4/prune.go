package git

import (
	"time"

	"gopkg.in/src-d/go-git.v4/plumbing"
)

type PruneHandler func(unreferencedObjectHash plumbing.Hash) error
type PruneOptions struct {
	// OnlyObjectsOlderThan if set to non-zero value
	// selects only objects older than the time provided.
	OnlyObjectsOlderThan time.Time
	// Handler is called on matching objects
	Handler PruneHandler
}

// DeleteObject deletes an object from a repository.
// The type conveniently matches PruneHandler.
func (r *Repository) DeleteObject(hash plumbing.Hash) error {
	return r.Storer.DeleteLooseObject(hash)
}

func (r *Repository) Prune(opt PruneOptions) error {
	pw := newObjectWalker(r.Storer)
	err := pw.walkAllRefs()
	if err != nil {
		return err
	}
	// Now walk all (loose) objects in storage.
	err = r.Storer.ForEachObjectHash(func(hash plumbing.Hash) error {
		// Get out if we have seen this object.
		if pw.isSeen(hash) {
			return nil
		}
		// Otherwise it is a candidate for pruning.
		// Check out for too new objects next.
		if opt.OnlyObjectsOlderThan != (time.Time{}) {
			// Errors here are non-fatal. The object may be e.g. packed.
			// Or concurrently deleted. Skip such objects.
			t, err := r.Storer.LooseObjectTime(hash)
			if err != nil {
				return nil
			}
			// Skip too new objects.
			if !t.Before(opt.OnlyObjectsOlderThan) {
				return nil
			}
		}
		return opt.Handler(hash)
	})
	if err != nil {
		return err
	}
	return nil
}
