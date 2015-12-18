// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"sync"

	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// FolderList is a node that can list all of the logged-in user's
// favorite top-level folders, on either a public or private basis.
type FolderList struct {
	emptyFile
	fs *FS
	// only accept public folders
	public bool

	mu      sync.Mutex
	folders map[string]*Dir
}

// GetFileInformation for dokan.
func (*FolderList) GetFileInformation(*dokan.FileInfo) (*dokan.Stat, error) {
	return defaultDirectoryInformation()
}

// open tries to open the correct thing. Following aliases and deferring to
// Dir.open as necessary.
func (fl *FolderList) open(ctx context.Context, oc *openContext, path []string) (f dokan.File, isDir bool, err error) {
	ctx = NewContextWithOpID(ctx, fl.fs.log)
	fl.fs.log.CDebugf(ctx, "FL Lookup %s", path)
	defer func() { fl.fs.reportErr(ctx, err) }()

	if len(path) == 0 {
		if oc.mayNotBeDirectory() {
			return nil, true, dokan.ErrFileIsADirectory
		}
		return fl, true, nil
	}

	for ; oc.maxRedirections > 0; oc.maxRedirections-- {
		name := path[0]

		fl.mu.Lock()
		child, ok := fl.folders[name]
		fl.mu.Unlock()

		if ok {
			fl.fs.log.CDebugf(ctx, "FL Lookup recursing to child %q", name)
			return child.open(ctx, oc, path[1:])
		}

		fl.fs.log.CDebugf(ctx, "FL Lookup continuing")
		dh, err := libkbfs.ParseTlfHandle(ctx, fl.fs.config, name)
		if err != nil {
			return nil, false, err
		}

		if fl.public && !dh.HasPublic() {
			// no public folder exists for this folder
			return nil, false, dokan.ErrObjectPathNotFound
		}

		if canon := dh.ToString(ctx, fl.fs.config); canon != name {
			if len(path) == 1 && oc.isOpenReparsePoint() {
				fl.fs.log.CDebugf(ctx, "FL Lookup returning ALIAS")
				return &Alias{canon: canon}, false, nil
			}
			path[0] = canon
			continue
		}

		if fl.public {
			dh = &libkbfs.TlfHandle{
				Writers: dh.Writers,
				Readers: []keybase1.UID{keybase1.PublicUID},
			}
		}

		rootNode, _, err := fl.fs.config.KBFSOps().GetOrCreateRootNodeForHandle(ctx, dh, libkbfs.MasterBranch)
		if err != nil {
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

		fl.mu.Lock()
		child = newDir(folder, rootNode, path[0], nil)
		folder.nodes[rootNode.GetID()] = child
		fl.folders[name] = child
		fl.mu.Unlock()
		return child.open(ctx, oc, path[1:])
	}
	return nil, false, dokan.ErrObjectPathNotFound
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

			dh, err := libkbfs.ParseTlfHandle(ctx, fl.fs.config, fav.Name)
			if err != nil {
				break
			}

			if fl.public && !dh.HasPublic() {
				break
			}

			var ns dokan.NamedStat
			ns.Name = fav.Name
			ns.FileAttributes = fileAttributeDirectory
			ns.NumberOfLinks = 1

			if canon := dh.ToString(ctx, fl.fs.config); canon != fav.Name {
				ns.FileAttributes = fileAttributeReparsePoint
				ns.ReparsePointTag = reparsePointTagSymlink
			}

			results <- ns
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// FindFiles for dokan.
func (fl *FolderList) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, fl.fs.log)
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
