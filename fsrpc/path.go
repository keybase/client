// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package fsrpc

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"

	"golang.org/x/net/context"
)

const (
	topName     = "keybase"
	publicName  = "public"
	privateName = "private"
)

// PathType describes the types for different paths
type PathType int

const (
	// InvalidPathType denotes an invalid path type
	InvalidPathType PathType = iota
	// RootPathType is a root path type (like /)
	RootPathType
	// KeybasePathType is the keybase root (like /keybase)
	KeybasePathType
	// KeybaseChildPathType is a keybase reserved path (like /keybase/public)
	KeybaseChildPathType
	// TLFPathType is a top level folder (/keybase/public/gabrielh)
	TLFPathType
)

// Path defines a file path in KBFS such as /keybase/public or /keybase/private/gabrielh
type Path struct {
	PathType      PathType
	TLFType       tlf.Type
	TLFName       string
	TLFComponents []string
}

func splitHelper(cleanPath string) []string {
	parentPathSlash, child := filepath.Split(cleanPath)
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
	cleanPath := filepath.Clean(pathStr)
	if !filepath.IsAbs(cleanPath) {
		return nil, fmt.Errorf("split: %s is not an absolute path", pathStr)
	}
	return splitHelper(cleanPath), nil
}

func listTypeToTLFType(c string) tlf.Type {
	switch c {
	case privateName:
		return tlf.Private
	case publicName:
		return tlf.Public
	default:
		// TODO: support team TLFs.
		panic(fmt.Sprintf("Unknown folder list type: %s", c))
	}
}

// NewPath constructs a Path from a string
func NewPath(pathStr string) (Path, error) {
	components, err := split(pathStr)
	if err != nil {
		return Path{}, err
	}
	len := len(components)

	if (len >= 1 && components[0] != topName) ||
		(len >= 2 && components[1] != publicName && components[1] != privateName) {
		return Path{}, InvalidPathErr{pathStr}
	}

	if len == 0 {
		p := Path{
			PathType: RootPathType,
		}
		return p, nil
	}

	if len == 1 {
		p := Path{
			PathType: KeybasePathType,
		}
		return p, nil
	}

	if len == 2 {
		p := Path{
			PathType: KeybaseChildPathType,
			TLFType:  listTypeToTLFType(components[1]),
		}
		return p, nil
	}

	p := Path{
		PathType:      TLFPathType,
		TLFType:       listTypeToTLFType(components[1]),
		TLFName:       components[2],
		TLFComponents: components[3:],
	}
	return p, nil
}

func (p Path) String() string {
	if p.PathType < RootPathType || p.PathType > TLFPathType {
		return ""
	}

	var components []string
	if p.PathType >= KeybasePathType && p.PathType <= TLFPathType {
		components = append(components, topName)
	}
	if p.PathType >= KeybaseChildPathType && p.PathType <= TLFPathType {
		switch p.TLFType {
		case tlf.Public:
			components = append(components, publicName)
		case tlf.Private:
			components = append(components, privateName)
		default:
			// TODO: add support for team TLFs.
			panic(fmt.Sprintf("Unknown TLF type: %s", p.TLFType))
		}
	}
	if p.PathType == TLFPathType {
		components = append(append(components, p.TLFName), p.TLFComponents...)
	}
	return "/" + strings.Join(components, "/")
}

// DirAndBasename returns directory and base filename
func (p Path) DirAndBasename() (dir Path, basename string, err error) {
	switch p.PathType {
	case KeybasePathType:
		dir = Path{
			PathType: RootPathType,
		}
		basename = topName
		return

	case KeybaseChildPathType:
		dir = Path{
			PathType: KeybasePathType,
		}

		switch p.TLFType {
		case tlf.Public:
			basename = publicName
		case tlf.Private:
			basename = privateName
		default:
			panic(fmt.Sprintf("Unknown TLF type: %s", p.TLFType))
		}
		return

	case TLFPathType:
		len := len(p.TLFComponents)
		if len == 0 {
			dir = Path{
				PathType: KeybaseChildPathType,
				TLFType:  p.TLFType,
			}
			basename = p.TLFName
		} else {
			dir = Path{
				PathType:      TLFPathType,
				TLFType:       p.TLFType,
				TLFName:       p.TLFName,
				TLFComponents: p.TLFComponents[:len-1],
			}
			basename = p.TLFComponents[len-1]
		}
		return
	}

	err = errors.New("cannot split path")
	return
}

// Join will append a path to this path
func (p Path) Join(childName string) (childPath Path, err error) {
	switch p.PathType {
	case RootPathType:
		if childName != topName {
			err = CannotJoinPathErr{p, childName}
			return
		}

		childPath = Path{
			PathType: KeybasePathType,
		}
		return

	case KeybasePathType:
		if childName != publicName && childName != privateName {
			err = CannotJoinPathErr{p, childName}
		}

		childPath = Path{
			PathType: KeybaseChildPathType,
			TLFType:  listTypeToTLFType(childName),
		}
		return

	case KeybaseChildPathType:
		childPath = Path{
			PathType: TLFPathType,
			TLFType:  p.TLFType,
			TLFName:  childName,
		}
		return

	case TLFPathType:
		childPath = Path{
			PathType:      TLFPathType,
			TLFType:       p.TLFType,
			TLFName:       p.TLFName,
			TLFComponents: append(p.TLFComponents, childName),
		}
		return
	}

	err = CannotJoinPathErr{p, childName}
	return
}

// ParseTlfHandle is a wrapper around libkbfs.ParseTlfHandle that
// automatically resolves non-canonical names.
func ParseTlfHandle(
	ctx context.Context, kbpki libkbfs.KBPKI, name string, t tlf.Type) (
	*libkbfs.TlfHandle, error) {
	var tlfHandle *libkbfs.TlfHandle
outer:
	for {
		var parseErr error
		tlfHandle, parseErr = libkbfs.ParseTlfHandle(ctx, kbpki, name, t)
		switch parseErr := parseErr.(type) {
		case nil:
			// No error.
			break outer

		case libkbfs.TlfNameNotCanonical:
			// Non-canonical name, so try again.
			name = parseErr.NameToTry

		default:
			// Some other error.
			return nil, parseErr
		}
	}

	return tlfHandle, nil
}

// GetNode returns a node
func (p Path) GetNode(ctx context.Context, config libkbfs.Config) (libkbfs.Node, libkbfs.EntryInfo, error) {
	if p.PathType != TLFPathType {
		entryInfo := libkbfs.EntryInfo{
			Type: libkbfs.Dir,
		}
		return nil, entryInfo, nil
	}

	tlfHandle, err := ParseTlfHandle(ctx, config.KBPKI(), p.TLFName, p.TLFType)
	if err != nil {
		return nil, libkbfs.EntryInfo{}, err
	}

	node, entryInfo, err := config.KBFSOps().GetOrCreateRootNode(ctx, tlfHandle, libkbfs.MasterBranch)
	if err != nil {
		return nil, libkbfs.EntryInfo{}, err
	}

	for _, component := range p.TLFComponents {
		lookupNode, lookupEntryInfo, lookupErr := config.KBFSOps().Lookup(ctx, node, component)
		if lookupErr != nil {
			return nil, libkbfs.EntryInfo{}, lookupErr
		}
		node = lookupNode
		entryInfo = lookupEntryInfo
	}

	return node, entryInfo, nil
}

// GetFileNode returns a file node
func (p Path) GetFileNode(ctx context.Context, config libkbfs.Config) (libkbfs.Node, error) {
	n, de, err := p.GetNode(ctx, config)
	if err != nil {
		return nil, err
	}

	// TODO: What to do with symlinks?

	if de.Type != libkbfs.File && de.Type != libkbfs.Exec {
		return nil, fmt.Errorf("openFile: %s is not a file, but a %s", p, de.Type)
	}

	return n, nil
}

// GetDirNode returns a nil node if this doesn't have type TLFPathType
func (p Path) GetDirNode(ctx context.Context, config libkbfs.Config) (libkbfs.Node, error) {
	// TODO: Handle non-TLFPathTypes.

	n, de, err := p.GetNode(ctx, config)
	if err != nil {
		return nil, err
	}

	// TODO: What to do with symlinks?

	if de.Type != libkbfs.Dir {
		return nil, fmt.Errorf("openDir: %s is not a dir, but a %s", p, de.Type)
	}

	return n, nil
}

// InvalidPathErr is error for invalid paths
type InvalidPathErr struct {
	pathStr string
}

func (e InvalidPathErr) Error() string {
	return fmt.Sprintf("invalid kbfs path %s", e.pathStr)
}

// CannotJoinPathErr is returned on Join error
type CannotJoinPathErr struct {
	p    Path
	name string
}

func (e CannotJoinPathErr) Error() string {
	return fmt.Sprintf("cannot join %s to %s", e.p, e.name)
}
