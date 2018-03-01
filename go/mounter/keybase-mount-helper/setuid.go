// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package main

/*
#include <sys/types.h>
#include <unistd.h>
#include <errno.h>

int setuid_root(uid_t uid) {
	int ret = setuid(uid);
	if (ret == 0) {
		return 0;
	} else {
		return errno;
	}
}
*/
import "C"
import "fmt"

func setUid(uid int) error {
	ret := C.setuid(C.__uid_t(uid))
	if ret != 0 {
		return fmt.Errorf("setuid(0) returned non-zero ERRNO: %d", ret)
	}
	return nil
}
