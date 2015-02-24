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
