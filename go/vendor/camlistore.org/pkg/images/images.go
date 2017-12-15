/*
Copyright 2012 Google Inc.

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
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	"io"
	"log"
	"os"
	"strconv"
	"time"

	_ "image/gif"
	_ "image/png"

	"camlistore.org/pkg/images/fastjpeg"
	"camlistore.org/pkg/images/resize"

	"github.com/nf/cr2"
	"github.com/rwcarlsen/goexif/exif"

	// TODO(mpl, wathiede): add test(s) to check we can decode both tiff and cr2,
	// so we don't mess up the import order again.
	// See https://camlistore-review.googlesource.com/5196 comments.

	// tiff package must be imported after any image packages that decode
	// tiff-like formats, i.e. CR2 or DNG
	_ "golang.org/x/image/tiff"
)

var disableThumbCache, _ = strconv.ParseBool(os.Getenv("CAMLI_DISABLE_THUMB_CACHE"))

// thumbnailVersion should be incremented whenever we want to
// invalidate the cache of previous thumbnails on the server's
// cache and in browsers.
const thumbnailVersion = "2"

// ThumbnailVersion returns a string safe for URL query components
// which is a generation number. Whenever the thumbnailing code is
// updated, so will this string. It should be placed in some URL
// component (typically "tv").
func ThumbnailVersion() string {
	if disableThumbCache {
		return fmt.Sprintf("nocache%d", time.Now().UnixNano())
	}
	return thumbnailVersion
}

// Exif Orientation Tag values
// http://sylvana.net/jpegcrop/exif_orientation.html
const (
	topLeftSide     = 1
	topRightSide    = 2
	bottomRightSide = 3
	bottomLeftSide  = 4
	leftSideTop     = 5
	rightSideTop    = 6
	rightSideBottom = 7
	leftSideBottom  = 8
)

// The FlipDirection type is used by the Flip option in DecodeOpts
// to indicate in which direction to flip an image.
type FlipDirection int

// FlipVertical and FlipHorizontal are two possible FlipDirections
// values to indicate in which direction an image will be flipped.
const (
	FlipVertical FlipDirection = 1 << iota
	FlipHorizontal
)

type DecodeOpts struct {
	// Rotate specifies how to rotate the image.
	// If nil, the image is rotated automatically based on EXIF metadata.
	// If an int, Rotate is the number of degrees to rotate
	// counter clockwise and must be one of 0, 90, -90, 180, or
	// -180.
	Rotate interface{}

	// Flip specifies how to flip the image.
	// If nil, the image is flipped automatically based on EXIF metadata.
	// Otherwise, Flip is a FlipDirection bitfield indicating how to flip.
	Flip interface{}

	// MaxWidgth and MaxHeight optionally specify bounds on the
	// image's size. Rescaling is done before flipping or rotating.
	// Proportions are conserved, so the smallest of the two is used
	// as the decisive one if needed.
	MaxWidth, MaxHeight int

	// ScaleWidth and ScaleHeight optionally specify how to rescale the
	// image's dimensions. Rescaling is done before flipping or rotating.
	// Proportions are conserved, so the smallest of the two is used
	// as the decisive one if needed.
	// They overrule MaxWidth and MaxHeight.
	ScaleWidth, ScaleHeight float32

	// TODO: consider alternate options if scaled ratio doesn't
	// match original ratio:
	//   Crop    bool
	//   Stretch bool
}

// Config is like the standard library's image.Config as used by DecodeConfig.
type Config struct {
	Width, Height int
	Format        string
	Modified      bool // true if Decode actually rotated or flipped the image.
}

func (c *Config) setBounds(im image.Image) {
	if im != nil {
		c.Width = im.Bounds().Dx()
		c.Height = im.Bounds().Dy()
	}
}

func rotate(im image.Image, angle int) image.Image {
	var rotated *image.NRGBA
	// trigonometric (i.e counter clock-wise)
	switch angle {
	case 90:
		newH, newW := im.Bounds().Dx(), im.Bounds().Dy()
		rotated = image.NewNRGBA(image.Rect(0, 0, newW, newH))
		for y := 0; y < newH; y++ {
			for x := 0; x < newW; x++ {
				rotated.Set(x, y, im.At(newH-1-y, x))
			}
		}
	case -90:
		newH, newW := im.Bounds().Dx(), im.Bounds().Dy()
		rotated = image.NewNRGBA(image.Rect(0, 0, newW, newH))
		for y := 0; y < newH; y++ {
			for x := 0; x < newW; x++ {
				rotated.Set(x, y, im.At(y, newW-1-x))
			}
		}
	case 180, -180:
		newW, newH := im.Bounds().Dx(), im.Bounds().Dy()
		rotated = image.NewNRGBA(image.Rect(0, 0, newW, newH))
		for y := 0; y < newH; y++ {
			for x := 0; x < newW; x++ {
				rotated.Set(x, y, im.At(newW-1-x, newH-1-y))
			}
		}
	default:
		return im
	}
	return rotated
}

// flip returns a flipped version of the image im, according to
// the direction(s) in dir.
// It may flip the input im in place and return it, or it may allocate a
// new NRGBA (if im is an *image.YCbCr).
func flip(im image.Image, dir FlipDirection) image.Image {
	if dir == 0 {
		return im
	}
	ycbcr := false
	var nrgba image.Image
	dx, dy := im.Bounds().Dx(), im.Bounds().Dy()
	di, ok := im.(draw.Image)
	if !ok {
		if _, ok := im.(*image.YCbCr); !ok {
			log.Printf("failed to flip image: input does not satisfy draw.Image")
			return im
		}
		// because YCbCr does not implement Set, we replace it with a new NRGBA
		ycbcr = true
		nrgba = image.NewNRGBA(image.Rect(0, 0, dx, dy))
		di, ok = nrgba.(draw.Image)
		if !ok {
			log.Print("failed to flip image: could not cast an NRGBA to a draw.Image")
			return im
		}
	}
	if dir&FlipHorizontal != 0 {
		for y := 0; y < dy; y++ {
			for x := 0; x < dx/2; x++ {
				old := im.At(x, y)
				di.Set(x, y, im.At(dx-1-x, y))
				di.Set(dx-1-x, y, old)
			}
		}
	}
	if dir&FlipVertical != 0 {
		for y := 0; y < dy/2; y++ {
			for x := 0; x < dx; x++ {
				old := im.At(x, y)
				di.Set(x, y, im.At(x, dy-1-y))
				di.Set(x, dy-1-y, old)
			}
		}
	}
	if ycbcr {
		return nrgba
	}
	return im
}

// ScaledDimensions returns the newWidth and newHeight obtained
// when an image of dimensions w x h has to be rescaled under
// mw x mh, while conserving the proportions.
// It returns 1,1 if any of the parameter is 0.
func ScaledDimensions(w, h, mw, mh int) (newWidth int, newHeight int) {
	if w == 0 || h == 0 || mw == 0 || mh == 0 {
		imageDebug("ScaledDimensions was given as 0; returning 1x1 as dimensions.")
		return 1, 1
	}
	newWidth, newHeight = mw, mh
	if float32(h)/float32(mh) > float32(w)/float32(mw) {
		newWidth = w * mh / h
	} else {
		newHeight = h * mw / w
	}
	return
}

// rescaleDimensions computes the width & height in the pre-rotated
// orientation needed to meet the post-rotation constraints of opts.
// The image bound by b represents the pre-rotated dimensions of the image.
// needRescale is true if the image requires a resize.
func (opts *DecodeOpts) rescaleDimensions(b image.Rectangle, swapDimensions bool) (width, height int, needRescale bool) {
	w, h := b.Dx(), b.Dy()
	mw, mh := opts.MaxWidth, opts.MaxHeight
	mwf, mhf := opts.ScaleWidth, opts.ScaleHeight
	if mw == 0 && mh == 0 && mwf == 0 && mhf == 0 {
		return w, h, false
	}

	// Floating point compares probably only allow this to work if the values
	// were specified as the literal 1 or 1.0, computed values will likely be
	// off.  If Scale{Width,Height} end up being 1.0-epsilon we'll rescale
	// when it probably wouldn't even be noticeable but that's okay.
	if opts.ScaleWidth == 1.0 && opts.ScaleHeight == 1.0 {
		return w, h, false
	}

	if swapDimensions {
		w, h = h, w
	}

	// ScaleWidth and ScaleHeight overrule MaxWidth and MaxHeight
	if mwf > 0.0 && mwf <= 1 {
		mw = int(mwf * float32(w))
	}
	if mhf > 0.0 && mhf <= 1 {
		mh = int(mhf * float32(h))
	}

	neww, newh := ScaledDimensions(w, h, mw, mh)
	if neww > w || newh > h {
		// Don't scale up.
		return w, h, false
	}

	needRescale = neww != w || newh != h
	if swapDimensions {
		return newh, neww, needRescale
	}
	return neww, newh, needRescale
}

// rescale resizes im in-place to the dimensions sw x sh, overwriting the
// existing pixel data.  It is up to the caller to ensure sw & sh maintain the
// aspect ratio of im.
func rescale(im image.Image, sw, sh int) image.Image {
	b := im.Bounds()
	w, h := b.Dx(), b.Dy()
	if sw == w && sh == h {
		return im
	}

	// If it's gigantic, it's more efficient to downsample first
	// and then resize; resizing will smooth out the roughness.
	// (trusting the moustachio guys on that one).
	if w > sw*2 && h > sh*2 {
		im = resize.ResampleInplace(im, b, sw*2, sh*2)
		return resize.HalveInplace(im)
	}
	return resize.Resize(im, b, sw, sh)
}

// forcedRotate checks if the values in opts explicitly set a rotation.
func (opts *DecodeOpts) forcedRotate() bool {
	return opts != nil && opts.Rotate != nil
}

// forcedRotate checks if the values in opts explicitly set a flip.
func (opts *DecodeOpts) forcedFlip() bool {
	return opts != nil && opts.Flip != nil
}

// useEXIF checks if the values in opts imply EXIF data should be used for
// orientation.
func (opts *DecodeOpts) useEXIF() bool {
	return !(opts.forcedRotate() || opts.forcedFlip())
}

// forcedOrientation returns the rotation and flip values stored in opts.  The
// values are asserted to their proper type, and err is non-nil if an invalid
// value is found.  This function ignores the orientation stored in EXIF.
// If auto-correction of the image's orientation is desired, it is the
// caller's responsibility to check via useEXIF first.
func (opts *DecodeOpts) forcedOrientation() (angle int, flipMode FlipDirection, err error) {
	var (
		ok bool
	)
	if opts.forcedRotate() {
		if angle, ok = opts.Rotate.(int); !ok {
			return 0, 0, fmt.Errorf("Rotate should be an int, not a %T", opts.Rotate)
		}
	}
	if opts.forcedFlip() {
		if flipMode, ok = opts.Flip.(FlipDirection); !ok {
			return 0, 0, fmt.Errorf("Flip should be a FlipDirection, not a %T", opts.Flip)
		}
	}
	return angle, flipMode, nil
}

var debug, _ = strconv.ParseBool(os.Getenv("CAMLI_DEBUG_IMAGES"))

func imageDebug(msg string) {
	if debug {
		log.Print(msg)
	}
}

// DecodeConfig returns the image Config similarly to
// the standard library's image.DecodeConfig with the
// addition that it also checks for an EXIF orientation,
// and sets the Width and Height as they would visibly
// be after correcting for that orientation.
func DecodeConfig(r io.Reader) (Config, error) {
	var c Config
	var buf bytes.Buffer
	tr := io.TeeReader(io.LimitReader(r, 2<<20), &buf)
	swapDimensions := false

	ex, err := exif.Decode(tr)
	// trigger a retry when there isn't enough data for reading exif data from a tiff file
	if exif.IsShortReadTagValueError(err) {
		return c, io.ErrUnexpectedEOF
	}
	if err != nil {
		imageDebug(fmt.Sprintf("No valid EXIF, error: %v.", err))
	} else {
		tag, err := ex.Get(exif.Orientation)
		if err != nil {
			imageDebug(`No "Orientation" tag in EXIF.`)
		} else {
			orient, err := tag.Int(0)
			if err == nil {
				switch orient {
				// those are the orientations that require
				// a rotation of ±90
				case leftSideTop, rightSideTop, rightSideBottom, leftSideBottom:
					swapDimensions = true
				}
			} else {
				imageDebug(fmt.Sprintf("EXIF Error: %v", err))
			}
		}
	}
	conf, format, err := image.DecodeConfig(io.MultiReader(&buf, r))
	if err != nil {
		imageDebug(fmt.Sprintf("Image Decoding failed: %v", err))
		return c, err
	}
	c.Format = format
	if swapDimensions {
		c.Width, c.Height = conf.Height, conf.Width
	} else {
		c.Width, c.Height = conf.Width, conf.Height
	}
	return c, err
}

// decoder reads an image from r and modifies the image as defined by opts.
// swapDimensions indicates the decoded image will be rotated after being
// returned, and when interpreting opts, the post-rotation dimensions should
// be considered.
// The decoded image is returned in im. The registered name of the decoder
// used is returned in format. If the image was not successfully decoded, err
// will be non-nil.  If the decoded image was made smaller, needRescale will
// be true.
func decode(r io.Reader, opts *DecodeOpts, swapDimensions bool) (im image.Image, format string, err error, needRescale bool) {
	if opts == nil {
		// Fall-back to normal decode.
		im, format, err = image.Decode(r)
		return im, format, err, false
	}

	var buf bytes.Buffer
	tr := io.TeeReader(r, &buf)
	ic, format, err := image.DecodeConfig(tr)
	if err != nil {
		return nil, "", err, false
	}

	mr := io.MultiReader(&buf, r)
	b := image.Rect(0, 0, ic.Width, ic.Height)
	sw, sh, needRescale := opts.rescaleDimensions(b, swapDimensions)
	if !needRescale {
		im, format, err = image.Decode(mr)
		return im, format, err, false
	}

	imageDebug(fmt.Sprintf("Resizing from %dx%d -> %dx%d", ic.Width, ic.Height, sw, sh))
	if format == "cr2" {
		// Replace mr with an io.Reader to the JPEG thumbnail embedded in a
		// CR2 image.
		if mr, err = cr2.NewReader(mr); err != nil {
			return nil, "", err, false
		}
		format = "jpeg"
	}

	if format == "jpeg" && fastjpeg.Available() {
		factor := fastjpeg.Factor(ic.Width, ic.Height, sw, sh)
		if factor > 1 {
			var buf bytes.Buffer
			tr := io.TeeReader(mr, &buf)
			im, err = fastjpeg.DecodeDownsample(tr, factor)
			switch err.(type) {
			case fastjpeg.DjpegFailedError:
				log.Printf("Retrying with jpeg.Decode, because djpeg failed with: %v", err)
				im, err = jpeg.Decode(io.MultiReader(&buf, mr))
			case nil:
				// fallthrough to rescale() below.
			default:
				return nil, format, err, false
			}
			return rescale(im, sw, sh), format, err, true
		}
	}

	// Fall-back to normal decode.
	im, format, err = image.Decode(mr)
	if err != nil {
		return nil, "", err, false
	}
	return rescale(im, sw, sh), format, err, needRescale
}

// exifOrientation parses the  EXIF data in r and returns the stored
// orientation as the angle and flip necessary to transform the image.
func exifOrientation(r io.Reader) (int, FlipDirection) {
	var (
		angle    int
		flipMode FlipDirection
	)
	ex, err := exif.Decode(r)
	if err != nil {
		imageDebug("No valid EXIF; will not rotate or flip.")
		return 0, 0
	}
	tag, err := ex.Get(exif.Orientation)
	if err != nil {
		imageDebug(`No "Orientation" tag in EXIF; will not rotate or flip.`)
		return 0, 0
	}
	orient, err := tag.Int(0)
	if err != nil {
		imageDebug(fmt.Sprintf("EXIF error: %v", err))
		return 0, 0
	}
	switch orient {
	case topLeftSide:
		// do nothing
	case topRightSide:
		flipMode = 2
	case bottomRightSide:
		angle = 180
	case bottomLeftSide:
		angle = 180
		flipMode = 2
	case leftSideTop:
		angle = -90
		flipMode = 2
	case rightSideTop:
		angle = -90
	case rightSideBottom:
		angle = 90
		flipMode = 2
	case leftSideBottom:
		angle = 90
	}
	return angle, flipMode
}

// Decode decodes an image from r using the provided decoding options.
// The Config returned is similar to the one from the image package,
// with the addition of the Modified field which indicates if the
// image was actually flipped, rotated, or scaled.
// If opts is nil, the defaults are used.
func Decode(r io.Reader, opts *DecodeOpts) (image.Image, Config, error) {
	var (
		angle    int
		buf      bytes.Buffer
		c        Config
		flipMode FlipDirection
	)

	tr := io.TeeReader(io.LimitReader(r, 2<<20), &buf)
	if opts.useEXIF() {
		angle, flipMode = exifOrientation(tr)
	} else {
		var err error
		angle, flipMode, err = opts.forcedOrientation()
		if err != nil {
			return nil, c, err
		}
	}

	// Orientation changing rotations should have their dimensions swapped
	// when scaling.
	var swapDimensions bool
	switch angle {
	case 90, -90:
		swapDimensions = true
	}

	mr := io.MultiReader(&buf, r)
	im, format, err, rescaled := decode(mr, opts, swapDimensions)
	if err != nil {
		return nil, c, err
	}
	c.Modified = rescaled

	if angle != 0 {
		im = rotate(im, angle)
		c.Modified = true
	}

	if flipMode != 0 {
		im = flip(im, flipMode)
		c.Modified = true
	}

	c.Format = format
	c.setBounds(im)
	return im, c, nil
}
