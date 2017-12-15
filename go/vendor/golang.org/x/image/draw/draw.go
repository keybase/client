// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package draw provides image composition functions.
//
// See "The Go image/draw package" for an introduction to this package:
// http://golang.org/doc/articles/image_draw.html
//
// This package is a superset of and a drop-in replacement for the image/draw
// package in the standard library.
package draw

// This file, and the go1_*.go files, just contains the API exported by the
// image/draw package in the standard library. Other files in this package
// provide additional features.

import (
	"image"
	"image/draw"
)

// Draw calls DrawMask with a nil mask.
func Draw(dst Image, r image.Rectangle, src image.Image, sp image.Point, op Op) {
	draw.Draw(dst, r, src, sp, draw.Op(op))
}

// DrawMask aligns r.Min in dst with sp in src and mp in mask and then
// replaces the rectangle r in dst with the result of a Porter-Duff
// composition. A nil mask is treated as opaque.
func DrawMask(dst Image, r image.Rectangle, src image.Image, sp image.Point, mask image.Image, mp image.Point, op Op) {
	draw.DrawMask(dst, r, src, sp, mask, mp, draw.Op(op))
}

// FloydSteinberg is a Drawer that is the Src Op with Floyd-Steinberg error
// diffusion.
var FloydSteinberg Drawer = floydSteinberg{}

type floydSteinberg struct{}

func (floydSteinberg) Draw(dst Image, r image.Rectangle, src image.Image, sp image.Point) {
	draw.FloydSteinberg.Draw(dst, r, src, sp)
}
