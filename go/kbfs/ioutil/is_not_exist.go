// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package ioutil

import (
	"os"

	"github.com/pkg/errors"
)

// IsNotExist is like os.IsNotExist, but handles wrapped errors, too.
func IsNotExist(err error) bool {
	return os.IsNotExist(errors.Cause(err))
}
