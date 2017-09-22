// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package reverse implements an Android app in 100% Go.

// +build android

package reverse

import (
	"Java/android/databinding/DataBindingUtil"
	"Java/android/os"
	"Java/android/support/v7/app"
	gopkg "Java/reverse"
	rlayout "Java/reverse/R/layout"
	"Java/reverse/databinding"
	"Java/reverse/databinding/ActivityMainBinding"
)

type MainActivity struct {
	app.AppCompatActivity
	binding databinding.ActivityMainBinding
}

func (a *MainActivity) OnCreate(this gopkg.MainActivity, b os.Bundle) {
	this.Super().OnCreate(b)
	db := DataBindingUtil.SetContentView(this, rlayout.Activity_main)
	a.binding = ActivityMainBinding.Cast(db)
	a.binding.SetAct(this)
}

func (a *MainActivity) OnDestroy(this gopkg.MainActivity) {
	a.binding = nil // break reference cycle
	this.Super().OnDestroy()
}

func (a *MainActivity) GetLabel() string {
	return "Hello from Go!"
}
