// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

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
