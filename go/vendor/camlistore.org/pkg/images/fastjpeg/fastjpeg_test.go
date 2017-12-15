/*
Copyright 2014 The Camlistore Authors

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

package fastjpeg

import (
	"bytes"
	"image"
	"image/jpeg"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"sync"
	"testing"
)

const (
	width  = 3840
	height = 1280
)

// testImage hold an image and the encoded jpeg bytes for the image.
type testImage struct {
	im  image.Image
	buf []byte
}

// makeTestImages generates an RGBA and a grayscale image and returns
// testImages containing the JPEG encoded form as bytes and the expected color
// model of the image when decoded.
func makeTestImages() ([]testImage, error) {
	var ims []testImage
	w := bytes.NewBuffer(nil)
	im1 := image.NewRGBA(image.Rect(0, 0, width, height))
	for i := range im1.Pix {
		switch {
		case i%4 == 3:
			im1.Pix[i] = 255
		default:
			im1.Pix[i] = uint8(i)
		}
	}
	if err := jpeg.Encode(w, im1, nil); err != nil {
		return nil, err
	}
	ims = append(ims, testImage{im: im1, buf: w.Bytes()})

	w = bytes.NewBuffer(nil)
	im2 := image.NewGray(image.Rect(0, 0, width, height))
	for i := range im2.Pix {
		im2.Pix[i] = uint8(i)
	}
	if err := jpeg.Encode(w, im2, nil); err != nil {
		return nil, err
	}
	ims = append(ims, testImage{im: im2, buf: w.Bytes()})
	return ims, nil

}

func TestDecodeDownsample(t *testing.T) {
	checkAvailability = sync.Once{}
	if !Available() {
		t.Skip("djpeg isn't available.")
	}

	tis, err := makeTestImages()
	if err != nil {
		t.Fatal(err)
	}

	if _, err := DecodeDownsample(bytes.NewReader(tis[0].buf), 0); err == nil {
		t.Errorf("Expect error for invalid sample factor 0")
	}
	for i, ti := range tis {
		for factor := 1; factor <= 8; factor *= 2 {
			im, err := DecodeDownsample(bytes.NewReader(ti.buf), factor)
			if err != nil {
				t.Errorf("%d: Sample factor %d failed: %v", i, factor, err)
				continue
			}
			wantW := width / factor
			wantH := height / factor
			b := im.Bounds()
			gotW := b.Dx()
			gotH := b.Dy()

			if wantW != gotW || wantH != gotH || reflect.TypeOf(im) != reflect.TypeOf(ti.im) {
				t.Errorf("%d: Sample factor %d want image %dx%d %T got %dx%d %T", i, factor, wantW, wantH, ti.im, gotW, gotH, im)
			}
		}
	}
}

// TestUnavailable verifies the behavior of Available and DecodeDownsample
// when djpeg is not available.
// It sets the environment variable CAMLI_DISABLE_DJPEG and spawns
// a subprocess to simulate unavailability.
func TestUnavailable(t *testing.T) {
	checkAvailability = sync.Once{}
	defer os.Setenv("CAMLI_DISABLE_DJPEG", "0")
	if ok, _ := strconv.ParseBool(os.Getenv("CAMLI_DISABLE_DJPEG")); !ok {
		os.Setenv("CAMLI_DISABLE_DJPEG", "1")
		out, err := exec.Command(os.Args[0], "-test.v",
			"-test.run=TestUnavailable$").CombinedOutput()
		if err != nil {
			t.Fatalf("%v: %s", err, out)
		}
		return
	}

	if Available() {
		t.Fatal("djpeg shouldn't be available when run with CAMLI_DISABLE_DJPEG set.")
	}

	tis, err := makeTestImages()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := DecodeDownsample(bytes.NewReader(tis[0].buf), 2); err != ErrDjpegNotFound {
		t.Errorf("Wanted ErrDjpegNotFound, got %v", err)
	}
}

func TestFailed(t *testing.T) {
	switch runtime.GOOS {
	case "darwin", "freebsd", "linux":
	default:
		t.Skip("test only runs on UNIX")
	}
	checkAvailability = sync.Once{}
	if !Available() {
		t.Skip("djpeg isn't available.")
	}

	oldPath := os.Getenv("PATH")
	defer os.Setenv("PATH", oldPath)
	// Use djpeg that exits after calling false.
	newPath, err := filepath.Abs("testdata")
	if err != nil {
		t.Fatal(err)
	}
	os.Setenv("PATH", newPath)
	t.Log("PATH", os.Getenv("PATH"))
	t.Log(exec.LookPath("djpeg"))

	tis, err := makeTestImages()
	if err != nil {
		t.Fatal(err)
	}
	_, err = DecodeDownsample(bytes.NewReader(tis[0].buf), 2)
	if _, ok := err.(DjpegFailedError); !ok {
		t.Errorf("Got err type %T want ErrDjpegFailed: %v", err, err)
	}
}

func TestFactor(t *testing.T) {
	checkAvailability = sync.Once{}
	if !Available() {
		t.Skip("djpeg isn't available.")
	}

	const (
		width  = 3840
		height = 1280
	)
	testCases := []struct {
		w, h int
		want int
	}{
		{width + 1, height, 1},
		{width, height + 1, 1},
		{width, height, 1},
		{width - 1, height, 1},
		{width, height - 1, 1},
		{width/2 + 1, height / 2, 1},
		{width / 2, height/2 + 1, 1},

		{width / 2, height / 2, 2},
		{width/2 - 1, height / 2, 2},
		{width / 2, height/2 - 1, 2},

		{width / 8, height/8 + 1, 4},
		{width/8 + 1, height / 8, 4},

		{width / 8, height / 8, 8},
		{width / 8, height/8 - 1, 8},
		{width/8 - 1, height / 8, 8},
		{width/8 - 1, height/8 - 1, 8},
	}
	for _, tc := range testCases {
		if got := Factor(width, height, tc.w, tc.h); got != tc.want {
			t.Errorf("%dx%d -> %dx%d got %d want %d", width, height,
				tc.w, tc.h, got, tc.want)
		}
	}
}
