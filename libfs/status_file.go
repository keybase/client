// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

// StatusFileName is the name of the KBFS status file -- it can be reached
// anywhere within a top-level folder or inside the Keybase root
const StatusFileName = ".kbfs_status"

// KbfsStatus represents the content of the top-level status file
type KbfsStatus struct {
	CurrentUser string
	IsConnected bool
	UsageBytes  int64
	LimitBytes  int64
}
