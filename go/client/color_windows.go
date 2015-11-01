// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package client

func HasColor() bool {
	// This is used for embedding color codes in UI strings,
	// which won't work in Windows
	return false
}
