// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows,!android

package resinit

// NOTE: The Go compiler will completely skip this file if cgo is disabled,
// which is the default for any kind of cross-compiling (e.g. GOARCH=386). In
// that case you must set CGO_ENABLED=1 in the environment.

// #cgo LDFLAGS: -lresolv
// #include<resolv.h>
import "C"

func resInit() {
	C.res_init()
}
