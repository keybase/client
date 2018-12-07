// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "github.com/keybase/client/go/kbfs/kbfsblock"

func translateToBlockServerError(err error) error {
	// TODO: Translate blockContextMismatchError, too, if the
	// actual server returns a similar error.
	switch err := err.(type) {
	case blockNonExistentError:
		return kbfsblock.ServerErrorBlockNonExistent{Msg: err.Error()}
	default:
		return err
	}
}
