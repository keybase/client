// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package resinit

// /* Bionic has res_init() but it's not in any header. Patterned off of: */
// /* https://mail.gnome.org/archives/commits-list/2013-May/msg01329.html */
// int res_init (void);
import "C"

func resInit() {
	C.res_init()
}
