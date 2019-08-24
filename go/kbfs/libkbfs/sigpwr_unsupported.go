// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !linux,!netbsd
// see files in https://golang.org/src/syscall/ starting with "zerrors_" for support

package libkbfs

// SIGPWR isn't supported outside of Linux.
const SIGPWR = NonexistentSignal
