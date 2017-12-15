/*
Copyright 2013 The Camlistore AUTHORS

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package images

import (
	"image"
	"testing"
)

func benchRescale(b *testing.B, w, h, thumbW, thumbH int) {
	// Most JPEGs are YCbCr, so bench with that.
	im := image.NewYCbCr(image.Rect(0, 0, w, h), image.YCbCrSubsampleRatio422)
	o := &DecodeOpts{MaxWidth: thumbW, MaxHeight: thumbH}
	sw, sh, needRescale := o.rescaleDimensions(im.Bounds(), false)
	if !needRescale {
		b.Fatal("opts.rescaleDimensions failed to indicate image needs rescale")
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = rescale(im, sw, sh)
	}
}

func BenchmarkRescale1000To50(b *testing.B) {
	orig, thumb := 1000, 50
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale1000To100(b *testing.B) {
	orig, thumb := 1000, 100
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale1000To200(b *testing.B) {
	orig, thumb := 1000, 200
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale1000To400(b *testing.B) {
	orig, thumb := 1000, 400
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale1000To800(b *testing.B) {
	orig, thumb := 1000, 800
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale2000To50(b *testing.B) {
	orig, thumb := 2000, 50
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale2000To100(b *testing.B) {
	orig, thumb := 2000, 100
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale2000To200(b *testing.B) {
	orig, thumb := 2000, 200
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale2000To400(b *testing.B) {
	orig, thumb := 2000, 400
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale2000To800(b *testing.B) {
	orig, thumb := 2000, 800
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale4000To50(b *testing.B) {
	orig, thumb := 4000, 50
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale4000To100(b *testing.B) {
	orig, thumb := 4000, 100
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale4000To200(b *testing.B) {
	orig, thumb := 4000, 200
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale4000To400(b *testing.B) {
	orig, thumb := 4000, 400
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale4000To800(b *testing.B) {
	orig, thumb := 4000, 800
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale8000To50(b *testing.B) {
	orig, thumb := 8000, 50
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale8000To100(b *testing.B) {
	orig, thumb := 8000, 100
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale8000To200(b *testing.B) {
	orig, thumb := 8000, 200
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale8000To400(b *testing.B) {
	orig, thumb := 8000, 400
	benchRescale(b, orig, orig, thumb, thumb)
}

func BenchmarkRescale8000To800(b *testing.B) {
	orig, thumb := 8000, 800
	benchRescale(b, orig, orig, thumb, thumb)
}
