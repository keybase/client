// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"

	"github.com/keybase/client/go/logger"
)

func OutputWriter() io.Writer {
	return logger.OutputWriter()
}

func ErrorWriter() io.Writer {
	return logger.ErrorWriter()
}
