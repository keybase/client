package avatars

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"runtime"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/image/draw"
)

func FetchAvatar(ctx context.Context, g *globals.Context, username string) (res io.ReadCloser, err error) {
	avMap, err := g.GetAvatarLoader().LoadUsers(libkb.NewMetaContext(ctx, g.ExternalG()), []string{username}, []keybase1.AvatarFormat{"square_192"})
	if err != nil {
		return
	}
	avatarURL := avMap.Picmap[username]["square_192"].String()

	var avatarReader io.ReadCloser
	parsed, err := url.Parse(avatarURL)
	if err != nil {
		return res, err
	}
	switch parsed.Scheme {
	case "http", "https":
		var avResp *http.Response
		avResp, err = libkb.ProxyHTTPGet(g.GetEnv(), avatarURL)
		if err != nil {
			return res, err
		}
		avatarReader = avResp.Body
	case "file":
		filePath := parsed.Path
		if runtime.GOOS == "windows" && len(filePath) > 0 {
			filePath = filePath[1:]
		}
		avatarReader, err = os.Open(filePath)
		if err != nil {
			return res, err
		}
	}

	return avatarReader, nil
}

func GetBorderedCircleAvatar(ctx context.Context, g *globals.Context, username string, avatarSize, outerBorder, innerBorder int) (res io.ReadCloser, length int64, err error) {
	white := color.RGBA{255, 255, 255, 255}
	blue := color.RGBA{76, 142, 255, 255}
	avatarReader, err := FetchAvatar(ctx, g, username)
	if err != nil {
		return res, length, err
	}
	avatarImg, _, err := image.Decode(avatarReader)
	if err != nil {
		return res, length, err
	}
	scaledAvatar := image.NewRGBA(image.Rect(0, 0, avatarSize, avatarSize))
	draw.BiLinear.Scale(scaledAvatar, scaledAvatar.Bounds(), avatarImg, avatarImg.Bounds(), draw.Over, nil)
	avatarRadius := avatarSize / 2
	borderedRadius := avatarRadius + outerBorder + innerBorder
	resultSize := borderedRadius * 2

	bounds := image.Rect(0, 0, resultSize, resultSize)
	middle := image.Point{borderedRadius, borderedRadius}
	iconRect := image.Rect(middle.X-avatarRadius, middle.Y-avatarRadius, middle.X+avatarRadius, middle.Y+avatarRadius)
	mask := &circleMask{image.Point{avatarRadius, avatarRadius}, avatarRadius}

	result := image.NewRGBA(bounds)

	draw.Draw(result, bounds, &circle{middle, borderedRadius, blue}, image.ZP, draw.Over)
	draw.Draw(result, bounds, &circle{middle, avatarRadius + innerBorder, white}, image.ZP, draw.Over)
	draw.DrawMask(result, iconRect, scaledAvatar, image.ZP, mask, image.ZP, draw.Over)

	var buf bytes.Buffer
	err = png.Encode(&buf, result)
	if err != nil {
		return res, length, err
	}
	return ioutil.NopCloser(bytes.NewReader(buf.Bytes())), int64(buf.Len()), nil
}

type circleMask struct {
	p image.Point
	r int
}

func (c *circleMask) ColorModel() color.Model {
	return color.AlphaModel
}

func (c *circleMask) Bounds() image.Rectangle {
	return image.Rect(c.p.X-c.r, c.p.Y-c.r, c.p.X+c.r, c.p.Y+c.r)
}

func (c *circleMask) At(x, y int) color.Color {
	xx, yy, rr := float64(x-c.p.X)+1, float64(y-c.p.Y)+1, float64(c.r)
	if xx*xx+yy*yy < rr*rr {
		return color.Alpha{255}
	}
	return color.Alpha{0}
}

type circle struct {
	p    image.Point
	r    int
	fill color.Color
}

func (c *circle) ColorModel() color.Model {
	return color.RGBAModel
}

func (c *circle) Bounds() image.Rectangle {
	return image.Rect(c.p.X-c.r, c.p.Y-c.r, c.p.X+c.r, c.p.Y+c.r)
}

func (c *circle) At(x, y int) color.Color {
	xx, yy, rr := float64(x-c.p.X)+1, float64(y-c.p.Y)+1, float64(c.r)
	if xx*xx+yy*yy < rr*rr {
		return c.fill
	}
	return color.RGBA{0, 0, 0, 0}
}
