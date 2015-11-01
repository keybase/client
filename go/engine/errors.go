// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"fmt"
)

//=============================================================================

type CheckError struct {
	m string
}

func (e CheckError) Error() string {
	return fmt.Sprintf("Check engine error: %s", e.m)
}

//=============================================================================
