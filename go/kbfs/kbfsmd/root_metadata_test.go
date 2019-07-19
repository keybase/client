// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"reflect"
	"runtime"
	"strings"
	"testing"
)

var testMetadataVers = []MetadataVer{
	InitialExtraMetadataVer, SegregatedKeyBundlesVer,
}

// runTestOverMetadataVers runs the given test function over all
// metadata versions to test. The test is assumed to be parallelizable
// with other instances of itself. Example use:
//
// func TestFoo(t *testing.T) {
//	runTestOverMetadataVers(t, testFoo)
// }
//
// func testFoo(t *testing.T, ver MetadataVer) {
//	...
// 	brmd, err := MakeInitialRootMetadata(ver, ...)
//	...
// }
func runTestOverMetadataVers(
	t *testing.T, f func(t *testing.T, ver MetadataVer)) {
	for _, ver := range testMetadataVers {
		ver := ver // capture range variable.
		t.Run(ver.String(), func(t *testing.T) {
			f(t, ver)
		})
	}
}

// runTestsOverMetadataVers runs the given list of test functions over
// all metadata versions to test. prefix should be the common prefix
// for all the test function names, and the names of the subtest will
// be taken to be the strings after that prefix. Example use:
//
// func TestFoo(t *testing.T) {
// 	tests := []func(*testing.T, MetadataVer){
//		testFooBar1,
//		testFooBar2,
//		testFooBar3,
//		...
//	}
//	runTestsOverMetadataVers(t, "testFoo", tests)
// }
func runTestsOverMetadataVers(t *testing.T, prefix string,
	fs []func(t *testing.T, ver MetadataVer)) {
	for _, f := range fs {
		f := f // capture range variable.
		name := runtime.FuncForPC(reflect.ValueOf(f).Pointer()).Name()
		i := strings.LastIndex(name, prefix)
		if i >= 0 {
			i += len(prefix)
		} else {
			i = 0
		}
		name = name[i:]
		t.Run(name, func(t *testing.T) {
			runTestOverMetadataVers(t, f)
		})
	}
}
