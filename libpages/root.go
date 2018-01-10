// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"context"
	"fmt"
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

// Debug tag ID for an individual FS in keybase pages.
const ctxOpID = "KBP"

type ctxTagKey int

const (
	ctxIDKey ctxTagKey = iota
)

// Root defines the root of a static site hosted by Keybase Pages. It is
// normally constructed from DNS records directly and is cheap to make.
type Root struct {
	Type            RootType
	TlfType         tlf.Type
	TlfNameUnparsed string
	PathUnparsed    string
}

// MakeFS makes a *libfs.FS from *r, which can be adapted to a http.FileSystem
// (through ToHTTPFileSystem) to be used by http package to serve through HTTP.
func (r *Root) MakeFS(
	ctx context.Context, log *zap.Logger, kbfsConfig libkbfs.Config) (
	fs *libfs.FS, tlfID tlf.ID, shutdown func(), err error) {
	fsCtx, cancel := context.WithCancel(context.Background())
	defer func() {
		zapFields := []zapcore.Field{
			zap.String("root_type", r.Type.String()),
			zap.String("tlf_type", r.TlfType.String()),
			zap.String("tlf", r.TlfNameUnparsed),
			zap.String("root_path", r.PathUnparsed),
		}
		if err == nil {
			log.Info("root.MakeFS", zapFields...)
		} else {
			cancel()
			log.Warn("root.MakeFS", append(zapFields, zap.Error(err))...)
		}
	}()
	fsCtx, err = libkbfs.NewContextWithCancellationDelayer(
		libkbfs.CtxWithRandomIDReplayable(
			fsCtx, ctxIDKey, ctxOpID, nil))
	if err != nil {
		return nil, tlf.ID{}, nil, err
	}
	switch r.Type {
	case KBFSRoot:
		tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
			ctx, kbfsConfig.KBPKI(), kbfsConfig.MDOps(), r.TlfNameUnparsed, r.TlfType)
		if err != nil {
			return nil, tlf.ID{}, nil, err
		}
		fs, err = libfs.NewFS(fsCtx, kbfsConfig,
			tlfHandle, r.PathUnparsed, "", keybase1.MDPriorityNormal)
		if err != nil {
			return nil, tlf.ID{}, nil, err
		}
		return fs, tlfHandle.TlfID(), cancel, nil
	case GitRoot:
		session, err := kbfsConfig.KeybaseService().CurrentSession(ctx, 0)
		if err != nil {
			return nil, tlf.ID{}, nil, err
		}
		tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
			ctx, kbfsConfig.KBPKI(), kbfsConfig.MDOps(),
			// We'll just checkout to the bot's private TLF for now. Note that
			// this means git remote is only supported by kbp servers that have
			// logged into a bot account.
			string(session.Name), tlf.Private)
		if err != nil {
			return nil, tlf.ID{}, nil, err
		}
		fs, err = libfs.NewFS(fsCtx, kbfsConfig,
			tlfHandle, fmt.Sprintf(".kbfs_autogit/%s/%s/%s",
				r.TlfType, r.TlfNameUnparsed, r.PathUnparsed), "",
			keybase1.MDPriorityNormal)
		if err != nil {
			return nil, tlf.ID{}, nil, err
		}
		return fs, tlfHandle.TlfID(), cancel, nil
	default:
		return nil, tlf.ID{}, nil, ErrInvalidKeybasePagesRecord{}
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
