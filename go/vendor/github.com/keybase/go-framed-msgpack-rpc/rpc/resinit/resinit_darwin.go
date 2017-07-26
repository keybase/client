// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package resinit

// NOTE: The Darwin build requires -lresolv, but that option breaks FreeBSD.
// This implementation is split out from resinit_nix.go for that reason. See
// https://github.com/keybase/keybase-issues/issues/3022.

// #cgo LDFLAGS: -lresolv
// #include<sys/types.h>
// #include<netinet/in.h>
// #include<arpa/nameser.h>
// #include<resolv.h>
import "C"

func resInit() {
	C.res_init()
}
