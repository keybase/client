// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"time"

	"github.com/keybase/kbfs/libkbfs"
)

// GetEncodedUserEditHistory returns serialized JSON containing the
// file edit history for the user.
func GetEncodedUserEditHistory(config libkbfs.Config) (
	data []byte, t time.Time, err error) {
	edits := config.UserHistory().Get()
	data, err = PrettyJSON(edits)
	return data, time.Time{}, err
}
