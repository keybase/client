// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build !android

package font

import "io/ioutil"

func buildDefault() ([]byte, error) {
	// Try Noto first, but fall back to Droid as the latter was deprecated
	noto, nerr := ioutil.ReadFile("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf")
	if nerr != nil {
		if droid, err := ioutil.ReadFile("/usr/share/fonts/truetype/droid/DroidSans.ttf"); err == nil {
			return droid, nil
		}
	}
	return noto, nerr
}

func buildMonospace() ([]byte, error) {
	// Try Noto first, but fall back to Droid as the latter was deprecated
	noto, nerr := ioutil.ReadFile("/usr/share/fonts/truetype/noto/NotoMono-Regular.ttf")
	if nerr != nil {
		if droid, err := ioutil.ReadFile("/usr/share/fonts/truetype/droid/DroidSansMono.ttf"); err == nil {
			return droid, nil
		}
	}
	return noto, nerr
}
