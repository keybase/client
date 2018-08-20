// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

// Go support functions for generated Go bindings. This file is
// copied into the generated main package, and compiled along
// with the bindings.

// #cgo android CFLAGS: -D__GOBIND_ANDROID__
// #cgo darwin CFLAGS: -D__GOBIND_DARWIN__
// #include <stdlib.h>
// #include "seq.h"
import "C"

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	_ "golang.org/x/mobile/bind/java"
	_seq "golang.org/x/mobile/bind/seq"
)

func init() {
	_seq.FinalizeRef = func(ref *_seq.Ref) {
		refnum := ref.Bind_Num
		if refnum < 0 {
			panic(fmt.Sprintf("not a foreign ref: %d", refnum))
		}
		C.go_seq_dec_ref(C.int32_t(refnum))
	}
	_seq.IncForeignRef = func(refnum int32) {
		if refnum < 0 {
			panic(fmt.Sprintf("not a foreign ref: %d", refnum))
		}
		C.go_seq_inc_ref(C.int32_t(refnum))
	}
	// Workaround for issue #17393.
	signal.Notify(make(chan os.Signal), syscall.SIGPIPE)
}

// IncGoRef is called by foreign code to pin a Go object while its refnum is crossing
// the language barrier
//export IncGoRef
func IncGoRef(refnum C.int32_t) {
	_seq.Inc(int32(refnum))
}

func main() {}
