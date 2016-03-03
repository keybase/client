// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"encoding/json"
	"time"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func getEncodedFolderStatus(ctx context.Context, fs *FS,
	folderBranch *libkbfs.FolderBranch) (
	data []byte, t time.Time, err error) {

	var status libkbfs.FolderBranchStatus
	status, _, err = fs.config.KBFSOps().
		Status(ctx, *folderBranch)
	if err != nil {
		return nil, time.Time{}, err
	}

	data, err = json.MarshalIndent(status, "", "  ")
	if err != nil {
		return nil, time.Time{}, err
	}

	data = append(data, '\n')
	return data, time.Time{}, err
}

func getEncodedStatus(ctx context.Context, fs *FS) (
	data []byte, t time.Time, err error) {
	username, _, _ := fs.config.KBPKI().GetCurrentUserInfo(ctx)
	var usageBytes int64
	var limitBytes int64
	quotaInfo, err := fs.config.BlockServer().GetUserQuotaInfo(ctx)
	if err == nil {
		usageBytes = quotaInfo.Total.UsageBytes
		limitBytes = quotaInfo.Limit
	}
	data, err = json.MarshalIndent(libfs.KbfsStatus{
		CurrentUser: username.String(),
		IsConnected: fs.config.MDServer().IsConnected(),
		UsageBytes:  usageBytes,
		LimitBytes:  limitBytes,
	}, "", "  ")
	if err != nil {
		return nil, t, err
	}
	data = append(data, '\n')
	return data, t, err
}

func NewStatusFile(fs *FS, folderBranch *libkbfs.FolderBranch) *SpecialReadFile {
	return &SpecialReadFile{
		read: func(ctx context.Context) ([]byte, time.Time, error) {
			if folderBranch == nil {
				return getEncodedStatus(ctx, fs)
			}
			return getEncodedFolderStatus(ctx, fs, folderBranch)
		},
		fs: folder.fs,
	}
}
