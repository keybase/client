package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/kbfs/libkbfs"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")
var memprofile = flag.String("memprofile", "", "write memory profile to file")
var local = flag.Bool("local", false,
	"use a fake local user DB instead of Keybase")
var localUserFlag = flag.String("localuser", "strib",
	"fake local user (only valid when local=true)")
var clientFlag = flag.Bool("client", false, "use keybase daemon")

func printUsageAndExit() {
	log.Fatal("Usage:\n  kbfs [-client|-local] [stat|dir|mkdir|read|write] /keybase/path/to/file")
}

func splitHelper(cleanPath string) []string {
	parentPathSlash, child := path.Split(cleanPath)
	parentPath := parentPathSlash[:len(parentPathSlash)-1]
	if parentPath == "" {
		return []string{child}
	}
	return append(splitHelper(parentPath), child)
}

func split(pathStr string) ([]string, error) {
	cleanPath := path.Clean(pathStr)
	if !path.IsAbs(cleanPath) {
		return nil, fmt.Errorf("%s is not an absolute path", pathStr)
	}
	return splitHelper(cleanPath), nil
}

func openNode(ctx context.Context, config libkbfs.Config, path string, components []string) (n libkbfs.Node, de libkbfs.DirEntry, err error) {
	defer func() {
		if err != nil {
			if n != nil {
				n.Forget()
			}
			n = nil
			de = libkbfs.DirEntry{}
		}
	}()

	if len(components) < 2 || components[0] != "keybase" {
		err = fmt.Errorf("%s is not of the form /keybase/top_level_folder", path)
		return
	}

	dh, err := libkbfs.ParseTlfHandle(ctx, config, components[1])
	if err != nil {
		return
	}

	n, de, err = config.KBFSOps().GetOrCreateRootNodeForHandle(ctx, dh)
	if err != nil {
		return
	}

	for i := 2; i < len(components); i++ {
		cn, cde, err := config.KBFSOps().Lookup(ctx, n, components[i])
		if err != nil {
			return nil, libkbfs.DirEntry{}, err
		}
		n.Forget()
		n = cn
		de = cde
	}

	return
}

func openDir(ctx context.Context, config libkbfs.Config, path string, components []string) (libkbfs.Node, error) {
	n, de, err := openNode(ctx, config, path, components)
	if err != nil {
		return nil, err
	}

	// TODO: What to do with symlinks?

	if de.Type != libkbfs.Dir {
		return nil, fmt.Errorf("%s is not a dir, but a %s", path, de.Type)
	}

	return n, nil
}

func openFile(ctx context.Context, config libkbfs.Config, path string, components []string) (libkbfs.Node, error) {
	n, de, err := openNode(ctx, config, path, components)
	if err != nil {
		return nil, err
	}

	// TODO: What to do with symlinks?

	if de.Type != libkbfs.File && de.Type != libkbfs.Exec {
		return nil, fmt.Errorf("%s is not a file, but a %s", path, de.Type)
	}

	return n, nil
}

func stat(ctx context.Context, config libkbfs.Config, nodePath string) error {
	components, err := split(nodePath)
	if err != nil {
		return err
	}

	n, de, err := openNode(ctx, config, nodePath, components)
	if err != nil {
		return err
	}

	defer n.Forget()

	var symPathStr string
	if de.Type == libkbfs.Sym {
		symPathStr = fmt.Sprintf("SymPath: %s, ", de.SymPath)
	}

	mtimeStr := time.Unix(0, de.Mtime).String()
	ctimeStr := time.Unix(0, de.Ctime).String()

	fmt.Printf("{Type: %s, Size: %d, %sMtime: %s, Ctime: %s}\n", de.Type, de.Size, symPathStr, mtimeStr, ctimeStr)

	return nil
}

func dir(ctx context.Context, config libkbfs.Config, filePath string) error {
	components, err := split(filePath)
	if err != nil {
		return err
	}

	// GetDirChildren doesn't verify the dir-ness of the node
	// correctly (since it ends up creating a new DirBlock if the
	// node isn't in the cache already).
	//
	// TODO: Fix the above, then just use openNode.
	dirNode, err := openDir(ctx, config, filePath, components)
	if err != nil {
		return err
	}

	defer dirNode.Forget()

	children, err := config.KBFSOps().GetDirChildren(ctx, dirNode)
	if err != nil {
		return err
	}

	for name, childType := range children {
		fmt.Printf("%s\t%s\n", name, childType)
	}

	return nil
}

// The operations below are racy, but that is inherent in a
// distributed FS.

func mkdir(ctx context.Context, config libkbfs.Config, dirPath string) error {
	components, err := split(dirPath)
	if err != nil {
		return err
	}

	parentComponents := components[:len(components)-1]
	parentNode, err := openDir(ctx, config, dirPath, parentComponents)
	if err != nil {
		return err
	}

	defer parentNode.Forget()

	kbfsOps := config.KBFSOps()

	dirname := components[len(components)-1]

	dirNode, _, err := kbfsOps.CreateDir(ctx, parentNode, dirname)
	if err != nil {
		return err
	}

	defer dirNode.Forget()

	return nil
}

func read(ctx context.Context, config libkbfs.Config, filePath string) error {
	components, err := split(filePath)
	if err != nil {
		return err
	}

	fileNode, err := openFile(ctx, config, filePath, components)
	if err != nil {
		return err
	}

	defer fileNode.Forget()

	var buf [4096]byte
	var off int64

	for {
		read, err := config.KBFSOps().Read(ctx, fileNode, buf[:], off)
		if err != nil {
			return err
		}

		if read > 0 {
			_, err := os.Stdout.Write(buf[:read])
			if err != nil {
				return err
			}
		} else {
			break
		}

		off += read
	}

	return nil
}

func write(ctx context.Context, config libkbfs.Config, filePath string) error {
	components, err := split(filePath)
	if err != nil {
		return err
	}

	parentComponents := components[:len(components)-1]
	parentNode, err := openDir(ctx, config, filePath, parentComponents)
	if err != nil {
		return err
	}

	defer parentNode.Forget()

	kbfsOps := config.KBFSOps()

	filename := components[len(components)-1]
	fileExistErr := libkbfs.NoSuchNameError{filename}

	// The operations below are racy, but that is inherent to a
	// distributed FS.

	fileNode, _, err := kbfsOps.Lookup(ctx, parentNode, filename)
	if err != nil && err != fileExistErr {
		return err
	}

	if err == fileExistErr {
		fileNode, _, err = kbfsOps.CreateFile(ctx, parentNode, filename, false)
		if err != nil {
			return err
		}

		defer fileNode.Forget()
	} else {
		defer fileNode.Forget()

		err = kbfsOps.Truncate(ctx, fileNode, 0)
		if err != nil {
			return err
		}
	}

	// TODO: Stream the read.
	data, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		return err
	}

	if len(data) == 0 {
		return nil
	}

	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		return err
	}

	return kbfsOps.Sync(ctx, fileNode)
}

func main() {
	flag.Parse()
	if len(flag.Args()) < 2 {
		printUsageAndExit()
	}

	var localUser string
	if *local {
		localUser = *localUserFlag
	} else if *clientFlag {
		localUser = ""
	} else {
		printUsageAndExit()
	}

	config, err := libkbfs.Init(localUser, *cpuprofile, *memprofile)
	if err != nil {
		log.Fatal(err)
	}

	defer libkbfs.Shutdown(*memprofile)

	cmd := flag.Arg(0)
	path := flag.Arg(1)

	ctx := context.Background()

	switch cmd {
	case "stat":
		err := stat(ctx, config, path)
		if err != nil {
			log.Fatal(err)
		}

	case "dir":
		err := dir(ctx, config, path)
		if err != nil {
			log.Fatal(err)
		}

	case "mkdir":
		err := mkdir(ctx, config, path)
		if err != nil {
			log.Fatal(err)
		}

	case "read":
		err := read(ctx, config, path)
		if err != nil {
			log.Fatal(err)
		}

	case "write":
		err := write(ctx, config, path)
		if err != nil {
			log.Fatal(err)
		}

	default:
		log.Fatalf("Unknown command %s", cmd)
	}
}
