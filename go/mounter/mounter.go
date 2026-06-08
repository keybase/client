// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package mounter

// Log is the logging interface for this package
type Log interface {
	Debug(s string, args ...any)
	Info(s string, args ...any)
	Errorf(s string, args ...any)
}
