// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package resize resizes images.
package resize

import (
	"image"
	"image/color"
	"image/draw"

	xdraw "golang.org/x/image/draw"
)

// Resize returns a scaled copy of the image slice r of m.
// The returned image has width w and height h.
func Resize(m image.Image, r image.Rectangle, w, h int) image.Image {
	if w < 0 || h < 0 {
		return nil
	}
	if w == 0 || h == 0 || r.Dx() <= 0 || r.Dy() <= 0 {
		return image.NewRGBA64(image.Rect(0, 0, w, h))
	}
	switch m := m.(type) {
	case *image.RGBA:
		return resizeRGBA(m, r, w, h)
	case *image.YCbCr:
		if m, ok := resizeYCbCr(m, r, w, h); ok {
			return m
		}
	}
	ww, hh := uint64(w), uint64(h)
	dx, dy := uint64(r.Dx()), uint64(r.Dy())
	// The scaling algorithm is to nearest-neighbor magnify the dx * dy source
	// to a (ww*dx) * (hh*dy) intermediate image and then minify the intermediate
	// image back down to a ww * hh destination with a simple box filter.
	// The intermediate image is implied, we do not physically allocate a slice
	// of length ww*dx*hh*dy.
	// For example, consider a 4*3 source image. Label its pixels from a-l:
	//	abcd
	//	efgh
	//	ijkl
	// To resize this to a 3*2 destination image, the intermediate is 12*6.
	// Whitespace has been added to delineate the destination pixels:
	//	aaab bbcc cddd
	//	aaab bbcc cddd
	//	eeef ffgg ghhh
	//
	//	eeef ffgg ghhh
	//	iiij jjkk klll
	//	iiij jjkk klll
	// Thus, the 'b' source pixel contributes one third of its value to the
	// (0, 0) destination pixel and two thirds to (1, 0).
	// The implementation is a two-step process. First, the source pixels are
	// iterated over and each source pixel's contribution to 1 or more
	// destination pixels are summed. Second, the sums are divided by a scaling
	// factor to yield the destination pixels.
	// TODO: By interleaving the two steps, instead of doing all of
	// step 1 first and all of step 2 second, we could allocate a smaller sum
	// slice of length 4*w*2 instead of 4*w*h, although the resultant code
	// would become more complicated.
	n, sum := dx*dy, make([]uint64, 4*w*h)
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			// Get the source pixel.
			r32, g32, b32, a32 := m.At(x, y).RGBA()
			r64 := uint64(r32)
			g64 := uint64(g32)
			b64 := uint64(b32)
			a64 := uint64(a32)
			// Spread the source pixel over 1 or more destination rows.
			py := uint64(y-r.Min.Y) * hh
			for remy := hh; remy > 0; {
				qy := dy - (py % dy)
				if qy > remy {
					qy = remy
				}
				// Spread the source pixel over 1 or more destination columns.
				px := uint64(x-r.Min.X) * ww
				index := 4 * ((py/dy)*ww + (px / dx))
				for remx := ww; remx > 0; {
					qx := dx - (px % dx)
					if qx > remx {
						qx = remx
					}
					sum[index+0] += r64 * qx * qy
					sum[index+1] += g64 * qx * qy
					sum[index+2] += b64 * qx * qy
					sum[index+3] += a64 * qx * qy
					index += 4
					px += qx
					remx -= qx
				}
				py += qy
				remy -= qy
			}
		}
	}
	return average(sum, w, h, n*0x0101)
}

// average convert the sums to averages and returns the result.
func average(sum []uint64, w, h int, n uint64) image.Image {
	ret := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			i := y*ret.Stride + x*4
			j := 4 * (y*w + x)
			ret.Pix[i+0] = uint8(sum[j+0] / n)
			ret.Pix[i+1] = uint8(sum[j+1] / n)
			ret.Pix[i+2] = uint8(sum[j+2] / n)
			ret.Pix[i+3] = uint8(sum[j+3] / n)
		}
	}
	return ret
}

// resizeYCbCr returns a scaled copy of the YCbCr image slice r of m.
// The returned image has width w and height h.
func resizeYCbCr(m *image.YCbCr, r image.Rectangle, w, h int) (image.Image, bool) {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	xdraw.ApproxBiLinear.Scale(dst, dst.Bounds(), m, m.Bounds(), xdraw.Src, nil)
	return dst, true
}

// resizeRGBA returns a scaled copy of the RGBA image slice r of m.
// The returned image has width w and height h.
func resizeRGBA(m *image.RGBA, r image.Rectangle, w, h int) image.Image {
	// TODO(mpl): consider using xdraw here as well ?
	ww, hh := uint64(w), uint64(h)
	dx, dy := uint64(r.Dx()), uint64(r.Dy())
	// See comment in Resize.
	n, sum := dx*dy, make([]uint64, 4*w*h)
	for y := r.Min.Y; y < r.Max.Y; y++ {
		pix := m.Pix[(y-m.Rect.Min.Y)*m.Stride:]
		for x := r.Min.X; x < r.Max.X; x++ {
			// Get the source pixel.
			p := pix[(x-m.Rect.Min.X)*4:]
			r64 := uint64(p[0])
			g64 := uint64(p[1])
			b64 := uint64(p[2])
			a64 := uint64(p[3])
			// Spread the source pixel over 1 or more destination rows.
			py := uint64(y-r.Min.Y) * hh
			for remy := hh; remy > 0; {
				qy := dy - (py % dy)
				if qy > remy {
					qy = remy
				}
				// Spread the source pixel over 1 or more destination columns.
				px := uint64(x-r.Min.X) * ww
				index := 4 * ((py/dy)*ww + (px / dx))
				for remx := ww; remx > 0; {
					qx := dx - (px % dx)
					if qx > remx {
						qx = remx
					}
					qxy := qx * qy
					sum[index+0] += r64 * qxy
					sum[index+1] += g64 * qxy
					sum[index+2] += b64 * qxy
					sum[index+3] += a64 * qxy
					index += 4
					px += qx
					remx -= qx
				}
				py += qy
				remy -= qy
			}
		}
	}
	return average(sum, w, h, n)
}

// HalveInplace downsamples the image by 50% using averaging interpolation.
func HalveInplace(m image.Image) image.Image {
	b := m.Bounds()
	switch m := m.(type) {
	case *image.YCbCr:
		for y := b.Min.Y; y < b.Max.Y/2; y++ {
			for x := b.Min.X; x < b.Max.X/2; x++ {
				y00 := uint32(m.Y[m.YOffset(2*x, 2*y)])
				y10 := uint32(m.Y[m.YOffset(2*x+1, 2*y)])
				y01 := uint32(m.Y[m.YOffset(2*x, 2*y+1)])
				y11 := uint32(m.Y[m.YOffset(2*x+1, 2*y+1)])
				// Add before divide with uint32 or we get errors in the least
				// significant bits.
				m.Y[m.YOffset(x, y)] = uint8((y00 + y10 + y01 + y11) >> 2)

				cb00 := uint32(m.Cb[m.COffset(2*x, 2*y)])
				cb10 := uint32(m.Cb[m.COffset(2*x+1, 2*y)])
				cb01 := uint32(m.Cb[m.COffset(2*x, 2*y+1)])
				cb11 := uint32(m.Cb[m.COffset(2*x+1, 2*y+1)])
				m.Cb[m.COffset(x, y)] = uint8((cb00 + cb10 + cb01 + cb11) >> 2)

				cr00 := uint32(m.Cr[m.COffset(2*x, 2*y)])
				cr10 := uint32(m.Cr[m.COffset(2*x+1, 2*y)])
				cr01 := uint32(m.Cr[m.COffset(2*x, 2*y+1)])
				cr11 := uint32(m.Cr[m.COffset(2*x+1, 2*y+1)])
				m.Cr[m.COffset(x, y)] = uint8((cr00 + cr10 + cr01 + cr11) >> 2)
			}
		}
		b.Max = b.Min.Add(b.Size().Div(2))
		return subImage(m, b)
	case draw.Image:
		for y := b.Min.Y; y < b.Max.Y/2; y++ {
			for x := b.Min.X; x < b.Max.X/2; x++ {
				r00, g00, b00, a00 := m.At(2*x, 2*y).RGBA()
				r10, g10, b10, a10 := m.At(2*x+1, 2*y).RGBA()
				r01, g01, b01, a01 := m.At(2*x, 2*y+1).RGBA()
				r11, g11, b11, a11 := m.At(2*x+1, 2*y+1).RGBA()

				// Add before divide with uint32 or we get errors in the least
				// significant bits.
				r := (r00 + r10 + r01 + r11) >> 2
				g := (g00 + g10 + g01 + g11) >> 2
				b := (b00 + b10 + b01 + b11) >> 2
				a := (a00 + a10 + a01 + a11) >> 2

				m.Set(x, y, color.RGBA{
					R: uint8(r >> 8),
					G: uint8(g >> 8),
					B: uint8(b >> 8),
					A: uint8(a >> 8),
				})
			}
		}
		b.Max = b.Min.Add(b.Size().Div(2))
		return subImage(m, b)
	default:
		// TODO(wathiede): fallback to generic Resample somehow?
		panic("Unhandled image type")
	}
}

// ResampleInplace will resample m inplace, overwritting existing pixel data,
// and return a subimage of m sized to w and h.
func ResampleInplace(m image.Image, r image.Rectangle, w, h int) image.Image {
	// We don't support scaling up.
	if r.Dx() < w || r.Dy() < h {
		return m
	}

	switch m := m.(type) {
	case *image.YCbCr:
		xStep := float64(r.Dx()) / float64(w)
		yStep := float64(r.Dy()) / float64(h)
		for y := r.Min.Y; y < r.Min.Y+h; y++ {
			for x := r.Min.X; x < r.Min.X+w; x++ {
				xSrc := int(float64(x) * xStep)
				ySrc := int(float64(y) * yStep)
				cSrc := m.COffset(xSrc, ySrc)
				cDst := m.COffset(x, y)
				m.Y[m.YOffset(x, y)] = m.Y[m.YOffset(xSrc, ySrc)]
				m.Cb[cDst] = m.Cb[cSrc]
				m.Cr[cDst] = m.Cr[cSrc]
			}
		}
	case draw.Image:
		xStep := float64(r.Dx()) / float64(w)
		yStep := float64(r.Dy()) / float64(h)
		for y := r.Min.Y; y < r.Min.Y+h; y++ {
			for x := r.Min.X; x < r.Min.X+w; x++ {
				xSrc := int(float64(x) * xStep)
				ySrc := int(float64(y) * yStep)
				r, g, b, a := m.At(xSrc, ySrc).RGBA()
				m.Set(x, y, color.RGBA{
					R: uint8(r >> 8),
					G: uint8(g >> 8),
					B: uint8(b >> 8),
					A: uint8(a >> 8),
				})
			}
		}
	default:
		// TODO fallback to generic Resample somehow?
		panic("Unhandled image type")
	}
	r.Max.X = r.Min.X + w
	r.Max.Y = r.Min.Y + h
	return subImage(m, r)
}

func subImage(m image.Image, r image.Rectangle) image.Image {
	type subImager interface {
		SubImage(image.Rectangle) image.Image
	}
	if si, ok := m.(subImager); ok {
		return si.SubImage(r)
	}
	panic("Image type doesn't support SubImage")
}

// Resample returns a resampled copy of the image slice r of m.
// The returned image has width w and height h.
func Resample(m image.Image, r image.Rectangle, w, h int) image.Image {
	if w < 0 || h < 0 {
		return nil
	}
	if w == 0 || h == 0 || r.Dx() <= 0 || r.Dy() <= 0 {
		return image.NewRGBA64(image.Rect(0, 0, w, h))
	}
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	xStep := float64(r.Dx()) / float64(w)
	yStep := float64(r.Dy()) / float64(h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			xSrc := int(float64(r.Min.X) + float64(x)*xStep)
			ySrc := int(float64(r.Min.Y) + float64(y)*yStep)
			r, g, b, a := m.At(xSrc, ySrc).RGBA()
			img.SetRGBA(x, y, color.RGBA{
				R: uint8(r >> 8),
				G: uint8(g >> 8),
				B: uint8(b >> 8),
				A: uint8(a >> 8),
			})
		}
	}
	return img
}
