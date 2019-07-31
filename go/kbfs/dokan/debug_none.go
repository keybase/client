// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !debug

package dokan

const isDebug = false //nolint

func debug(...interface{})          {} // nolint
func debugf(string, ...interface{}) {} // nolint
