// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package engine

func (u *UpdateEngine) AfterUpdateApply(willRestart bool) error {
	return nil
}
