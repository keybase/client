// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"testing"
)

func testSplitExtension(t *testing.T, s, base, ext string) {
	//t.Logf("splitExtension(%q)", s)
	a, b := SplitFileExtension(s)
	if a != base || b != ext {
		t.Errorf("splitExtension(%q) => %q,%q, expected %q,%q", s, a, b, base, ext)
	}
}

func TestSplitExtension(t *testing.T) {
	testSplitExtension(t, "foo", "foo", "")
	testSplitExtension(t, "foo.txt", "foo", ".txt")
	testSplitExtension(t, "foo.tar.gz", "foo", ".tar.gz")
	testSplitExtension(t, "f.txt", "f", ".txt")
	testSplitExtension(t, ".txt", ".txt", "")
	testSplitExtension(t, ".tar.gz", ".tar.gz", "")
	testSplitExtension(t, "x/y.txt", "x/y", ".txt")
	testSplitExtension(t, "x/y", "x/y", "")
	testSplitExtension(t, "x/", "x/", "")
	testSplitExtension(t, "/.foo", "/.foo", "")
	testSplitExtension(t, "weird. is this?", "weird. is this?", "")
	testSplitExtension(t, "", "", "")
}
