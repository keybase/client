// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"encoding/base64"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	// ulCtxOpID is the display name for the unique operation SimpleFS ID tag.
	ulCtxOpID = "SFSULID"
)

// ulCtxTagKey is the type used for unique context tags
type ulCtxTagKey int

const (
	// ulCtxIDKey is the type of the tag for unique operation IDs.
	ulCtxIDKey ulCtxTagKey = iota
)

type upload struct {
	dirToDelete *string
	uploadID    string
	opid        keybase1.OpID

	state keybase1.UploadState
}

type uploadManager struct {
	k         *SimpleFS
	publisher libkbfs.SubscriptionManagerPublisher
	cacheDir  string

	lock      sync.RWMutex
	tempPaths map[string]bool
	uploads   map[string]upload
}

func newUploadManager(simpleFS *SimpleFS) *uploadManager {
	return &uploadManager{
		k:         simpleFS,
		publisher: simpleFS.config.SubscriptionManagerPublisher(),
		cacheDir:  simpleFS.config.KbEnv().GetCacheDir(),
		tempPaths: make(map[string]bool),
		uploads:   make(map[string]upload),
	}
}

func (m *uploadManager) makeContext() (ctx context.Context) {
	return libkbfs.CtxWithRandomIDReplayable(context.Background(), ulCtxIDKey, ulCtxOpID, m.k.log)
}

func (m *uploadManager) makeTempDir() (tempDirPath string, err error) {
	cacheDirAbs, err := filepath.Abs(m.cacheDir)
	if err != nil {
		return "", err
	}
	tempDirPath, err = os.MkdirTemp(cacheDirAbs, "uploads-")
	if err != nil {
		return "", err
	}

	m.lock.Lock()
	defer m.lock.Unlock()
	m.tempPaths[tempDirPath] = true

	return tempDirPath, nil
}

func (m *uploadManager) doWhileLocked(action func()) {
	m.lock.Lock()
	defer m.lock.Unlock()
	action()
}

func (m *uploadManager) getUpload(uploadID string) (upload, bool) {
	m.lock.RLock()
	defer m.lock.RUnlock()
	u, ok := m.uploads[uploadID]
	return u, ok
}

func (m *uploadManager) waitForCopy(uploadID string) {
	upload, ok := m.getUpload(uploadID)
	if !ok {
		return
	}
	defer func() {
		m.publisher.PublishChange(keybase1.SubscriptionTopic_UPLOAD_STATUS)
		if upload.dirToDelete == nil {
			return
		}
		if err := os.RemoveAll(*upload.dirToDelete); err != nil {
			m.k.log.CDebugf(m.makeContext(), "remove temp dir error %s", err)
		}

	}()

	err := m.k.SimpleFSWait(m.makeContext(), upload.opid)
	if err != nil {
		m.doWhileLocked(func() {
			upload, ok := m.uploads[uploadID]
			if !ok {
				return
			}
			if errors.Cause(err) == context.Canceled {
				upload.state.Canceled = true
			} else {
				errStr := err.Error()
				upload.state.Error = &errStr
			}
			m.uploads[uploadID] = upload
		})
		return
	}
	m.doWhileLocked(func() {
		delete(m.uploads, uploadID)
	})
}

const uploadSuffixMax = 1024

func (m *uploadManager) doStart(ctx context.Context,
	sourceLocalPath string, dstParentPath string) (opid keybase1.OpID, dstPath keybase1.KBFSPath, err error) {
	opid, err = m.k.SimpleFSMakeOpid(ctx)
	if err != nil {
		return keybase1.OpID{}, keybase1.KBFSPath{}, err
	}
	basename := filepath.Base(sourceLocalPath)

renameLoop:
	for i := 0; i < uploadSuffixMax; i++ {
		name := basename
		if i > 0 {
			name = fmt.Sprintf("%s (%d)", basename, i)
		}
		dstPath = keybase1.NewPathWithKbfsPath(
			path.Join(dstParentPath, name)).Kbfs()

		// First check with stat. This should cover most cases, and is
		// the last resort for avoiding merging directories where we
		// don't get something like O_CREATE for free.
		_, err = m.k.SimpleFSStat(ctx, keybase1.SimpleFSStatArg{
			Path: keybase1.NewPathWithKbfs(dstPath),
		})
		switch {
		case err == nil:
			continue renameLoop
		case err == errNotExist:
		default:
			return keybase1.OpID{}, keybase1.KBFSPath{}, err
		}

		err = m.k.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
			OpID:                   opid,
			Src:                    keybase1.NewPathWithLocal(sourceLocalPath),
			Dest:                   keybase1.NewPathWithKbfs(dstPath),
			OverwriteExistingFiles: false,
		})
		switch errors.Cause(err) {
		case errNameExists:
			continue renameLoop
		case nil:
			return opid, dstPath, nil
		default:
			return keybase1.OpID{}, keybase1.KBFSPath{}, err
		}
	}

	return keybase1.OpID{}, keybase1.KBFSPath{},
		errors.New("too many rename attempts")
}

func (m *uploadManager) start(ctx context.Context, sourceLocalPath string,
	targetParentPath keybase1.KBFSPath) (uploadID string, err error) {
	opid, dstPath, err := m.doStart(ctx, sourceLocalPath, targetParentPath.Path)
	if err != nil {
		return "", err
	}
	uploadID = base64.RawURLEncoding.EncodeToString(opid[:])

	defer m.publisher.PublishChange(keybase1.SubscriptionTopic_UPLOAD_STATUS)

	m.doWhileLocked(func() {
		var dirToDelete *string
		sourceParent := filepath.Dir(sourceLocalPath)
		if m.tempPaths[sourceParent] {
			dirToDelete = &sourceParent
		}
		m.uploads[uploadID] = upload{
			dirToDelete: dirToDelete,
			uploadID:    uploadID,
			opid:        opid,
			state: keybase1.UploadState{
				UploadID:   uploadID,
				TargetPath: dstPath,
			},
		}
	})

	// If we start having tests on this we'll need proper shutdown mechanism
	// for these goroutines.
	go m.waitForCopy(uploadID)

	return uploadID, nil
}

func (m *uploadManager) cancel(ctx context.Context, uploadID string) error {
	upload, ok := m.getUpload(uploadID)
	if !ok {
		return nil
	}
	return m.k.SimpleFSCancel(ctx, upload.opid)
}

func (m *uploadManager) dismiss(uploadID string) error {
	upload, ok := m.getUpload(uploadID)
	if !ok {
		return nil
	}
	if !upload.state.Canceled && upload.state.Error == nil {
		return errors.New("dismiss called on ongoing upload")
	}
	m.doWhileLocked(func() {
		delete(m.uploads, uploadID)
	})
	m.publisher.PublishChange(keybase1.SubscriptionTopic_UPLOAD_STATUS)
	return nil
}

func (m *uploadManager) getUploads() (uploads []keybase1.UploadState) {
	m.lock.RLock()
	defer m.lock.RUnlock()
	uploads = make([]keybase1.UploadState, 0, len(m.uploads))
	for _, upload := range m.uploads {
		uploads = append(uploads, upload.state)
	}
	return uploads
}
