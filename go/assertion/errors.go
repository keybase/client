// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package assertion

import "fmt"

type ImplicitTeamDisplayNameError struct {
	msg string
}

func (e ImplicitTeamDisplayNameError) Error() string {
	return fmt.Sprintf("Error parsing implicit team name: %s", e.msg)
}

func NewImplicitTeamDisplayNameError(format string, args ...interface{}) ImplicitTeamDisplayNameError {
	return ImplicitTeamDisplayNameError{fmt.Sprintf(format, args...)}
}
