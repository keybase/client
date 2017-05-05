// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"strings"

	"github.com/keybase/kbfs/tlf"
)

// PathType describes the types for different paths
type PathType string

const (
	// KeybasePathType is the keybase root (like /keybase)
	KeybasePathType PathType = "keybase"
	// PublicPathType is the keybase public (like /keybase/public)
	PublicPathType PathType = "public"
	// PrivatePathType is the keybase private (like /keybase/private)
	PrivatePathType PathType = "private"
)

// BuildCanonicalPath returns a canonical path for a path components.
// This a canonical path and may need to be converted to a platform
// specific path, for example, on Windows, this might correspond to
// k:\private\username.
func BuildCanonicalPath(pathType PathType, paths ...string) string {
	var prefix string
	switch pathType {
	case KeybasePathType:
		prefix = "/" + string(KeybasePathType)
	case PublicPathType:
		prefix = "/" + string(KeybasePathType) + "/" + string(PublicPathType)
	case PrivatePathType:
		prefix = "/" + string(KeybasePathType) + "/" + string(PrivatePathType)
	}
	pathElements := []string{prefix}
	for _, p := range paths {
		if p != "" {
			pathElements = append(pathElements, p)
		}
	}
	return strings.Join(pathElements, "/")
}

// buildCanonicalPathForTlfName returns a canonical path for a tlf.
func buildCanonicalPathForTlfName(public bool, tlfName CanonicalTlfName) string {
	pathType := PrivatePathType
	if public {
		pathType = PublicPathType
	}
	return BuildCanonicalPath(pathType, string(tlfName))
}

func buildCanonicalPathForTlf(tlf tlf.ID, paths ...string) string {
	pathType := PrivatePathType
	if tlf.IsPublic() {
		pathType = PublicPathType
	}
	return BuildCanonicalPath(pathType, paths...)
}

// path represents the full KBFS path to a particular location, so
// that a flush can traverse backwards and fix up ids along the way.
type path struct {
	FolderBranch
	path []pathNode
}

// isValid() returns true if the path has at least one node (for the
// root).
func (p path) isValid() bool {
	if len(p.path) < 1 {
		return false
	}

	for _, n := range p.path {
		if !n.isValid() {
			return false
		}
	}

	return true
}

// isValidForNotification() returns true if the path has at least one
// node (for the root), and the first element of the path is non-empty
// and does not start with "<", which indicates an unnotifiable path.
func (p path) isValidForNotification() bool {
	if !p.isValid() {
		return false
	}

	return len(p.path[0].Name) > 0 && !strings.HasPrefix(p.path[0].Name, "<")
}

// hasValidParent() returns true if this path is valid and
// parentPath() is a valid path.
func (p path) hasValidParent() bool {
	return len(p.path) >= 2 && p.parentPath().isValid()
}

// tailName returns the name of the final node in the Path. Must be
// called with a valid path.
func (p path) tailName() string {
	return p.path[len(p.path)-1].Name
}

// tailPointer returns the BlockPointer of the final node in the Path.
// Must be called with a valid path.
func (p path) tailPointer() BlockPointer {
	return p.path[len(p.path)-1].BlockPointer
}

// tailRef returns the BlockRef of the final node in the Path.  Must
// be called with a valid path.
func (p path) tailRef() BlockRef {
	return p.path[len(p.path)-1].Ref()
}

// DebugString returns a string representation of the path with all
// branch and pointer information.
func (p path) DebugString() string {
	debugNames := make([]string, 0, len(p.path))
	for _, node := range p.path {
		debugNames = append(debugNames, node.DebugString())
	}
	return fmt.Sprintf("%s:%s", p.FolderBranch, strings.Join(debugNames, "/"))
}

// String implements the fmt.Stringer interface for Path.
func (p path) String() string {
	names := make([]string, 0, len(p.path))
	for _, node := range p.path {
		names = append(names, node.Name)
	}
	return strings.Join(names, "/")
}

// CanonicalPathString returns canonical representation of the full path,
// always prefaced by /keybase. This may require conversion to a platform
// specific path, for example, by replacing /keybase with the appropriate drive
// letter on Windows. It also, might need conversion if on a different run mode,
// for example, /keybase.staging on Unix type platforms.
func (p path) CanonicalPathString() string {
	return buildCanonicalPathForTlf(p.Tlf, p.String())
}

// parentPath returns a new Path representing the parent subdirectory
// of this Path. Must be called with a valid path. Should not be
// called with a path of only a single node, as that would produce an
// invalid path.
func (p path) parentPath() *path {
	return &path{p.FolderBranch, p.path[:len(p.path)-1]}
}

// ChildPath returns a new Path with the addition of a new entry
// with the given name and BlockPointer.
func (p path) ChildPath(name string, ptr BlockPointer) path {
	child := path{
		FolderBranch: p.FolderBranch,
		path:         make([]pathNode, len(p.path), len(p.path)+1),
	}
	copy(child.path, p.path)
	child.path = append(child.path, pathNode{Name: name, BlockPointer: ptr})
	return child
}

// ChildPathNoPtr returns a new Path with the addition of a new entry
// with the given name.  That final PathNode will have no BlockPointer.
func (p path) ChildPathNoPtr(name string) path {
	return p.ChildPath(name, BlockPointer{})
}

// hasPublic returns whether or not this is a top-level folder that
// should have a "public" subdirectory.
func (p path) hasPublic() bool {
	// This directory has a corresponding public subdirectory if the
	// path has only one node and the top-level directory is not
	// already public TODO: Ideally, we'd also check if there are no
	// explicit readers, but for now we expect the caller to check
	// that.
	return len(p.path) == 1 && !p.Tlf.IsPublic()
}

// PathNode is a single node along an KBFS path, pointing to the top
// block for that node of the path.
type pathNode struct {
	BlockPointer
	Name string
}

func (n pathNode) isValid() bool {
	return n.BlockPointer.IsValid()
}

// DebugString returns a string representation of the node with all
// pointer information.
func (n pathNode) DebugString() string {
	return fmt.Sprintf("%s(ptr=%s)", n.Name, n.BlockPointer)
}
