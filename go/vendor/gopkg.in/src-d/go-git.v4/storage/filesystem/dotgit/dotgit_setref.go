// +build !norwfs

package dotgit

import (
	"fmt"
	"os"

	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/utils/ioutil"
)

func (d *DotGit) setRef(fileName, content string, old *plumbing.Reference) (err error) {
	// If we are not checking an old ref, just truncate the file.
	mode := os.O_RDWR | os.O_CREATE
	if old == nil {
		mode |= os.O_TRUNC
	}

	f, err := d.fs.OpenFile(fileName, mode, 0666)
	if err != nil {
		return err
	}

	defer func() {
		realErr := err
		ioutil.CheckClose(f, &err)
		if err == nil {
			// `CheckClose` doesn't override `err` if the `Close`
			// succeeds, so we don't have to worry about setting `err`
			// back to `realErr` in that case.
			return
		}
		if old != nil && realErr != nil {
			// If we failed in a way other than the close/unlock
			// failing, don't bother restoring the file below -- it
			// probably means the reference didn't check out correctly.
			return
		}
		// The `CheckClose` above does an unlock, which could fail on
		// storage layers where the unlock triggers a network
		// operation.  The `Lock` call below also might have failed in
		// the case where `old == nil`.  In that case, we shouldn't
		// leave the reference file lying around in a
		// possibly-corrupted state.  (Explicitly ignore errors below
		// since we don't want to overwrite the real `err` being
		// returned.)
		if old == nil {
			_ = d.fs.Remove(fileName)
			return
		}

		// If the file didn't start out empty, it's a bit risky to
		// overwrite it here without holding the lock.  But because we
		// can only get down here if it's an error trying to
		// close/unlock the file, it seems safe to overwrite the file
		// again (which in most storage layers would just revert the
		// local copy of the file to what it was before the failure).
		// TODO: explicitly require the storage layer to throw out
		// changes when the unlock fails?
		var oldContent string
		switch old.Type() {
		case plumbing.SymbolicReference:
			oldContent = fmt.Sprintf("ref: %s\n", old.Target())
		case plumbing.HashReference:
			oldContent = fmt.Sprintln(old.Hash().String())
		}

		f, openErr := d.fs.OpenFile(fileName, os.O_RDWR|os.O_TRUNC, 0666)
		if openErr != nil {
			return
		}
		_, _ = f.Write([]byte(oldContent))
		_ = f.Close()
	}()

	// Lock is unlocked by the deferred Close above. This is because Unlock
	// does not imply a fsync and thus there would be a race between
	// Unlock+Close and other concurrent writers. Adding Sync to go-billy
	// could work, but this is better (and avoids superfluous syncs).
	err = f.Lock()
	if err != nil {
		return err
	}

	// this is a no-op to call even when old is nil.
	err = d.checkReferenceAndTruncate(f, old)
	if err != nil {
		return err
	}

	_, err = f.Write([]byte(content))
	return err
}
