package cli

import (
	"errors"
)

var (
	errHelpRequested    = errors.New("help requested")
	errVersionRequested = errors.New("version requested")
)
