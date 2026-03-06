// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

// Log is the logging interface for the sources package
type Log interface {
	Debugf(s string, args ...any)
	Infof(s string, args ...any)
	Warningf(s string, args ...any)
	Errorf(s string, args ...any)
}
