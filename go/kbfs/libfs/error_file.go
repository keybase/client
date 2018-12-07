// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"time"

	goerrors "github.com/go-errors/errors"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// JSONReportedError stringifies the reported error before marshalling
type JSONReportedError struct {
	Time  time.Time
	Error string
	Stack []goerrors.StackFrame
}

func convertStack(stack []uintptr) []goerrors.StackFrame {
	frames := make([]goerrors.StackFrame, len(stack))
	for i, pc := range stack {
		// TODO: Handle panics correctly, as described in the
		// docs for runtime.Callers().
		frames[i] = goerrors.NewStackFrame(pc)
	}
	return frames
}

// GetEncodedErrors gets the list of encoded errors in a format suitable
// for error file.
func GetEncodedErrors(config libkbfs.Config) func(context.Context) ([]byte, time.Time, error) {
	return func(_ context.Context) ([]byte, time.Time, error) {
		errors := config.Reporter().AllKnownErrors()
		jsonErrors := make([]JSONReportedError, len(errors))
		for i, e := range errors {
			jsonErrors[i].Time = e.Time
			jsonErrors[i].Error = e.Error.Error()
			jsonErrors[i].Stack = convertStack(e.Stack)
		}
		data, err := PrettyJSON(jsonErrors)
		var t time.Time
		if len(errors) > 0 {
			t = errors[len(errors)-1].Time
		}
		return data, t, err
	}
}
