// +build !windows

// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

// SaferDLLLoading dummy for platforms not needing this.
func SaferDLLLoading() error { return nil }
