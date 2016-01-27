// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"sync"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type fileOpener interface {
	open(ctx context.Context, oc *openContext, path []string) (f dokan.File, isDir bool, err error)
	dokan.File
}

// FolderList is a node that can list all of the logged-in user's
// favorite top-level folders, on either a public or private basis.
type FolderList struct {
	emptyFile
	fs *FS
	// only accept public folders
	public bool

	mu      sync.Mutex
	folders map[string]fileOpener
}

// GetFileInformation for dokan.
func (*FolderList) GetFileInformation(*dokan.FileInfo) (*dokan.Stat, error) {
	return defaultDirectoryInformation()
}

// open tries to open the correct thing. Following aliases and deferring to
// Dir.open as necessary.
func (fl *FolderList) open(ctx context.Context, oc *openContext, path []string) (f dokan.File, isDir bool, err error) {
	fl.fs.log.CDebugf(ctx, "FL Lookup %s", path)
	defer func() { fl.fs.reportErr(ctx, err) }()

	if len(path) == 0 {
		if oc.mayNotBeDirectory() {
			return nil, true, dokan.ErrFileIsADirectory
		}
		return fl, true, nil
	}

	for oc.reduceRedirectionsLeft() {
		name := path[0]

		fl.mu.Lock()
		child, ok := fl.folders[name]
		fl.mu.Unlock()

		if ok {
			fl.fs.log.CDebugf(ctx, "FL Lookup recursing to child %q", name)
			return child.open(ctx, oc, path[1:])
		}

		fl.fs.log.CDebugf(ctx, "FL Lookup continuing")
		rootNode, _, err :=
			fl.fs.config.KBFSOps().GetOrCreateRootNode(
				ctx, name, fl.public, libkbfs.MasterBranch)
		switch err := err.(type) {
		case nil:
			// No error.
			break

		case libkbfs.TlfNameNotCanonical:
			// Non-canonical name.
			if len(path) == 1 {
				fl.fs.log.CDebugf(ctx, "FL Lookup Alias")
				target := err.NameToTry
				d, bf, err := fl.open(ctx, oc, []string{target})
				switch {
				case err == nil && oc.isOpenReparsePoint():
					d.Cleanup(nil)
					return &Alias{canon: target}, false, nil
				case err == nil:
					return d, bf, err
				case oc.isCreateDirectory():
					fl.fs.log.CDebugf(ctx, "FL Lookup returning EmptyFolder instead of Alias")
					e := &EmptyFolder{}
					fl.lockedAddChild(name, e)
					return e, true, nil
				}
				return nil, false, err
			}
			path[0] = err.NameToTry
			continue

		case libkbfs.NoSuchNameError, libkbfs.NoSuchUserError:
			// Invalid public TLF.
			if len(path) == 1 && oc.isCreateDirectory() {
				fl.fs.log.CDebugf(ctx, "FL Lookup returning EmptyFolder instead of Alias")
				e := &EmptyFolder{}
				fl.lockedAddChild(name, e)
				return e, true, nil
			}
			return nil, false, dokan.ErrObjectNameNotFound

		case libkbfs.WriteAccessError:
			if len(path) == 1 {
				return &EmptyFolder{}, true, nil
			}
			return nil, false, dokan.ErrObjectNameNotFound
		default:
			// Some other error.
			return nil, false, err
		}

		folderBranch := rootNode.GetFolderBranch()
		folder := &Folder{
			fs:           fl.fs,
			list:         fl,
			name:         name,
			folderBranch: folderBranch,
			nodes:        map[libkbfs.NodeID]dokan.File{},
		}

		// TODO unregister all at unmount
		if err := fl.fs.config.Notifier().RegisterForChanges([]libkbfs.FolderBranch{folderBranch}, folder); err != nil {
			return nil, false, err
		}

		child = newDir(folder, rootNode, path[0], nil)
		folder.nodes[rootNode.GetID()] = child
		fl.lockedAddChild(name, child)
		return child.open(ctx, oc, path[1:])
	}
	return nil, false, dokan.ErrObjectNameNotFound
}

func (fl *FolderList) forgetFolder(f *Folder) {
	fl.mu.Lock()
	defer fl.mu.Unlock()

	if err := fl.fs.config.Notifier().UnregisterFromChanges([]libkbfs.FolderBranch{f.folderBranch}, f); err != nil {
		fl.fs.log.Info("cannot unregister change notifier for folder %q: %v",
			f.name, err)
	}
	delete(fl.folders, f.name)
}

func (fl *FolderList) getDirent(ctx context.Context, work <-chan *libkbfs.Favorite, results chan<- dokan.NamedStat) error {
	for {
		select {
		case fav, ok := <-work:
			if !ok {
				return nil
			}

			var ns dokan.NamedStat
			ns.Name = fav.Name
			ns.FileAttributes = fileAttributeDirectory
			ns.NumberOfLinks = 1

			_, err := libkbfs.ParseTlfHandle(ctx, fl.fs.config.KBPKI(), fav.Name, fl.public)
			switch err.(type) {
			case nil:
				// No error.
				break

			case libkbfs.TlfNameNotCanonical:
				// Non-canonical name.
				ns.FileAttributes = fileAttributeReparsePoint
				ns.ReparsePointTag = reparsePointTagSymlink

			default:
				// Some other error.
				continue
			}

			results <- ns
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// FindFiles for dokan.
func (fl *FolderList) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	ctx := NewContextWithOpID(fl.fs)
	fl.fs.log.CDebugf(ctx, "FL ReadDirAll")
	defer func() { fl.fs.reportErr(ctx, err) }()
	favs, err := fl.fs.config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		return err
	}
	work := make(chan *libkbfs.Favorite)
	results := make(chan dokan.NamedStat)
	errCh := make(chan error, 1)
	const maxWorkers = 10
	var wg sync.WaitGroup
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	for i := 0; i < maxWorkers && i < len(favs); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := fl.getDirent(ctx, work, results); err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}()
	}

	go func() {
		// feed work
		for _, fav := range favs {
			if fl.public != fav.Public {
				continue
			}
			work <- fav
		}
		close(work)
		wg.Wait()
		// workers are done
		close(results)
	}()

	empty := true
outer:
	for {
		select {
		case dirent, ok := <-results:
			if !ok {
				break outer
			}
			empty = false
			err = callback(&dirent)
			if err != nil {
				return err
			}
		case err := <-errCh:
			return err
		}
	}
	if empty {
		return dokan.ErrObjectNameNotFound
	}
	return nil
}

func (fl *FolderList) lockedAddChild(name string, val fileOpener) {
	fl.mu.Lock()
	fl.folders[name] = val
	fl.mu.Unlock()
}
