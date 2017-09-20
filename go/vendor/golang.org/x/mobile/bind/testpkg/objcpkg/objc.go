// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build ios

package objcpkg

import (
	"ObjC/Foundation/NSDate"
	"ObjC/Foundation/NSString"
	"ObjC/QuartzCore/CAMediaTimingFunction"
)

func Func() {
	NSDate.Date()
	CAMediaTimingFunction.FunctionWithControlPoints(0, 0, 0, 0)
}

func Method() string {
	d := NSDate.Date()
	return d.Description()
}

func New() {
	NSDate.New()
	CAMediaTimingFunction.NewWithControlPoints(0, 0, 0, 0)
}

func Error() {
	str, err := NSString.StringWithContentsOfFileEncodingError("<non-existent>", 0)
	if err == nil {
		panic("no error from stringWithContentsOfFile")
	}
	// Assert err is an error
	err = err.(error)
	if str != "" {
		panic("non-empty string from stringWithContentsOfFile")
	}
	str, err = NSString.NewWithContentsOfFileEncodingError("<non-existent>", 0)
	if err == nil {
		panic("no error from stringWithContentsOfFile")
	}
	// Assert err is an error
	err = err.(error)
	if str != "" {
		panic("non-empty string from initWithContentsOfFile")
	}
}
