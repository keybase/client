package object

import (
	"io"

	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
)

type commitPreIterator struct {
	seen  map[plumbing.Hash]bool
	stack []CommitIter
	start *Commit
}

// NewCommitPreorderIter returns a CommitIter that walks the commit history,
// starting at the given commit and visiting its parents in pre-order.
// The given callback will be called for each visited commit. Each commit will
// be visited only once. If the callback returns an error, walking will stop
// and will return the error. Other errors might be returned if the history
// cannot be traversed (e.g. missing objects).
func NewCommitPreorderIter(c *Commit) CommitIter {
	return &commitPreIterator{
		seen:  make(map[plumbing.Hash]bool),
		stack: make([]CommitIter, 0),
		start: c,
	}
}

func (w *commitPreIterator) Next() (*Commit, error) {
	var c *Commit
	for {
		if w.start != nil {
			c = w.start
			w.start = nil
		} else {
			current := len(w.stack) - 1
			if current < 0 {
				return nil, io.EOF
			}

			var err error
			c, err = w.stack[current].Next()
			if err == io.EOF {
				w.stack = w.stack[:current]
				continue
			}

			if err != nil {
				return nil, err
			}
		}

		// check and update seen
		if w.seen[c.Hash] {
			continue
		}

		w.seen[c.Hash] = true
		if c.NumParents() > 0 {
			w.stack = append(w.stack, c.Parents())
		}

		return c, nil
	}
}

func (w *commitPreIterator) ForEach(cb func(*Commit) error) error {
	for {
		c, err := w.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		err = cb(c)
		if err == storer.ErrStop {
			break
		}
		if err != nil {
			return err
		}
	}

	return nil
}

func (w *commitPreIterator) Close() {}

type commitPostIterator struct {
	stack []*Commit
	seen  map[plumbing.Hash]bool
}

// NewCommitPostorderIter returns a CommitIter that walks the commit
// history like WalkCommitHistory but in post-order. This means that after
// walking a merge commit, the merged commit will be walked before the base
// it was merged on. This can be useful if you wish to see the history in
// chronological order.
func NewCommitPostorderIter(c *Commit) CommitIter {
	return &commitPostIterator{
		stack: []*Commit{c},
		seen:  make(map[plumbing.Hash]bool),
	}
}

func (w *commitPostIterator) Next() (*Commit, error) {
	for {
		if len(w.stack) == 0 {
			return nil, io.EOF
		}

		c := w.stack[len(w.stack)-1]
		w.stack = w.stack[:len(w.stack)-1]
		if w.seen[c.Hash] {
			continue
		}
		w.seen[c.Hash] = true

		err := c.Parents().ForEach(func(pcm *Commit) error {
			w.stack = append(w.stack, pcm)
			return nil
		})

		return c, err
	}
}

func (w *commitPostIterator) ForEach(cb func(*Commit) error) error {
	for {
		c, err := w.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		err = cb(c)
		if err == storer.ErrStop {
			break
		}
		if err != nil {
			return err
		}
	}

	return nil
}

func (w *commitPostIterator) Close() {}
