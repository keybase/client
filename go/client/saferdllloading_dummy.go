// +build !windows

// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

// SaferDLLLoading dummy for platforms not needing this.
func SaferDLLLoading() error { return nil }
