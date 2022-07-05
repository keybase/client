// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"syscall"
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
	info         keybase1.DownloadInfo
	safeFilename string
	state        keybase1.DownloadState
	opid         keybase1.OpID
}

// downloadManager manages "downloads" initiated from outside KBFS. To KBFS,
// this is more like "exporting". Currently this is only used by GUI, so its
// APIs are tailored to the GUI.
//
// We have regular downloads which are tracked in the app visually, and are
// moved into a "Downloads" folder after they're done, and non-regular
// downloads which are for "Save" and "Send to other apps" on mobile. When the
// user chooses to save a photo or a video, or share a file to another app, we
// download to a cache folder and have GUI call some APIs to actually add them
// to the photo library or send to other apps.
type downloadManager struct {
	k         *SimpleFS
	publisher libkbfs.SubscriptionManagerPublisher

	lock        sync.RWMutex
	cacheDir    string
	downloadDir string
	downloads   map[string]download // download ID -> download
}

func newDownloadManager(simpleFS *SimpleFS) *downloadManager {
	return &downloadManager{
		k:           simpleFS,
		publisher:   simpleFS.config.SubscriptionManagerPublisher(),
		cacheDir:    simpleFS.config.KbEnv().GetCacheDir(),
		downloadDir: simpleFS.config.KbEnv().GetDownloadsDir(),
		downloads:   make(map[string]download),
	}
}

func (m *downloadManager) makeContext() (ctx context.Context, cancel func()) {
	return context.WithCancel(libkbfs.CtxWithRandomIDReplayable(context.Background(), dlCtxIDKey, dlCtxOpID, m.k.log))
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
	defer m.publisher.PublishChange(keybase1.SubscriptionTopic_DOWNLOAD_STATUS)
	m.lock.Lock()
	defer m.lock.Unlock()
	download, ok := m.downloads[downloadID]
	if !ok {
		return errors.New("unknown downloadID")
	}
	m.downloads[downloadID] = f(download)
	return nil
}

const monitorDownloadTickerInterval = time.Second

func (m *downloadManager) monitorDownload(
	ctx context.Context, opid keybase1.OpID, downloadID string,
	done func(error)) {
	ticker := time.NewTicker(monitorDownloadTickerInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			resp, err := m.k.SimpleFSCheck(ctx, opid)
			switch errors.Cause(err) {
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
				// wait for ctx.Done().
			default:
				done(err)
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

func (m *downloadManager) getCacheDir() string {
	m.lock.RLock()
	defer m.lock.RUnlock()
	return m.cacheDir
}

func (m *downloadManager) getDownloadDir() string {
	m.lock.RLock()
	defer m.lock.RUnlock()
	return m.downloadDir
}

func (m *downloadManager) getFilenames(
	kbfsPath keybase1.KBFSPath) (filename, safeFilename string) {
	_, filename = path.Split(path.Clean(kbfsPath.Path))
	return filename, libkb.GetSafeFilename(filename)
}

func (m *downloadManager) getDownloadPath(
	ctx context.Context, filename, downloadID string) (
	downloadPath string, err error) {
	parentDir := filepath.Join(m.getCacheDir(), "simplefsdownload")
	if err = os.MkdirAll(parentDir, 0700); err != nil {
		return "", err
	}
	downloadPath = filepath.Join(parentDir, downloadID+path.Ext(filename))
	return downloadPath, nil
}

func (m *downloadManager) moveToDownloadFolder(
	ctx context.Context, srcPath string, filename string) (localPath string, err error) {
	// There's no download on iOS; just saving to the photos library and
	// sharing to other apps, both of which are handled in JS after the
	// download (to the cache dir) finishes.
	if libkb.GetPlatformString() == "ios" || libkb.GetPlatformString() == "ipad" {
		return "", errors.New("MoveToDownloadFolder is not supported on iOS")
	}
	parentDir := m.getDownloadDir()
	if err = os.MkdirAll(parentDir, 0700); err != nil {
		return "", err
	}
	destPath, err := libkb.FindFilePathWithNumberSuffix(parentDir, filename, false)
	if err != nil {
		return "", err
	}

	err = os.Rename(srcPath, destPath)
	switch er := err.(type) {
	case nil:
		return destPath, nil
	case *os.LinkError:
		if er.Err != syscall.EXDEV {
			return "", err
		}
		// Rename failed because dest and src are on different devices. So
		// use SimpleFSMove which copies then deletes.
		opid, err := m.k.SimpleFSMakeOpid(ctx)
		if err != nil {
			return "", err
		}
		err = m.k.SimpleFSMove(ctx, keybase1.SimpleFSMoveArg{
			OpID: opid,
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
		return destPath, nil
	default:
		return "", err
	}
}

func (m *downloadManager) waitForDownload(ctx context.Context,
	downloadID string, downloadPath string, done func(error)) {
	d, err := m.getDownload(downloadID)
	if err != nil {
		done(err)
		return
	}
	err = m.k.SimpleFSWait(ctx, d.opid)
	if err != nil {
		done(err)
		return
	}

	var localPath string
	if d.info.IsRegularDownload {
		localPath, err = m.moveToDownloadFolder(
			ctx, downloadPath, d.safeFilename)
		if err != nil {
			done(err)
			return
		}
	} else {
		localPath = downloadPath
	}

	done(m.updateDownload(downloadID, func(d download) download {
		d.state.LocalPath = localPath
		return d
	}))
}

func (m *downloadManager) startDownload(
	ctx context.Context, arg keybase1.SimpleFSStartDownloadArg) (
	downloadID string, err error) {
	opid, err := m.k.SimpleFSMakeOpid(ctx)
	if err != nil {
		return "", err
	}
	downloadID = strconv.FormatInt(time.Now().UnixNano(), 16)
	filename, safeFilename := m.getFilenames(arg.Path)
	downloadPath, err := m.getDownloadPath(ctx, filename, downloadID)
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
		defer m.publisher.PublishChange(keybase1.SubscriptionTopic_DOWNLOAD_STATUS)
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
			opid:         opid,
			safeFilename: safeFilename,
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
			if errors.Cause(err) == context.Canceled {
				d.state.Canceled = true
			} else if err != nil {
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
	go m.waitForDownload(bgCtx, downloadID, downloadPath, done)

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
	// make sure it's canceled, but don't error if it's already dismissed.
	_ = m.cancelDownload(ctx, downloadID)
	defer m.publisher.PublishChange(keybase1.SubscriptionTopic_DOWNLOAD_STATUS)
	m.lock.Lock()
	defer m.lock.Unlock()
	delete(m.downloads, downloadID)
}

func (m *downloadManager) getDownloadInfo(downloadID string) (keybase1.DownloadInfo, error) {
	d, err := m.getDownload(downloadID)
	if err != nil {
		return keybase1.DownloadInfo{}, err
	}
	return d.info, nil
}

func (m *downloadManager) configureDownload(cacheDirOverride string, downloadDirOverride string) {
	m.lock.Lock()
	defer m.lock.Unlock()
	if len(cacheDirOverride) > 0 {
		m.cacheDir = cacheDirOverride
	}
	if len(downloadDirOverride) > 0 {
		m.downloadDir = downloadDirOverride
	}
}
