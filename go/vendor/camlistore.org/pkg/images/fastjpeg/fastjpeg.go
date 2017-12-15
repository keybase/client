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

// Package fastjpeg uses djpeg(1), from the Independent JPEG Group's
// (www.ijg.org) jpeg package, to quickly down-sample images on load.  It can
// sample images by a factor of 1, 2, 4 or 8.
// This reduces the amount of data that must be decompressed into memory when
// the full resolution image isn't required, i.e. in the case of generating
// thumbnails.
package fastjpeg

import (
	"bytes"
	"errors"
	"expvar"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	"io"
	"log"
	"os"
	"os/exec"
	"strconv"
	"sync"

	"camlistore.org/pkg/buildinfo"
	"camlistore.org/pkg/types"
)

var (
	ErrDjpegNotFound = errors.New("fastjpeg: djpeg not found in path")
)

// DjpegFailedError wraps errors returned when calling djpeg and handling its
// response.  Used for type asserting and retrying with other jpeg decoders,
// i.e. the standard library's jpeg.Decode.
type DjpegFailedError struct {
	Err error
}

func (dfe DjpegFailedError) Error() string {
	return dfe.Err.Error()
}

// TODO(wathiede): do we need to conditionally add ".exe" on Windows? I have
// no access to test on Windows.
const djpegBin = "djpeg"

var (
	checkAvailability sync.Once
	available         bool
)

var (
	djpegSuccessVar = expvar.NewInt("fastjpeg-djpeg-success")
	djpegFailureVar = expvar.NewInt("fastjpeg-djpeg-failure")
	// Bytes read from djpeg subprocess
	djpegBytesReadVar = expvar.NewInt("fastjpeg-djpeg-bytes-read")
	// Bytes written to djpeg subprocess
	djpegBytesWrittenVar = expvar.NewInt("fastjpeg-djpeg-bytes-written")
)

func Available() bool {
	checkAvailability.Do(func() {
		if ok, _ := strconv.ParseBool(os.Getenv("CAMLI_DISABLE_DJPEG")); ok {
			log.Println("CAMLI_DISABLE_DJPEG set in environment.  Disabling fastjpeg.")
			return
		}

		if p, err := exec.LookPath(djpegBin); p != "" && err == nil {
			available = true
			log.Printf("fastjpeg enabled with %s.", p)
		}
		if !available {
			log.Printf("%s not found in PATH, disabling fastjpeg.", djpegBin)
		}
	})

	return available
}

func init() {
	buildinfo.RegisterDjpegStatusFunc(djpegStatus)
}

func djpegStatus() string {
	// TODO: more info: its path, whether it works, its version, etc.
	if Available() {
		return "djpeg available"
	}
	return "djpeg optimizaton unavailable"
}

func readPNM(buf *bytes.Buffer) (image.Image, error) {
	var imgType, w, h int
	nTokens, err := fmt.Fscanf(buf, "P%d\n%d %d\n255\n", &imgType, &w, &h)
	if err != nil {
		return nil, err
	}
	if nTokens != 3 {
		hdr := buf.Bytes()
		if len(hdr) > 100 {
			hdr = hdr[:100]
		}
		return nil, fmt.Errorf("fastjpeg: Invalid PNM header: %q", hdr)
	}

	switch imgType {
	case 5: // Gray
		src := buf.Bytes()
		if len(src) != w*h {
			return nil, fmt.Errorf("fastjpeg: grayscale source buffer not sized w*h")
		}
		im := &image.Gray{
			Pix:    src,
			Stride: w,
			Rect:   image.Rect(0, 0, w, h),
		}
		return im, nil
	case 6: // RGB
		src := buf.Bytes()
		if len(src) != w*h*3 {
			return nil, fmt.Errorf("fastjpeg: RGB source buffer not sized w*h*3")
		}
		im := image.NewRGBA(image.Rect(0, 0, w, h))
		dst := im.Pix
		for i := 0; i < len(src)/3; i++ {
			dst[4*i+0] = src[3*i+0] // R
			dst[4*i+1] = src[3*i+1] // G
			dst[4*i+2] = src[3*i+2] // B
			dst[4*i+3] = 255        // Alpha
		}
		return im, nil
	default:
		return nil, fmt.Errorf("fastjpeg: Unsupported PNM type P%d", imgType)
	}
}

// Factor returns the sample factor DecodeSample should use to generate a
// sampled image greater than or equal to sw x sh pixels given a source image
// of w x h pixels.
func Factor(w, h, sw, sh int) int {
	switch {
	case w>>3 >= sw && h>>3 >= sh:
		return 8
	case w>>2 >= sw && h>>2 >= sh:
		return 4
	case w>>1 >= sw && h>>1 >= sh:
		return 2
	}
	return 1
}

// DecodeDownsample decodes JPEG data in r, down-sampling it by factor.
// If djpeg is not found, err is ErrDjpegNotFound and r is not read from.
// If the execution of djpeg, or decoding the resulting PNM fails, error will
// be of type DjpegFailedError.
func DecodeDownsample(r io.Reader, factor int) (image.Image, error) {
	if !Available() {
		return nil, ErrDjpegNotFound
	}
	switch factor {
	case 1, 2, 4, 8:
	default:
		return nil, fmt.Errorf("fastjpeg: unsupported sample factor %d", factor)
	}

	buf := new(bytes.Buffer)
	tr := io.TeeReader(r, buf)
	ic, format, err := image.DecodeConfig(tr)
	if err != nil {
		return nil, err
	}
	if format != "jpeg" {
		return nil, fmt.Errorf("fastjpeg: Unsupported format %q", format)
	}
	var bpp int
	switch ic.ColorModel {
	case color.YCbCrModel:
		bpp = 4 // JPEG will decode to RGB, and we'll expand inplace to RGBA.
	case color.GrayModel:
		bpp = 1
	default:
		return nil, fmt.Errorf("fastjpeg: Unsupported thumnbnail color model %T", ic.ColorModel)
	}
	args := []string{djpegBin, "-scale", fmt.Sprintf("1/%d", factor)}
	cmd := exec.Command(args[0], args[1:]...)
	cmd.Stdin = types.NewStatsReader(djpegBytesWrittenVar, io.MultiReader(buf, r))

	// Allocate space for the RGBA / Gray pixel data plus some extra for PNM
	// header info.  Explicitly allocate all the memory upfront to prevent
	// many smaller allocations.
	pixSize := ic.Width*ic.Height*bpp/factor/factor + 128
	w := bytes.NewBuffer(make([]byte, 0, pixSize))
	cmd.Stdout = w

	stderrW := new(bytes.Buffer)
	cmd.Stderr = stderrW
	if err := cmd.Run(); err != nil {
		// cmd.ProcessState == nil happens if /lib/*/ld-x.yz.so is missing, which gives you the ever useful:
		// "fork/exec /usr/bin/djpeg: no such file or directory" error message.
		// So of course it only happens on broken systems and this check is probably overkill.
		if cmd.ProcessState == nil || !cmd.ProcessState.Success() {
			djpegFailureVar.Add(1)
			return nil, DjpegFailedError{Err: fmt.Errorf("%v: %s", err, stderrW)}
		}
		// false alarm, so proceed. See http://camlistore.org/issue/550
	}
	djpegSuccessVar.Add(1)
	djpegBytesReadVar.Add(int64(w.Len()))
	m, err := readPNM(w)
	if err != nil {
		return m, DjpegFailedError{Err: err}
	}
	return m, nil
}
