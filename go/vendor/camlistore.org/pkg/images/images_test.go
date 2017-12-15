/*
Copyright 2012 The Camlistore Authors.

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
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/rwcarlsen/goexif/exif"
)

const datadir = "testdata"

func equals(im1, im2 image.Image) bool {
	if !im1.Bounds().Eq(im2.Bounds()) {
		return false
	}
	for y := 0; y < im1.Bounds().Dy(); y++ {
		for x := 0; x < im1.Bounds().Dx(); x++ {
			r1, g1, b1, a1 := im1.At(x, y).RGBA()
			r2, g2, b2, a2 := im2.At(x, y).RGBA()
			if r1 != r2 || g1 != g2 || b1 != b2 || a1 != a2 {
				return false
			}
		}
	}
	return true
}

func straightFImage(t *testing.T) image.Image {
	g, err := os.Open(filepath.Join(datadir, "f1.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	defer g.Close()
	straightF, err := jpeg.Decode(g)
	if err != nil {
		t.Fatal(err)
	}
	return straightF
}

func smallStraightFImage(t *testing.T) image.Image {
	g, err := os.Open(filepath.Join(datadir, "f1-s.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	defer g.Close()
	straightF, err := jpeg.Decode(g)
	if err != nil {
		t.Fatal(err)
	}
	return straightF
}

func sampleNames(t *testing.T) []string {
	dir, err := os.Open(datadir)
	if err != nil {
		t.Fatal(err)
	}
	defer dir.Close()
	samples, err := dir.Readdirnames(-1)
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(samples)
	return samples
}

// TestEXIFCorrection tests that the input files with EXIF metadata
// are correctly automatically rotated/flipped when decoded.
func TestEXIFCorrection(t *testing.T) {
	samples := sampleNames(t)
	straightF := straightFImage(t)
	for _, v := range samples {
		if !strings.Contains(v, "exif") || strings.HasSuffix(v, "-s.jpg") {
			continue
		}
		name := filepath.Join(datadir, v)
		t.Logf("correcting %s with EXIF Orientation", name)
		f, err := os.Open(name)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		im, _, err := Decode(f, nil)
		if err != nil {
			t.Fatal(err)
		}
		if !equals(im, straightF) {
			t.Fatalf("%v not properly corrected with exif", name)
		}
	}
}

// TestForcedCorrection tests that manually specifying the
// rotation/flipping to be applied when decoding works as
// expected.
func TestForcedCorrection(t *testing.T) {
	samples := sampleNames(t)
	straightF := straightFImage(t)
	for _, v := range samples {
		if strings.HasSuffix(v, "-s.jpg") {
			continue
		}
		name := filepath.Join(datadir, v)
		t.Logf("forced correction of %s", name)
		f, err := os.Open(name)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		num := name[10]
		angle, flipMode := 0, 0
		switch num {
		case '1':
			// nothing to do
		case '2':
			flipMode = 2
		case '3':
			angle = 180
		case '4':
			angle = 180
			flipMode = 2
		case '5':
			angle = -90
			flipMode = 2
		case '6':
			angle = -90
		case '7':
			angle = 90
			flipMode = 2
		case '8':
			angle = 90
		}
		im, _, err := Decode(f, &DecodeOpts{Rotate: angle, Flip: FlipDirection(flipMode)})
		if err != nil {
			t.Fatal(err)
		}
		if !equals(im, straightF) {
			t.Fatalf("%v not properly corrected", name)
		}
	}
}

// TestRescale verifies that rescaling an image, without
// any rotation/flipping, produces the expected image.
func TestRescale(t *testing.T) {
	name := filepath.Join(datadir, "f1.jpg")
	t.Logf("rescaling %s with half-width and half-height", name)
	f, err := os.Open(name)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	rescaledIm, _, err := Decode(f, &DecodeOpts{ScaleWidth: 0.5, ScaleHeight: 0.5})
	if err != nil {
		t.Fatal(err)
	}

	smallIm := smallStraightFImage(t)

	gotB, wantB := rescaledIm.Bounds(), smallIm.Bounds()
	if !gotB.Eq(wantB) {
		t.Errorf("(scale) %v bounds not equal, got %v want %v", name, gotB, wantB)
	}
	if !equals(rescaledIm, smallIm) {
		t.Errorf("(scale) %v pixels not equal", name)
	}

	_, err = f.Seek(0, os.SEEK_SET)
	if err != nil {
		t.Fatal(err)
	}

	rescaledIm, _, err = Decode(f, &DecodeOpts{MaxWidth: 2000, MaxHeight: 40})
	if err != nil {
		t.Fatal(err)
	}
	gotB = rescaledIm.Bounds()
	if !gotB.Eq(wantB) {
		t.Errorf("(max) %v bounds not equal, got %v want %v", name, gotB, wantB)
	}
	if !equals(rescaledIm, smallIm) {
		t.Errorf("(max) %v pixels not equal", name)
	}
}

// TestRescaleEXIF verifies that rescaling an image, followed
// by the automatic EXIF correction (rotation/flipping),
// produces the expected image. All the possible correction
// modes are tested.
func TestRescaleEXIF(t *testing.T) {
	smallStraightF := smallStraightFImage(t)
	samples := sampleNames(t)
	for _, v := range samples {
		if !strings.Contains(v, "exif") {
			continue
		}
		name := filepath.Join(datadir, v)
		t.Logf("rescaling %s with half-width and half-height", name)
		f, err := os.Open(name)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		rescaledIm, _, err := Decode(f, &DecodeOpts{ScaleWidth: 0.5, ScaleHeight: 0.5})
		if err != nil {
			t.Fatal(err)
		}

		gotB, wantB := rescaledIm.Bounds(), smallStraightF.Bounds()
		if !gotB.Eq(wantB) {
			t.Errorf("(scale) %v bounds not equal, got %v want %v", name, gotB, wantB)
		}
		if !equals(rescaledIm, smallStraightF) {
			t.Errorf("(scale) %v pixels not equal", name)
		}

		_, err = f.Seek(0, os.SEEK_SET)
		if err != nil {
			t.Fatal(err)
		}
		rescaledIm, _, err = Decode(f, &DecodeOpts{MaxWidth: 2000, MaxHeight: 40})
		if err != nil {
			t.Fatal(err)
		}

		gotB = rescaledIm.Bounds()
		if !gotB.Eq(wantB) {
			t.Errorf("(max) %v bounds not equal, got %v want %v", name, gotB, wantB)
		}
		if !equals(rescaledIm, smallStraightF) {
			t.Errorf("(max) %v pixels not equal", name)
		}
	}
}

// TestUpscale verifies we don't resize up.
func TestUpscale(t *testing.T) {
	b := new(bytes.Buffer)
	w, h := 64, 48
	if err := jpeg.Encode(b, image.NewNRGBA(image.Rect(0, 0, w, h)), nil); err != nil {
		t.Fatal(err)
	}
	sizes := []struct {
		mw, mh       int
		wantW, wantH int
	}{
		{wantW: w, wantH: h},
		{mw: w, mh: h, wantW: w, wantH: h},
		{mw: w, mh: 2 * h, wantW: w, wantH: h},
		{mw: 2 * w, mh: w, wantW: w, wantH: h},
		{mw: 2 * w, mh: 2 * h, wantW: w, wantH: h},
		{mw: w / 2, mh: h / 2, wantW: w / 2, wantH: h / 2},
		{mw: w / 2, mh: 2 * h, wantW: w / 2, wantH: h / 2},
		{mw: 2 * w, mh: h / 2, wantW: w / 2, wantH: h / 2},
	}
	for i, size := range sizes {
		var opts DecodeOpts
		switch {
		case size.mw != 0 && size.mh != 0:
			opts = DecodeOpts{MaxWidth: size.mw, MaxHeight: size.mh}
		case size.mw != 0:
			opts = DecodeOpts{MaxWidth: size.mw}
		case size.mh != 0:
			opts = DecodeOpts{MaxHeight: size.mh}
		}
		im, _, err := Decode(bytes.NewReader(b.Bytes()), &opts)
		if err != nil {
			t.Error(i, err)
		}
		gotW := im.Bounds().Dx()
		gotH := im.Bounds().Dy()
		if gotW != size.wantW || gotH != size.wantH {
			t.Errorf("%d got %dx%d want %dx%d", i, gotW, gotH, size.wantW, size.wantH)
		}
	}
}

// TODO(mpl): move this test to the goexif lib if/when we contribute
// back the DateTime stuff to upstream.
func TestDateTime(t *testing.T) {
	f, err := os.Open(filepath.Join(datadir, "f1-exif.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	ex, err := exif.Decode(f)
	if err != nil {
		t.Fatal(err)
	}
	got, err := ex.DateTime()
	if err != nil {
		t.Fatal(err)
	}
	exifTimeLayout := "2006:01:02 15:04:05"
	want, err := time.ParseInLocation(exifTimeLayout, "2012:11:04 05:42:02", time.Local)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("Creation times differ; got %v, want: %v\n", got, want)
	}
}

var issue513tests = []image.Rectangle{
	// These test image bounds give a fastjpeg.Factor() result of 1 since
	// they give dim/max == 1, but require rescaling.
	image.Rect(0, 0, 500, 500), // The file, bug.jpeg, in issue 315 is a black 500x500.
	image.Rect(0, 0, 1, 257),
	image.Rect(0, 0, 1, 511),
	image.Rect(0, 0, 2001, 1),
	image.Rect(0, 0, 3999, 1),

	// These test image bounds give either a fastjpeg.Factor() > 1 or
	// do not require rescaling.
	image.Rect(0, 0, 1, 256),
	image.Rect(0, 0, 1, 512),
	image.Rect(0, 0, 2000, 1),
	image.Rect(0, 0, 4000, 1),
}

// Test that decode does not hand off a nil image when using
// fastjpeg, and fastjpeg.Factor() == 1.
// See https://camlistore.org/issue/513
func TestIssue513(t *testing.T) {
	opts := &DecodeOpts{MaxWidth: 2000, MaxHeight: 256}
	for _, rect := range issue513tests {
		buf := &bytes.Buffer{}
		err := jpeg.Encode(buf, image.NewRGBA(rect), nil)
		if err != nil {
			t.Fatalf("Failed to encode test image: %v", err)
		}
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("Unexpected panic for image size %dx%d: %v", rect.Dx(), rect.Dy(), r)
				}
			}()
			_, format, err, needsRescale := decode(buf, opts, false)
			if err != nil {
				t.Errorf("Unexpected error for image size %dx%d: %v", rect.Dx(), rect.Dy(), err)
			}
			if format != "jpeg" {
				t.Errorf("Unexpected format for image size %dx%d: got %q want %q", rect.Dx(), rect.Dy(), format, "jpeg")
			}
			if needsRescale != (rect.Dx() > opts.MaxWidth || rect.Dy() > opts.MaxHeight) {
				t.Errorf("Unexpected rescale for image size %dx%d: needsRescale = %t", rect.Dx(), rect.Dy(), needsRescale)
			}
		}()
	}
}
