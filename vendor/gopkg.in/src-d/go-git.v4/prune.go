package git

import (
	"fmt"
	"time"

	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/filemode"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
	"gopkg.in/src-d/go-git.v4/storage"
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
	pw := &pruneWalker{
		Storer: r.Storer,
		seen:   map[plumbing.Hash]struct{}{},
	}
	// Walk over all the references in the repo.
	it, err := r.Storer.IterReferences()
	if err != nil {
		return nil
	}
	defer it.Close()
	err = it.ForEach(func(ref *plumbing.Reference) error {
		// Exit this iteration early for non-hash references.
		if ref.Type() != plumbing.HashReference {
			return nil
		}
		return pw.walkObjectTree(ref.Hash())
	})
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

type pruneWalker struct {
	Storer storage.Storer
	// seen is the set of objects seen in the repo.
	// seen map can become huge if walking over large
	// repos. Thus using struct{} as the value type.
	seen map[plumbing.Hash]struct{}
}

func (p *pruneWalker) isSeen(hash plumbing.Hash) bool {
	_, seen := p.seen[hash]
	return seen
}

func (p *pruneWalker) add(hash plumbing.Hash) {
	p.seen[hash] = struct{}{}
}

// walkObjectTree walks over all objects and remembers references
// to them in the pruneWalker. This is used instead of the revlist
// walks because memory usage is tight with huge repos.
func (p *pruneWalker) walkObjectTree(hash plumbing.Hash) error {
	// Check if we have already seen, and mark this object
	if p.isSeen(hash) {
		return nil
	}
	p.add(hash)
	// Fetch the object.
	obj, err := object.GetObject(p.Storer, hash)
	if err != nil {
		return fmt.Errorf("Getting object %s failed: %v", hash, err)
	}
	// Walk all children depending on object type.
	switch obj := obj.(type) {
	case *object.Commit:
		err = p.walkObjectTree(obj.TreeHash)
		if err != nil {
			return err
		}
		for _, h := range obj.ParentHashes {
			err = p.walkObjectTree(h)
			if err != nil {
				return err
			}
		}
	case *object.Tree:
		for i := range obj.Entries {
			// Shortcut for blob objects:
			// 'or' the lower bits of a mode and check that it
			// it matches a filemode.Executable. The type information
			// is in the higher bits, but this is the cleanest way
			// to handle plain files with different modes.
			// Other non-tree objects are somewhat rare, so they
			// are not special-cased.
			if obj.Entries[i].Mode|0755 == filemode.Executable {
				p.add(obj.Entries[i].Hash)
				continue
			}
			// Normal walk for sub-trees (and symlinks etc).
			err = p.walkObjectTree(obj.Entries[i].Hash)
			if err != nil {
				return err
			}
		}
	default:
		// Error out on unhandled object types.
		return fmt.Errorf("Unknown object %X %s %T\n", obj.ID(), obj.Type(), obj)
	}
	return nil
}
