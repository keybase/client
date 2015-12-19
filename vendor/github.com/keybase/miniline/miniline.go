package miniline

import (
	"errors"
)

// ErrInterrupted is an error if input is interrupted
var ErrInterrupted = errors.New("Interrupted")
