// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

/*
#include "bridge.h"
*/
import "C"

import (
	"errors"
)

// Unmount a drive mounted by dokan.
func Unmount(driveLetter byte) error {
	debug("Unmount: Calling Dokan.Unmount")
	res := C.DokanUnmount(C.WCHAR(driveLetter))
	if res == C.FALSE {
		debug("Unmount: Failed!")
		return errors.New("DokanRemoveMountPoint failed!")
	}
	debug("Unmount: Success!")
	return nil
}
