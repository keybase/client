// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
)

// Path represents the full KBFS path to a particular location, so
// that a flush can traverse backwards and fix up ids along the way.
type Path struct {
	FolderBranch
	Path            []PathNode
	ChildObfuscator Obfuscator
}

// IsValid returns true if the path has at least one node (for the
// root).
func (p Path) IsValid() bool {
	if len(p.Path) < 1 {
		return false
	}

	for _, n := range p.Path {
		if !n.IsValid() {
			return false
		}
	}

	return true
}

// IsValidForNotification returns true if the path has at least one
// node (for the root), and the first element of the path is non-empty
// and does not start with "<", which indicates an unnotifiable path.
func (p Path) IsValidForNotification() bool {
	if !p.IsValid() {
		return false
	}

	if p.Tlf == (tlf.NullID) {
		return false
	}

	namePlain := p.Path[0].Name.Plaintext()
	return len(namePlain) > 0 && !strings.HasPrefix(namePlain, "<")
}

// HasValidParent returns true if this path is valid and
// `ParentPath()` is a valid path.
func (p Path) HasValidParent() bool {
	return len(p.Path) >= 2 && p.ParentPath().IsValid()
}

// TailName returns the name of the final node in the Path. Must be
// called with a valid path.
func (p Path) TailName() PathPartString {
	return p.Path[len(p.Path)-1].Name
}

// TailPointer returns the BlockPointer of the final node in the Path.
// Must be called with a valid path.
func (p Path) TailPointer() BlockPointer {
	return p.Path[len(p.Path)-1].BlockPointer
}

// TailRef returns the BlockRef of the final node in the Path.  Must
// be called with a valid path.
func (p Path) TailRef() BlockRef {
	return p.Path[len(p.Path)-1].Ref()
}

// DebugString returns a string representation of the path with all
// branch and pointer information.
func (p Path) DebugString() string {
	debugNames := make([]string, 0, len(p.Path))
	for _, node := range p.Path {
		debugNames = append(debugNames, node.DebugString())
	}
	return fmt.Sprintf("%s:%s", p.FolderBranch, strings.Join(debugNames, "/"))
}

// String implements the fmt.Stringer interface for Path.
func (p Path) String() string {
	names := make([]string, 0, len(p.Path))
	for _, node := range p.Path {
		names = append(names, node.Name.String())
	}
	return strings.Join(names, "/")
}

// Plaintext returns an unobfuscated string for this path.
func (p Path) Plaintext() string {
	names := make([]string, 0, len(p.Path))
	for _, node := range p.Path {
		names = append(names, node.Name.Plaintext())
	}
	return strings.Join(names, "/")
}

// CanonicalPathString returns an obfuscated canonical
// representation of the full path, always prefaced by /keybase. This
// may require conversion to a platform specific path, for example, by
// replacing /keybase with the appropriate drive letter on Windows. It
// also, might need conversion if on a different run mode, for
// example, /keybase.staging on Unix type platforms.
func (p Path) CanonicalPathString() string {
	return tlfhandle.BuildCanonicalPathForTlf(p.Tlf, p.String())
}

// CanonicalPathPlaintext returns an un-obfuscated canonical
// representation of the full path, always prefaced by /keybase. This
// may require conversion to a platform specific path, for example, by
// replacing /keybase with the appropriate drive letter on Windows. It
// also, might need conversion if on a different run mode, for
// example, /keybase.staging on Unix type platforms.
func (p Path) CanonicalPathPlaintext() string {
	return tlfhandle.BuildCanonicalPathForTlf(p.Tlf, p.Plaintext())
}

// ParentPath returns a new Path representing the parent subdirectory
// of this Path. Must be called with a valid path. Should not be
// called with a path of only a single node, as that would produce an
// invalid path.
func (p Path) ParentPath() *Path {
	return &Path{
		FolderBranch:    p.FolderBranch,
		Path:            p.Path[:len(p.Path)-1],
		ChildObfuscator: p.Path[len(p.Path)-1].Name.Obfuscator(),
	}
}

// ChildPath returns a new Path with the addition of a new entry
// with the given name and BlockPointer.
func (p Path) ChildPath(
	name PathPartString, ptr BlockPointer, childObfuscator Obfuscator) Path {
	child := Path{
		FolderBranch:    p.FolderBranch,
		Path:            make([]PathNode, len(p.Path), len(p.Path)+1),
		ChildObfuscator: childObfuscator,
	}
	copy(child.Path, p.Path)
	child.Path = append(child.Path, PathNode{Name: name, BlockPointer: ptr})
	return child
}

// ChildPathNoPtr returns a new Path with the addition of a new entry
// with the given name.  That final PathNode will have no BlockPointer.
func (p Path) ChildPathNoPtr(
	name PathPartString, childObfuscator Obfuscator) Path {
	return p.ChildPath(name, BlockPointer{}, childObfuscator)
}

// Obfuscator returns the obfuscator of the tail node in this path.
func (p Path) Obfuscator() Obfuscator {
	return p.ChildObfuscator
}

// PathNode is a single node along an KBFS path, pointing to the top
// block for that node of the path.
type PathNode struct {
	BlockPointer
	Name PathPartString
}

// IsValid returns true if this node contains a valid block pointer.
func (n PathNode) IsValid() bool {
	return n.BlockPointer.IsValid()
}

// DebugString returns a string representation of the node with all
// pointer information.
func (n PathNode) DebugString() string {
	return fmt.Sprintf("%s(ptr=%s)", n.Name, n.BlockPointer)
}
