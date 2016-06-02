// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"fmt"
	"path"
	"strings"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type pathType int

const (
	invalidPath pathType = iota
	rootPath
	keybasePath
	keybaseChildPath
	tlfPath
)

type kbfsPath struct {
	pathType      pathType
	public        bool
	tlfName       string
	tlfComponents []string
}

func splitHelper(cleanPath string) []string {
	parentPathSlash, child := path.Split(cleanPath)
	parentPath := parentPathSlash[:len(parentPathSlash)-1]
	var parentComponents, childComponents []string
	if child != "" {
		childComponents = []string{child}
	}
	if parentPath != "" {
		parentComponents = splitHelper(parentPath)
	}
	return append(parentComponents, childComponents...)
}

func split(pathStr string) ([]string, error) {
	cleanPath := path.Clean(pathStr)
	if !path.IsAbs(cleanPath) {
		return nil, fmt.Errorf("split: %s is not an absolute path", pathStr)
	}
	return splitHelper(cleanPath), nil
}

func makeKbfsPath(pathStr string) (kbfsPath, error) {
	components, err := split(pathStr)
	if err != nil {
		return kbfsPath{}, err
	}
	len := len(components)

	if (len >= 1 && components[0] != topName) ||
		(len >= 2 && components[1] != publicName && components[1] != privateName) {
		return kbfsPath{}, invalidKbfsPathErr{pathStr}
	}

	if len == 0 {
		p := kbfsPath{
			pathType: rootPath,
		}
		return p, nil
	}

	if len == 1 {
		p := kbfsPath{
			pathType: keybasePath,
		}
		return p, nil
	}

	public := (components[1] == publicName)

	if len == 2 {
		p := kbfsPath{
			pathType: keybaseChildPath,
			public:   public,
		}
		return p, nil
	}

	p := kbfsPath{
		pathType:      tlfPath,
		public:        public,
		tlfName:       components[2],
		tlfComponents: components[3:],
	}
	return p, nil
}

func (p kbfsPath) String() string {
	if p.pathType < rootPath || p.pathType > tlfPath {
		return "<Invalid KBFS path>"
	}

	var components []string
	if p.pathType >= keybasePath && p.pathType <= tlfPath {
		components = append(components, topName)
	}
	if p.pathType >= keybaseChildPath && p.pathType <= tlfPath {
		if p.public {
			components = append(components, publicName)
		} else {
			components = append(components, privateName)
		}
	}
	if p.pathType == tlfPath {
		components = append(append(components, p.tlfName), p.tlfComponents...)
	}
	return "/" + strings.Join(components, "/")
}

func (p kbfsPath) dirAndBasename() (dir kbfsPath, basename string, err error) {
	switch p.pathType {
	case keybasePath:
		dir = kbfsPath{
			pathType: rootPath,
		}
		basename = topName
		return

	case keybaseChildPath:
		dir = kbfsPath{
			pathType: keybasePath,
		}

		if p.public {
			basename = publicName
		} else {
			basename = privateName
		}
		return

	case tlfPath:
		len := len(p.tlfComponents)
		if len == 0 {
			dir = kbfsPath{
				pathType: keybaseChildPath,
				public:   p.public,
			}
			basename = p.tlfName
		} else {
			dir = kbfsPath{
				pathType:      tlfPath,
				public:        p.public,
				tlfName:       p.tlfName,
				tlfComponents: p.tlfComponents[:len-1],
			}
			basename = p.tlfComponents[len-1]
		}
		return
	}

	err = errCannotSplit
	return
}

func (p kbfsPath) join(childName string) (childPath kbfsPath, err error) {
	switch p.pathType {
	case rootPath:
		if childName != topName {
			err = cannotJoinErr{p, childName}
			return
		}

		childPath = kbfsPath{
			pathType: keybasePath,
		}
		return

	case keybasePath:
		if childName != publicName && childName != privateName {
			err = cannotJoinErr{p, childName}
		}

		public := (childName == publicName)
		childPath = kbfsPath{
			pathType: keybaseChildPath,
			public:   public,
		}
		return

	case keybaseChildPath:
		childPath = kbfsPath{
			pathType: tlfPath,
			public:   p.public,
			tlfName:  childName,
		}
		return

	case tlfPath:
		childPath = kbfsPath{
			pathType:      tlfPath,
			public:        p.public,
			tlfName:       p.tlfName,
			tlfComponents: append(p.tlfComponents, childName),
		}
		return
	}

	err = cannotJoinErr{p, childName}
	return
}

// Returns a nil node if p doesn't have type tlfPath.
func (p kbfsPath) getNode(ctx context.Context, config libkbfs.Config) (n libkbfs.Node, ei libkbfs.EntryInfo, err error) {
	if p.pathType != tlfPath {
		ei := libkbfs.EntryInfo{
			Type: libkbfs.Dir,
		}
		return nil, ei, nil
	}

	var h *libkbfs.TlfHandle
	name := p.tlfName
outer:
	for {
		h, err = libkbfs.ParseTlfHandle(ctx, config.KBPKI(), name, p.public)
		switch err := err.(type) {
		case nil:
			// No error.
			break outer

		case libkbfs.TlfNameNotCanonical:
			// Non-canonical name, so try again.
			name = err.NameToTry

		default:
			// Some other error.
			return nil, libkbfs.EntryInfo{}, err
		}
	}

	n, ei, err =
		config.KBFSOps().GetOrCreateRootNode(
			ctx, h, libkbfs.MasterBranch)

	for _, component := range p.tlfComponents {
		cn, cei, err := config.KBFSOps().Lookup(ctx, n, component)
		if err != nil {
			return nil, libkbfs.EntryInfo{}, err
		}
		n = cn
		ei = cei
	}

	return n, ei, nil
}

func (p kbfsPath) getFileNode(ctx context.Context, config libkbfs.Config) (libkbfs.Node, error) {
	n, de, err := p.getNode(ctx, config)
	if err != nil {
		return nil, err
	}

	// TODO: What to do with symlinks?

	if de.Type != libkbfs.File && de.Type != libkbfs.Exec {
		return nil, fmt.Errorf("openFile: %s is not a file, but a %s", p, de.Type)
	}

	return n, nil
}

// Returns a nil node if p doesn't have type tlfPath.
func (p kbfsPath) getDirNode(ctx context.Context, config libkbfs.Config) (libkbfs.Node, error) {
	// TODO: Handle non-tlfPaths.

	n, de, err := p.getNode(ctx, config)
	if err != nil {
		return nil, err
	}

	// TODO: What to do with symlinks?

	if de.Type != libkbfs.Dir {
		return nil, fmt.Errorf("openDir: %s is not a dir, but a %s", p, de.Type)
	}

	return n, nil
}
