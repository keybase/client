// Keybase file system

package main

import (
	"flag"
	_ "fmt"
	"log"

	_ "github.com/hanwen/go-fuse/fuse"
	"github.com/hanwen/go-fuse/fuse/nodefs"
	libkb "github.com/keybase/go-libkb"
	libkbfs "github.com/keybase/go-libkbfs"
	_ "github.com/ugorji/go/codec"
)

/**
type RootNode struct {
	nodefs.Node
}

type UserFile struct {
	nodefs.File
	name string
}

type UserNode struct {
	nodefs.Node
	file *UserFile
}

type FS struct {
	root *RootNode
}

func (n *RootNode) OpenDir(context *fuse.Context) (
	stream []fuse.DirEntry, code fuse.Status) {
	// no entries by default, eventually this will show the accessed dirs only
	return nil, fuse.OK
}

func (n *RootNode) Lookup(out *fuse.Attr, name string, context *fuse.Context) (
	node *nodefs.Inode, code fuse.Status) {
	node = n.Inode().GetChild(name)
	if node == nil {
		rname, err := libkb.ResolveUsername(name)
		if err != nil {
			return nil, fuse.ENOENT
		}
		unode := &UserNode{
			Node: nodefs.NewDefaultNode(),
			file: &UserFile{
				File: nodefs.NewDefaultFile(),
				name: fmt.Sprintf("%s\n", rname),
			},
		}
		node = n.Inode().NewChild(name, false, unode)
		unode.GetAttr(out, unode.file, context)
	}
	return node, fuse.OK
}

func (n *RootNode) GetAttr(attr *fuse.Attr, file nodefs.File,
	context *fuse.Context) (code fuse.Status) {
	attr.Mode = fuse.S_IFDIR | 0777
	return fuse.OK
}

func (n *UserNode) Open(flags uint32, context *fuse.Context) (
	file nodefs.File, code fuse.Status) {
	return n.file, fuse.OK
}

func (n *UserNode) GetAttr(attr *fuse.Attr, file nodefs.File,
	context *fuse.Context) (code fuse.Status) {
	attr.Size = uint64(len(n.file.name))
	attr.Mode = fuse.S_IFREG | 0644
	return fuse.OK
}

func (f *UserFile) GetAttr(attr *fuse.Attr) fuse.Status {
	attr.Size = uint64(len(f.name))
	return fuse.OK
}

func (f *UserFile) Read(buf []byte, off int64) (fuse.ReadResult, fuse.Status) {
	end := int(off) + int(len(buf))
	if end > len(f.name) {
		end = len(f.name)
	}

	return fuse.ReadResultData([]byte(f.name[off:end])), fuse.OK
}

func newFS() (fs *FS, err error) {
	fs = &FS{root: &RootNode{Node: nodefs.NewDefaultNode()}}
	err = nil
	return
}

*/

func main() {
	flag.Parse()
	if len(flag.Args()) < 1 {
		log.Fatal("Usage:\n  kbfs MOUNTPOINT")
	}

	// set up fake FS
	root := &libkbfs.FSNode{Node: nodefs.NewDefaultNode()}

	server, _, err := nodefs.MountRoot(flag.Arg(0), root, nil)
	if err != nil {
		log.Fatalf("Mount fail: %v\n", err)
	}

	server.SetDebug(true)
	libkb.G.Init()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureCaches()
	libkb.G.ConfigureAPI()
	server.Serve()
}
