// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"fmt"
	"os"
	"path"
	"regexp"
	"strings"

	billy "gopkg.in/src-d/go-billy.v4"
)

// RecursiveDelete deletes the given entry from the given filesystem.
// If it's a directory, first all the items in the directory are
// deleted recursively.
func RecursiveDelete(
	ctx context.Context, fs billy.Filesystem, fi os.FileInfo) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if !fi.IsDir() {
		// Delete regular files and symlinks directly.
		return fs.Remove(fi.Name())
	}

	subdirFS, err := fs.Chroot(fi.Name())
	if err != nil {
		return err
	}

	children, err := subdirFS.ReadDir("/")
	if err != nil {
		return err
	}
	for _, childFI := range children {
		if childFI.Name() == "." {
			continue
		}
		err := RecursiveDelete(ctx, subdirFS, childFI)
		if err != nil {
			return err
		}
	}

	return fs.Remove(fi.Name())
}

var obsConflictRegexp = regexp.MustCompile(`-([[:digit:]]+)(\.|$)`)

func stripObfuscatedConflictSuffix(s string) string {
	replace := ""
	if strings.Contains(s, ".") {
		replace = "."
	}
	return obsConflictRegexp.ReplaceAllString(s, replace)
}

func deobfuscate(
	ctx context.Context, fs *FS, pathParts []string) (res []string, err error) {
	if len(pathParts) == 0 {
		return nil, nil
	}

	fis, err := fs.ReadDir("")
	if err != nil {
		return nil, err
	}

	elem := stripObfuscatedConflictSuffix(pathParts[0])
	for _, fi := range fis {
		name := fi.Name()
		obsName := stripObfuscatedConflictSuffix(fs.PathForLogging(name))
		if obsName == elem {
			if len(pathParts) == 1 {
				res = append(res, name)
			} else {
				childFS, err := fs.ChrootAsLibFS(name)
				if err != nil {
					return nil, err
				}

				children, err := deobfuscate(ctx, childFS, pathParts[1:])
				if err != nil {
					return nil, err
				}
				for _, c := range children {
					res = append(res, path.Join(name, c))
				}
			}
		}

		if fi.Mode()&os.ModeSymlink > 0 {
			link, err := fs.Readlink(name)
			if err != nil {
				return nil, err
			}
			obsName := fs.RootNode().ChildName(link).String()
			if obsName == elem {
				res = append(res, fmt.Sprintf("%s (%s)", name, link))
			}
		}
	}
	return res, nil
}

// Deobfuscate returns a set of possible plaintext paths, given an
// obfuscated path as input.  The set is ambiguous because of possible
// conflicts in the obfuscated name.  If the last element of the
// obfuscated path matches the obfuscated version of a symlink target
// within the target directory, the returned string includes the
// symlink itself, followed by the target name in parentheses like
// `/keybase/private/me/link (/etc/passwd)`.
func Deobfuscate(
	ctx context.Context, fs *FS, obfuscatedPath string) ([]string, error) {
	s := strings.Split(obfuscatedPath, "/")
	return deobfuscate(ctx, fs, s)
}
