// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build production

package libkbfs

import "github.com/keybase/client/go/kbfs/kbfsblock"

func verifyLocalBlockIDMaybe(_ []byte, _ kbfsblock.ID) error {
	// Don't bother verifying local block IDs when we're in production
	// mode, since it's expensive.
	return nil
}
