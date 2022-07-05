// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !production

package libkbfs

import "github.com/keybase/client/go/kbfs/kbfsblock"

func verifyLocalBlockIDMaybe(data []byte, id kbfsblock.ID) error {
	return kbfsblock.VerifyID(data, id)
}
