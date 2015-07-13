package main

import (
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func byteCountStr(n int) string {
	if n == 1 {
		return "1 byte"
	}
	return fmt.Sprintf("%d bytes", n)
}

func printError(prefix string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %s\n", prefix, err)
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
		return nil, fmt.Errorf("split: %s is not an absolute path", pathStr)
	}
	return splitHelper(cleanPath), nil
}

func join(components []string) string {
	return "/" + strings.Join(components, "/")
}

func openNode(ctx context.Context, config libkbfs.Config, components []string) (n libkbfs.Node, de libkbfs.DirEntry, err error) {
	defer func() {
		if err != nil {
			n = nil
			de = libkbfs.DirEntry{}
		}
	}()

	if len(components) < 2 || components[0] != "keybase" {
		err = fmt.Errorf("openNode: %s is not a child of /keybase", join(components))
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
		n = cn
		de = cde
	}

	return
}

func openDir(ctx context.Context, config libkbfs.Config, components []string) (libkbfs.Node, error) {
	n, de, err := openNode(ctx, config, components)
	if err != nil {
		return nil, err
	}

	// TODO: What to do with symlinks?

	if de.Type != libkbfs.Dir {
		return nil, fmt.Errorf("openDir: %s is not a dir, but a %s", join(components), de.Type)
	}

	return n, nil
}

func openFile(ctx context.Context, config libkbfs.Config, components []string) (libkbfs.Node, error) {
	n, de, err := openNode(ctx, config, components)
	if err != nil {
		return nil, err
	}

	// TODO: What to do with symlinks?

	if de.Type != libkbfs.File && de.Type != libkbfs.Exec {
		return nil, fmt.Errorf("openFile: %s is not a file, but a %s", join(components), de.Type)
	}

	return n, nil
}
