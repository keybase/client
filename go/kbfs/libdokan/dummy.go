// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package libdokan

// Provide support for compiling on *nix

func isNewFolderName(name string) bool { return false }

var newFolderName, newFolderAltName string
var newFolderNameErr error
