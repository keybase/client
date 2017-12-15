/*
Copyright 2014 The Camlistore Authors.

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
	"bytes"
	"image"
	"image/jpeg"
	"io"
	"io/ioutil"
	"testing"

	"camlistore.org/pkg/images/fastjpeg"
	"camlistore.org/pkg/images/resize"
	"camlistore.org/pkg/types"
)

// The decode routines being benchmarked in this file will use these bytes for
// their in-memory io.Readers.
var jpegBytes []byte

func init() {
	// Create image with non-uniform color to make decoding more realistic.
	// Solid color jpeg images decode faster than non-uniform images.
	b := new(bytes.Buffer)
	w, h := 4000, 4000
	im := image.NewNRGBA(image.Rect(0, 0, w, h))
	for i := range im.Pix {
		switch {
		case i%4 == 3:
			im.Pix[i] = 255
		default:
			im.Pix[i] = uint8(i)
		}
	}
	if err := jpeg.Encode(b, im, nil); err != nil {
		panic(err)
	}
	jpegBytes = b.Bytes()
}

type decodeFunc func(r io.Reader) (image.Image, string, error)

func BenchmarkStdlib(b *testing.B) {
	common(b, image.Decode)
}

func decodeDownsample(factor int) decodeFunc {
	return func(r io.Reader) (image.Image, string, error) {
		im, err := fastjpeg.DecodeDownsample(r, factor)
		return im, "jpeg", err
	}
}

func BenchmarkDjpeg1(b *testing.B) {
	if !fastjpeg.Available() {
		b.Skip("Skipping benchmark, djpeg unavailable.")
	}
	common(b, decodeDownsample(1))
}

func BenchmarkDjpeg2(b *testing.B) {
	if !fastjpeg.Available() {
		b.Skip("Skipping benchmark, djpeg unavailable.")
	}
	common(b, decodeDownsample(2))
}

func BenchmarkDjpeg4(b *testing.B) {
	if !fastjpeg.Available() {
		b.Skip("Skipping benchmark, djpeg unavailable.")
	}
	common(b, decodeDownsample(4))
}

func BenchmarkDjpeg8(b *testing.B) {
	if !fastjpeg.Available() {
		b.Skip("Skipping benchmark, djpeg unavailable.")
	}
	common(b, decodeDownsample(8))
}

func testRun(b types.TB, decode decodeFunc) {
	if !fastjpeg.Available() {
		b.Skip("Skipping benchmark, djpeg unavailable.")
	}
	im, _, err := decode(bytes.NewReader(jpegBytes))
	if err != nil {
		b.Fatal(err)
	}
	rect := im.Bounds()
	w, h := 128, 128
	im = resize.Resize(im, rect, w, h)
	err = jpeg.Encode(ioutil.Discard, im, nil)
	if err != nil {
		b.Fatal(err)
	}
}

func common(b *testing.B, decode decodeFunc) {
	for i := 0; i < b.N; i++ {
		testRun(b, decode)
	}
}

func TestStdlib(t *testing.T) {
	testRun(t, decodeDownsample(1))
}

func TestDjpeg1(t *testing.T) {
	testRun(t, decodeDownsample(1))
}

func TestDjpeg2(t *testing.T) {
	testRun(t, decodeDownsample(2))
}

func TestDjpeg4(t *testing.T) {
	testRun(t, decodeDownsample(4))
}

func TestDjpeg8(t *testing.T) {
	testRun(t, decodeDownsample(8))
}
