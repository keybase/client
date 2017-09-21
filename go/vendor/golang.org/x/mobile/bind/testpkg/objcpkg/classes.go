// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build ios

package objcpkg

import (
	"ObjC/Foundation"
	gopkg "ObjC/Objcpkg"
	"ObjC/UIKit"
)

const (
	DescriptionStr = "Descriptrion from Go"
	Hash           = 42
)

type GoNSDate struct {
	Foundation.NSDate
}

func (d *GoNSDate) Hash(self gopkg.GoNSDate) int {
	return Hash
}

func (d *GoNSDate) Description(self gopkg.GoNSDate) string {
	// Test self call
	if h := self.Hash(); h != Hash {
		panic("hash mismatch")
	}
	return DescriptionStr
}

func (d *GoNSDate) GetSelf(self gopkg.GoNSDate) Foundation.NSDate {
	return self
}

func NewGoNSDate() *GoNSDate {
	return new(GoNSDate)
}

type GoNSObject struct {
	C       Foundation.NSObjectC // The class
	P       Foundation.NSObjectP // The protocol
	UseSelf bool
}

func (o *GoNSObject) Description(self gopkg.GoNSObject) string {
	if o.UseSelf {
		return DescriptionStr
	} else {
		return self.Super().Description()
	}
}

func DupNSDate(date Foundation.NSDate) Foundation.NSDate {
	return date
}

type GoUIResponder struct {
	UIKit.UIResponder
	Called bool
}

func (r *GoUIResponder) PressesBegan(_ Foundation.NSSet, _ UIKit.UIPressesEvent) {
	r.Called = true
}

// Check that implicitly referenced types are wrapped.
func implicitType(r UIKit.UIResponder) {
	r.MotionBegan(0, nil)
}
