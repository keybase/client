// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"fmt"
)

// StringToRunMode turns a string into a run-mode
func StringToRunMode(s string) (RunMode, error) {
	switch s {
	case string(DevelRunMode):
		return DevelRunMode, nil
	case string(ProductionRunMode):
		return ProductionRunMode, nil
	case string(StagingRunMode):
		return StagingRunMode, nil
	case "":
		return NoRunMode, nil
	default:
		return NoRunMode, fmt.Errorf("unknown run mode: '%s'", s)
	}
}
