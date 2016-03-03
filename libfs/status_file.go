// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"encoding/json"
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// StatusFileName is the name of the KBFS status file -- it can be reached
// anywhere within a top-level folder or inside the Keybase root
const StatusFileName = ".kbfs_status"

// KbfsStatus represents the content of the top-level status file
type kbfsStatus struct {
	CurrentUser string
	IsConnected bool
	UsageBytes  int64
	LimitBytes  int64
}

// GetEncodedStatus returns serialized JSON containing status information for a
// folder
func GetEncodedFolderStatus(ctx context.Context, config libkbfs.Config,
	folderBranch *libkbfs.FolderBranch) (
	data []byte, t time.Time, err error) {

	var status libkbfs.FolderBranchStatus
	status, _, err = config.KBFSOps().
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

// GetEncodedStatus returns serialized JSON containing top-level KBFS status
// information
func GetEncodedStatus(ctx context.Context, config libkbfs.Config) (
	data []byte, t time.Time, err error) {
	username, _, _ := config.KBPKI().GetCurrentUserInfo(ctx)
	var usageBytes int64
	var limitBytes int64
	quotaInfo, err := config.BlockServer().GetUserQuotaInfo(ctx)
	if err == nil {
		usageBytes = quotaInfo.Total.UsageBytes
		limitBytes = quotaInfo.Limit
	}
	data, err = json.MarshalIndent(kbfsStatus{
		CurrentUser: username.String(),
		IsConnected: config.MDServer().IsConnected(),
		UsageBytes:  usageBytes,
		LimitBytes:  limitBytes,
	}, "", "  ")
	if err != nil {
		return nil, t, err
	}
	data = append(data, '\n')
	return data, t, err
}
