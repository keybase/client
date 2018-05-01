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
	"github.com/keybase/kbfs/libgit"
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

// CacheableFS is a wrapper around a *libfs.FS and a subdir. Use Use() to get a
// *libfs.FS that roots at subdir. This essentially delays "cd"ing into subdir,
// and is useful for caching a *libfs.FS object without the downside of caching
// a libkbfs.Node that can be obsolete when it's renamed or removed.
type CacheableFS struct {
	endOfLifeTrackingCtx context.Context
	fs                   *libfs.FS
	subdir               string
}

// IsEndOfLife returns true if fs has reached the end of life, because of a
// handle change for example. In this case user should not use this fs anymore,
// but instead make a new one.
func (fs CacheableFS) IsEndOfLife() bool {
	select {
	case <-fs.endOfLifeTrackingCtx.Done():
		return true
	default:
		return false
	}
}

// Use returns a *libfs.FS to use.
func (fs CacheableFS) Use() (*libfs.FS, error) {
	return fs.fs.ChrootAsLibFS(fs.subdir)
}

// MakeFS makes a CacheableFS from *r, which can be adapted to a http.FileSystem
// (through ToHTTPFileSystem) to be used by http package to serve through HTTP.
// Caller must call Use() to get a usable FS.
func (r *Root) MakeFS(
	ctx context.Context, log *zap.Logger, kbfsConfig libkbfs.Config) (
	fs CacheableFS, tlfID tlf.ID, shutdown func(), err error) {
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
		return CacheableFS{}, tlf.ID{}, nil, err
	}
	switch r.Type {
	case KBFSRoot:
		tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
			ctx, kbfsConfig.KBPKI(), kbfsConfig.MDOps(), r.TlfNameUnparsed, r.TlfType)
		if err != nil {
			return CacheableFS{}, tlf.ID{}, nil, err
		}
		tlfFS, err := libfs.NewFS(fsCtx, kbfsConfig,
			tlfHandle, "", "", keybase1.MDPriorityNormal)
		if err != nil {
			return CacheableFS{}, tlf.ID{}, nil, err
		}
		endOfLifeCtx, err := tlfFS.SubscribeToEndOfLife()
		if err != nil {
			return CacheableFS{}, tlf.ID{}, nil, err
		}
		cacheableFS := CacheableFS{
			endOfLifeTrackingCtx: endOfLifeCtx,
			fs:                   tlfFS,
			subdir:               r.PathUnparsed,
		}
		if _, err = cacheableFS.Use(); err != nil {
			return CacheableFS{}, tlf.ID{}, nil, err
		}
		return cacheableFS, tlfHandle.TlfID(), cancel, nil
	case GitRoot:
		session, err := kbfsConfig.KeybaseService().CurrentSession(ctx, 0)
		if err != nil {
			return CacheableFS{}, tlf.ID{}, nil, err
		}
		tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
			ctx, kbfsConfig.KBPKI(), kbfsConfig.MDOps(),
			// We'll just checkout to the bot's private TLF for now. Note that
			// this means git remote is only supported by kbp servers that have
			// logged into a bot account.
			string(session.Name), tlf.Private)
		if err != nil {
			return CacheableFS{}, tlf.ID{}, nil, err
		}
		autogitTLFFS, err := libfs.NewFS(fsCtx, kbfsConfig, tlfHandle,
			fmt.Sprintf("%s/%s", libgit.AutogitTLFListDir(r.TlfType),
				r.TlfNameUnparsed), "",
			keybase1.MDPriorityNormal)
		if err != nil {
			return CacheableFS{}, tlf.ID{}, nil, err
		}
		cacheableFS := CacheableFS{
			fs:     autogitTLFFS,
			subdir: r.PathUnparsed,
		}
		if _, err = cacheableFS.Use(); err != nil {
			return CacheableFS{}, tlf.ID{}, nil, err
		}
		return cacheableFS, tlfHandle.TlfID(), cancel, nil
	default:
		return CacheableFS{}, tlf.ID{}, nil, ErrInvalidKeybasePagesRecord{}
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
