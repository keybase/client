package main

import (
	"log"
	"os"
	"sync"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func logMsg(msg interface{}) {
	log.Printf("FUSE: %s\n", msg)
}

func runNewFUSE(config *libkbfs.ConfigLocal, debug bool, mountpoint string) error {
	if debug {
		fuse.Debug = logMsg
	}

	c, err := fuse.Mount(mountpoint)
	if err != nil {
		return err
	}
	defer c.Close()

	filesys := &FS{
		config: config,
	}
	if err := fs.Serve(c, filesys); err != nil {
		return err
	}

	// check if the mount process has an error to report
	<-c.Ready
	if err := c.MountError; err != nil {
		return err
	}

	return nil
}

type FS struct {
	config *libkbfs.ConfigLocal
}

var _ fs.FS = (*FS)(nil)

func (f *FS) Root() (fs.Node, error) {
	n := &Root{
		fs:      f,
		folders: make(map[string]*Dir),
	}
	return n, nil
}

type Root struct {
	fs *FS

	mu      sync.Mutex
	folders map[string]*Dir
}

var _ fs.Node = (*Root)(nil)

func (*Root) Attr(a *fuse.Attr) {
	a.Mode = os.ModeDir | 0755
}

var _ fs.NodeRequestLookuper = (*Root)(nil)

func (r *Root) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (fs.Node, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if child, ok := r.folders[req.Name]; ok {
		return child, nil
	}

	dh, err := libkbfs.ParseDirHandle(ctx, r.fs.config, req.Name)
	if err != nil {
		return nil, err
	}
	if dh.IsPublic() {
		// public directories shouldn't be listed directly in root
		return nil, fuse.ENOENT
	}

	if canon := dh.ToString(r.fs.config); canon != req.Name {
		n := &Alias{
			canon: canon,
		}
		return n, nil
	}

	md, err := r.fs.config.KBFSOps().GetRootMDForHandle(dh)
	if err != nil {
		// TODO make errors aware of fuse
		return nil, err
	}

	folder := &Folder{
		fs: r.fs,
		id: md.Id,
		dh: dh,
	}
	child := &Dir{
		folder: folder,
		pathNode: libkbfs.PathNode{
			BlockPointer: md.Data().Dir.BlockPointer,
			Name:         req.Name,
		},
	}
	r.folders[req.Name] = child
	return child, nil
}

var _ fs.Handle = (*Root)(nil)

var _ fs.HandleReadDirAller = (*Root)(nil)

func (r *Root) getDirent(ctx context.Context, work <-chan libkbfs.DirId, results chan<- fuse.Dirent) error {
	for {
		select {
		case dirID, ok := <-work:
			if !ok {
				return nil
			}
			md, err := r.fs.config.KBFSOps().GetRootMD(dirID)
			if err != nil {
				return err
			}
			dh := md.GetDirHandle()
			name := dh.ToString(r.fs.config)
			results <- fuse.Dirent{
				Type: fuse.DT_Dir,
				Name: name,
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (r *Root) ReadDirAll(ctx context.Context) ([]fuse.Dirent, error) {
	favs, err := r.fs.config.KBFSOps().GetFavDirs()
	if err != nil {
		return nil, err
	}
	work := make(chan libkbfs.DirId)
	results := make(chan fuse.Dirent)
	errCh := make(chan error, 1)
	const workers = 10
	var wg sync.WaitGroup
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := r.getDirent(ctx, work, results); err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}()
	}

	go func() {
		// feed work
		for _, dirID := range favs {
			work <- dirID
		}
		close(work)
		wg.Wait()
		// workers are done
		close(results)
	}()

	var res []fuse.Dirent
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
