package libfuse

import (
	"os"
	"strings"
	"sync"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// FolderList is a node that can list all of the logged-in user's
// favorite top-level folders, on either a public or private basis.
type FolderList struct {
	fs *FS
	// only accept public folders
	public bool

	mu      sync.Mutex
	folders map[string]*Dir
}

var _ fs.Node = (*FolderList)(nil)

// Attr implements the fs.Node interface.
func (*FolderList) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0755
	return nil
}

var _ fs.NodeRequestLookuper = (*FolderList)(nil)

// Lookup implements the fs.NodeRequestLookuper interface.
func (fl *FolderList) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (node fs.Node, err error) {
	ctx = NewContextWithOpID(ctx, fl.fs.log)
	fl.fs.log.CDebugf(ctx, "FL Lookup %s", req.Name)
	defer func() { fl.fs.reportErr(ctx, err) }()
	fl.mu.Lock()
	defer fl.mu.Unlock()

	if req.Name == libkbfs.ErrorFile {
		return NewErrorFile(fl.fs, resp), nil
	}

	if req.Name == MetricsFileName {
		return NewMetricsFile(fl.fs, resp), nil
	}

	if child, ok := fl.folders[req.Name]; ok {
		return child, nil
	}

	// Shortcut for dreaded extraneous OSX finder lookups
	if strings.HasPrefix(req.Name, "._") {
		return nil, fuse.ENOENT
	}

	rootNode, _, err :=
		fl.fs.config.KBFSOps().GetOrCreateRootNode(
			ctx, req.Name, fl.public, libkbfs.MasterBranch)
	switch err := err.(type) {
	case nil:
		// No error.
		break

	case libkbfs.TlfNameNotCanonical:
		// Non-canonical name.
		n := &Alias{
			canon: err.NameToTry,
		}
		return n, nil

	case libkbfs.NoSuchNameError:
		// Invalid public TLF.
		return nil, fuse.ENOENT

	case libkbfs.WriteAccessError:
		// No permissions to create TLF.
		fl.fs.log.CDebugf(ctx, "Local user doesn't have permission to create "+
			" %s and it doesn't exist yet, so making an empty folder", req.Name)
		// Only cache this empty folder for a minute, in case a valid
		// writer comes along and creates it.
		resp.EntryValid = 60 * time.Second
		return &EmptyFolder{fl.fs}, nil

	default:
		// Some other error.
		return nil, err
	}

	folderBranch := rootNode.GetFolderBranch()
	folder := &Folder{
		fs:           fl.fs,
		list:         fl,
		name:         req.Name,
		folderBranch: folderBranch,
		nodes:        map[libkbfs.NodeID]fs.Node{},
	}

	// TODO unregister all at unmount
	if err := fl.fs.config.Notifier().RegisterForChanges([]libkbfs.FolderBranch{folderBranch}, folder); err != nil {
		return nil, err
	}

	child := newDir(folder, rootNode)
	folder.nodes[rootNode.GetID()] = child

	fl.folders[req.Name] = child
	return child, nil
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

var _ fs.Handle = (*FolderList)(nil)

var _ fs.HandleReadDirAller = (*FolderList)(nil)

func (fl *FolderList) getDirent(ctx context.Context, work <-chan *libkbfs.Favorite, results chan<- fuse.Dirent) error {
	for {
		select {
		case fav, ok := <-work:
			if !ok {
				return nil
			}
			results <- fuse.Dirent{
				Type: fuse.DT_Dir,
				Name: fav.Name,
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// ReadDirAll implements the ReadDirAll interface.
func (fl *FolderList) ReadDirAll(ctx context.Context) (res []fuse.Dirent, err error) {
	ctx = NewContextWithOpID(ctx, fl.fs.log)
	fl.fs.log.CDebugf(ctx, "FL ReadDirAll")
	defer func() { fl.fs.reportErr(ctx, err) }()
	favs, err := fl.fs.config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		return nil, err
	}
	work := make(chan *libkbfs.Favorite)
	results := make(chan fuse.Dirent)
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

outer:
	for {
		select {
		case dirent, ok := <-results:
			if !ok {
				break outer
			}
			res = append(res, dirent)
		case err := <-errCh:
			return nil, err
		}
	}
	return res, nil
}

var _ fs.NodeRemover = (*Dir)(nil)

// Remove implements the fs.NodeRemover interface for FolderList.
func (fl *FolderList) Remove(ctx context.Context, req *fuse.RemoveRequest) (err error) {
	return fuse.EPERM
}
