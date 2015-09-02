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
