// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbp

import (
	"context"
	"errors"
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// ErrInvalidKeybasePagesRecord is returned when the kbp= DNS record for a
// domain is invalid.
type ErrInvalidKeybasePagesRecord struct{}

// Error returns the error interface.
func (ErrInvalidKeybasePagesRecord) Error() string {
	return "invalid TXT record"
}

// RootType specifies the type of a root.
type RootType int

const (
	_ RootType = iota
	// KBFSRoot means the root is backed by a KBFS path.
	KBFSRoot
	// GitRoot means the root is backed by a git repo stored in KBFS.
	GitRoot
)

// String implements the fmt.Stringer interface
func (t RootType) String() string {
	switch t {
	case KBFSRoot:
		return "kbfs"
	case GitRoot:
		return "git"
	default:
		return "unknown"
	}
}

// Root defines the root of a static site hosted by Keybase Pages.
type Root struct {
	Type            RootType
	TlfType         tlf.Type
	TlfNameUnparsed string
	PathUnparsed    string
}

// MakeFS makes a *libfs.FS from *r, which can be adapted to a http.FileSystem
// (through ToHTTPFileSystem) to be used by http package to serve through HTTP.
func (r *Root) MakeFS(ctx context.Context, log *zap.Logger,
	kbfsConfig libkbfs.Config) (fs *libfs.FS, err error) {
	defer func() {
		zapFields := []zapcore.Field{
			zap.String("type", r.Type.String()),
			zap.String("tlf_type", r.TlfType.String()),
			zap.String("tlf", r.TlfNameUnparsed),
			zap.String("path", r.PathUnparsed),
		}
		if err == nil {
			log.Info("root.MakeFS", zapFields...)
		} else {
			log.Warn("root.MakeFS", append(zapFields, zap.Error(err))...)
		}
	}()
	switch r.Type {
	case KBFSRoot:
		tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
			ctx, kbfsConfig.KBPKI(), kbfsConfig.MDOps(), r.TlfNameUnparsed, r.TlfType)
		if err != nil {
			return nil, err
		}
		fs, err = libfs.NewFS(context.Background(), kbfsConfig,
			tlfHandle, r.PathUnparsed, "", keybase1.MDPriorityNormal)
		if err != nil {
			return nil, err
		}
		return fs, nil
	case GitRoot:
		// TODO: implment git root
		return nil, errors.New("unimplemented")
	default:
		return nil, ErrInvalidKeybasePagesRecord{}
	}
}

const gitPrefix = "git@keybase:"
const kbfsPrefix = "/keybase/"
const privatePrefix = "private/"
const publicPrefix = "public/"
const teamPrefix = "team/"

func setRootTlfNameAndPath(root *Root, str string) {
	parts := strings.SplitN(str, "/", 2)
	root.TlfNameUnparsed = parts[0]
	if len(parts) > 1 {
		root.PathUnparsed = parts[1]
	}
}

// str is everything after either gitPrefix or kbfsPrefix.
func setRoot(root *Root, str string) error {
	switch {
	case strings.HasPrefix(str, privatePrefix):
		root.TlfType = tlf.Private
		setRootTlfNameAndPath(root, str[len(privatePrefix):])
		return nil
	case strings.HasPrefix(str, publicPrefix):
		root.TlfType = tlf.Public
		setRootTlfNameAndPath(root, str[len(publicPrefix):])
		return nil
	case strings.HasPrefix(str, teamPrefix):
		root.TlfType = tlf.SingleTeam
		setRootTlfNameAndPath(root, str[len(teamPrefix):])
		return nil
	default:
		return ErrInvalidKeybasePagesRecord{}
	}
}

// ParseRoot parses a kbp= TXT record from a domain into a Root object.
func ParseRoot(str string) (Root, error) {
	str = strings.TrimSpace(str)
	switch {
	case strings.HasPrefix(str, gitPrefix):
		root := Root{Type: GitRoot}
		if err := setRoot(&root, str[len(gitPrefix):]); err != nil {
			return Root{}, err
		}
		return root, nil
	case strings.HasPrefix(str, kbfsPrefix):
		root := Root{Type: KBFSRoot}
		if err := setRoot(&root, str[len(kbfsPrefix):]); err != nil {
			return Root{}, err
		}
		return root, nil

	default:
		return Root{}, ErrInvalidKeybasePagesRecord{}
	}
}
