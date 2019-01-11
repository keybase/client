// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/trace"
)

type traceLogger struct {
	logger.Logger
}

// TODO: Override logger.Logger functions to trace log statements if
// the right options are turned on.

func (tl traceLogger) LazyTrace(
	ctx context.Context, format string, args ...interface{}) {
	if tr, ok := trace.FromContext(ctx); ok {
		tr.LazyPrintf(format, args...)
	}
}
