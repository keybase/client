// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package mounter

// Log is the logging interface for this package
type Log interface {
	Debug(s string, args ...interface{})
	Info(s string, args ...interface{})
	Errorf(s string, args ...interface{})
}
