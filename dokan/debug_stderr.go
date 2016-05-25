// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build debug

package dokan

import (
	"log"
)

const isDebug = true

func debug(args ...interface{}) {
	log.Println(args...)
}

func debugf(s string, args ...interface{}) {
	log.Printf(s, args...)
}
