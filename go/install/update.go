// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin ios

package install

func AfterUpdateApply(context Context, willRestart bool, force bool, log Log) error {
	return nil
}
