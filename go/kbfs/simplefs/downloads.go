// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	// dlCtxOpID is the display name for the unique operation SimpleFS ID tag.
	dlCtxOpID = "SFSDLID"
)

// dlCtxTagKey is the type used for unique context tags
type dlCtxTagKey int

const (
	// dlCtxIDKey is the type of the tag for unique operation IDs.
	dlCtxIDKey dlCtxTagKey = iota
)

type download struct {
	info  keybase1.DownloadInfo
	state keybase1.DownloadState
	opid  keybase1.OpID
}

// downloadManager manages downloads.
type downloadManager struct {
	k         *SimpleFS
	publisher libkbfs.SubscriptionManagerPublisher

	lock      sync.RWMutex
	downloads map[string]download // download ID -> download
}

func newDownloadManager(simpleFS *SimpleFS) *downloadManager {
	return &downloadManager{
		k:         simpleFS,
		publisher: simpleFS.config.SubscriptionManagerPublisher(),
		downloads: make(map[string]download),
	}
}

func (m *downloadManager) makeContext() (ctx context.Context, cancel func()) {
	return context.WithCancel(libkbfs.CtxWithRandomIDReplayable(context.Background(), dlCtxIDKey, dlCtxOpID, m.k.log))
}

func (m *downloadManager) accessDownloads(isWrite bool, f func()) {
	if isWrite {
		m.lock.Lock()
		defer m.lock.Unlock()
	} else {
		m.lock.RLock()
		defer m.lock.RUnlock()
	}
	f()
	if isWrite {
		m.publisher.DownloadStatusChanged()
	}
}

func (m *downloadManager) getDownload(downloadID string) (download, error) {
	m.lock.RLock()
	defer m.lock.RUnlock()
	d, ok := m.downloads[downloadID]
	if !ok {
		return download{}, errors.New("unknown downloadID")
	}
	return d, nil
}

func (m *downloadManager) updateDownload(downloadID string, f func(original download) download) (err error) {
	m.lock.Lock()
	defer m.lock.Unlock()
	download, ok := m.downloads[downloadID]
	if !ok {
		return errors.New("unknown downloadID")
	}
	m.downloads[downloadID] = f(download)
	return nil
}

func (m *downloadManager) monitorDownload(
	ctx context.Context, opid keybase1.OpID, downloadID string,
	done func(error)) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			resp, err := m.k.SimpleFSCheck(ctx, opid)
			switch err {
			case nil:
				if err := m.updateDownload(downloadID, func(d download) download {
					d.state.EndEstimate = resp.EndEstimate
					d.state.Progress = float64(
						resp.BytesWritten) / float64(resp.BytesTotal)
					return d
				}); err != nil {
					done(err)
					return
				}
			case errNoResult:
				// This is from simpleFS. Likely download has finished, but
				// wait for the done ch.
			default:
				done(err)
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

func (m *downloadManager) getDownloadPath(
	ctx context.Context, kbfsPath keybase1.KBFSPath, downloadID string) (
	downloadPath string, filename string, err error) {
	parentDir := filepath.Join(m.k.config.KbEnv().GetCacheDir(), "simplefsdownload")
	if err = os.MkdirAll(parentDir, 0700); err != nil {
		return "", "", err
	}
	_, filename = path.Split(path.Clean(kbfsPath.Path))
	downloadPath = filepath.Join(parentDir, filename+"-"+downloadID)
	return downloadPath, filename, nil
}

func (m *downloadManager) moveToDownloadFolder(
	ctx context.Context, srcPath string, filename string) (localPath string, err error) {
	if libkb.GetPlatformString() == "ios" {
		return "", errors.New("MoveToDownloadFolder is not supported on iOS")
	}
	// TODO test android
	parentDir := filepath.Join(m.k.config.KbEnv().GetHome(), "Downloads")
	if err = os.MkdirAll(parentDir, 0700); err != nil {
		return "", err
	}
	destPathBase := filepath.Join(parentDir, filename)
	destPath := destPathBase
	for suffix := 1; ; suffix++ {
		_, err := os.Stat(destPath)
		if os.IsNotExist(err) {
			break
		}
		if err != nil {
			return "", err
		}
		destPath = fmt.Sprintf("%s (%d)", destPathBase, suffix)
	}
	// could race but it should be rare enough so fine

	err = os.Rename(srcPath, destPath)
	if err != nil {
		// Rename failed; assume it's a cross-partition move.
		opid, err := m.k.SimpleFSMakeOpid(ctx)
		if err != nil {
			return "", err
		}
		err = m.k.SimpleFSMove(ctx, keybase1.SimpleFSMoveArg{
			Src:  keybase1.NewPathWithLocal(srcPath),
			Dest: keybase1.NewPathWithLocal(destPath),
		})
		if err != nil {
			return "", err
		}
		err = m.k.SimpleFSWait(ctx, opid)
		if err != nil {
			return "", err
		}
	}

	return destPath, nil
}

func (m *downloadManager) waitForDownload(ctx context.Context, opid keybase1.OpID, downloadID string, downloadPath string, done func(error)) {
	d, err := m.getDownload(downloadID)
	if err != nil {
		done(err)
		return
	}
	err = m.k.SimpleFSWait(ctx, opid)
	if err != nil {
		done(err)
		return
	}

	var localPath string
	if d.info.IsRegularDownload {
		localPath, err = m.moveToDownloadFolder(ctx, downloadPath, d.info.Filename)
		if err != nil {
			done(err)
			return
		}
	} else {
		localPath = downloadPath
	}
	if err = m.updateDownload(downloadID, func(d download) download {
		d.state.LocalPath = localPath
		return d
	}); err != nil {
		done(err)
		return
	}
	done(nil)
}

func (m *downloadManager) startDownload(
	ctx context.Context, arg keybase1.SimpleFSStartDownloadArg) (
	downloadID string, err error) {
	opid, err := m.k.SimpleFSMakeOpid(ctx)
	if err != nil {
		return "", err
	}
	downloadID = strconv.FormatInt(time.Now().UnixNano(), 16)
	downloadPath, filename, err := m.getDownloadPath(ctx, arg.Path, downloadID)
	if err != nil {
		return "", err
	}
	// TODO for dirs maybe we want zip instead?
	err = m.k.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
		OpID: opid,
		Src:  keybase1.NewPathWithKbfs(arg.Path),
		Dest: keybase1.NewPathWithLocal(downloadPath),
	})
	if err != nil {
		return "", err
	}

	func() {
		m.lock.Lock()
		defer m.lock.Unlock()
		m.downloads[downloadID] = download{
			info: keybase1.DownloadInfo{
				DownloadID:        downloadID,
				Path:              arg.Path,
				Filename:          filename,
				StartTime:         keybase1.ToTime(time.Now()),
				IsRegularDownload: arg.IsRegularDownload,
			},
			state: keybase1.DownloadState{
				DownloadID: downloadID,
			},
		}
	}()

	bgCtx, cancelBtCtx := m.makeContext()
	done := func(err error) {
		_ = m.updateDownload(downloadID, func(d download) download {
			if d.state.Done || d.state.Canceled || len(d.state.Error) > 0 {
				return d
			}
			if err != nil {
				d.state.Error = err.Error()
			} else {
				d.state.EndEstimate = keybase1.ToTime(time.Now())
				d.state.Progress = 1
				d.state.Done = true
			}
			return d
		})
		cancelBtCtx()
	}
	go m.monitorDownload(bgCtx, opid, downloadID, done)
	go m.waitForDownload(bgCtx, opid, downloadID, downloadPath, done)

	return downloadID, nil
}

func (m *downloadManager) getDownloadStatus(ctx context.Context) (
	status keybase1.DownloadStatus) {
	m.lock.RLock()
	defer m.lock.RUnlock()
	for _, download := range m.downloads {
		status.States = append(status.States, download.state)
		if download.info.IsRegularDownload {
			status.RegularDownloadIDs = append(
				status.RegularDownloadIDs, download.info.DownloadID)
		}
	}
	sort.Slice(status.RegularDownloadIDs, func(i, j int) bool {
		d1, ok := m.downloads[status.RegularDownloadIDs[i]]
		if !ok {
			return false
		}
		d2, ok := m.downloads[status.RegularDownloadIDs[j]]
		if !ok {
			return false
		}
		return d1.info.StartTime.After(d2.info.StartTime)
	})
	return status
}

func (m *downloadManager) cancelDownload(
	ctx context.Context, downloadID string) error {
	d, err := m.getDownload(downloadID)
	if err != nil {
		return err
	}
	return m.k.SimpleFSCancel(ctx, d.opid)
}

func (m *downloadManager) dismissDownload(
	ctx context.Context, downloadID string) {
	m.cancelDownload(ctx, downloadID)
	m.accessDownloads(true, func() {
		delete(m.downloads, downloadID)
	})
}

func (m *downloadManager) getDownloadInfo(downloadID string) (keybase1.DownloadInfo, error) {
	d, err := m.getDownload(downloadID)
	if err != nil {
		return keybase1.DownloadInfo{}, err
	}
	return d.info, nil
}
