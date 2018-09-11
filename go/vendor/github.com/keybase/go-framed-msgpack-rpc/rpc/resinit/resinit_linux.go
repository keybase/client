// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux,!android,!noresinit

package resinit

// Versions of glibc prior to 2.26 (not yet released as of this writing) have a
// longstanding bug where they don't detect changes in /etc/resolv.conf, which
// can cause programs to get into a permanent "host not found" state even
// though the network is up. The workaround for this bug is to call the
// res_init() libc function to clear the cached configs, generally after a
// failed network request.
//
// However, res_init() is documented *not threadsafe*. It really does crash on
// OSX if you call it from multiple threads on e.g. macOS
// (https://github.com/rust-lang/rust/issues/43592). Nor does putting a lock
// around it totally let us off the hook. This is library code, after all, and
// there's no telling what *other* libraries might be doing on parallel threads
// in our process.
//
// Luckily, glibc in particular (the only libc implementation I know of with
// this resolv.conf bug) appears to have a thread-safe implementation of
// res_init(). So in a perfect world, we would call res_init on lookup failure
// if-and-only-if we're running under glibc. And such a thing is possible, if
// we want to be responsible for cgo code like this (this does seem to work
// but...yeesh):
//
//   // #cgo LDFLAGS: -ldl
//   /*
//   #define _GNU_SOURCE
//   #include<dlfcn.h>
//
//   typedef const char* (*stringFunc) ();
//
//   // Returns something like "2.25" if running under glibc, otherwise "".
//   const char* glibcVersionIfDefined() {
//     stringFunc funcPtr = dlsym(RTLD_DEFAULT, "gnu_get_libc_version");
//     if (funcPtr == 0) {
//       return "";
//     } else {
//       return funcPtr();
//     }
//   }
//   */
//   import "C"
//
// Instead of doing that...thing...we're going to make a simpler compromise:
// 1) Only call res_init on (non-Android) Linux, which is almost certainly the
//    only place we'll ever see glibc. Helpfully, the second mostly popular
//    libc I know of on Linux, musl, also has a threadsafe/empty res_init().
// 2) As a precaution against rare/future libc implementations that might not
//    be threadsafe, make a best effort to lock the call with a Mutex, and
//    trust the application not to call other libraries that do the same thing.
//
// NOTE: The Go compiler will completely skip this file if cgo is disabled,
// which is the default for any kind of cross-compiling (e.g. GOARCH=386). In
// that case you must set CGO_ENABLED=1 in the environment.

// #cgo LDFLAGS: -lresolv
// #include <netinet/in.h>
// #include <arpa/nameser.h>
// #include <resolv.h>
import "C"

import "sync"

var resInitMutex sync.Mutex

func resInit() {
	resInitMutex.Lock()
	C.res_init()
	resInitMutex.Unlock()
}
