package avatars

import (
	"bytes"
	"context"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/url"
	"os"
	"runtime"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/image/draw"
)

var AllFormats = []keybase1.AvatarFormat{
	"square_192",
	"square_256",
	"square_960",
	"square_360",
	"square_200",
	"square_40",
}

const avatarPlaceholder = "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAAAAAB3tzPbAAADwElEQVR4Ae3bB5ayWBDF8dn/mi6CqNgNnYzntYFGMAs8ljAnT57PUFQ9z6n/Dn4djHV/a548BZCkAAUoQAEKUIACFKAABShAAQpQgAIUoAAFKEABClCAAhSgAAUoQAEKOG2+R+/xcDAYxu+j783pqQB7k/j4W35i9s8BOEy7+I+604PrALuK8L9FK+swoF6E+GXhonYVkHZxVd3UScAxxtXFR/cAxsMNecYxQJXgxpLKJcA+xM2Fe3cAuY878nNXAKmHu/JSNwBr3N3aBcDGw915G3nAroMH6uykAecADxWchQEveLAXWcAUDzeVBBQgqJAD2AEIGlgxgAFJRgpw7oCkzlkIMAZRYxlA2QFRnVIEMANZMwlA7YMsvxYApCAsFQDEICzmB1xA2oUdsARpS3bAB0j7YAcEIC3gBhxA3IEZsAJxK2bADMTNmAFvIO6NGdAHcX1mgA/ifGYAyOMFVCCvYgVcQN6FFXACeSdWQAnySlaABXmWFdB4IM5reAEBiAuYAUMQN2QGfIG4L2aAAXGGGZCBuIwZUIG4ihnQRCAtargBE5A2YQfkIC1nB9gAhAWWHdBM6P+CeAF7ELYXADQR/esIXkAKsn5EAE2f/iMVXsAaRK1JAfz/BVEjBdiDpL0YoBmBoFEjByhDPFxYCgKanYcH83ayF1sGD2akj/7e8VDvjTSgfsUDvdbigKYc4O4GpQuXu5c+7qx/ceN2uhriroaVK9frdYI7Smp39gN2ipubWqcmKHmAmwpy1zY05wQ3lJwdnGFlPVxZL3NzR1bPA1xRMK+dnSJW5peEwFROj0Hr1Sv+p9dV7f4c92xePPxL3os5P8sgus5nSQ9/qpfM8vrZJun2UGTpcplmxcHqpl4BCng2QHna5lmarpbLVZpm+fZUPgfAnjbf4zjqevhHXjeKx9+bk3UVUBXmo4cr6n2YonIMUP6M+rip/uindAWQz+59TzzL5QHFKMADBaNCEnCcdPFw3clRBmDTGETFqWUHVKYLwrqmYgXUhv7kzNRsAGsCtFBgLA+g6KOl+gUD4PKJFvu8tA3IfLSan7UKsBO03sS2BzhHYCg6twU4hGApPLQD2AVgKti1Acg7YKuT0wMOPhjzD9SASwjWwgstwA7B3NCSAmZgb0YJ2Htgz9sTAiIIFNEBUoj0QwaIIFJEBSggVEEEGEGoEREghFAhDeAIsY4kgCXEWpIA5hBrTgIYQawRCeAdYr2TABKIlShAAf+WAhSgAAUoQAEKUIACFKAABShAAQpQgAIUoIDfAUJ3U+9hO4+uAAAAAElFTkSuQmCC"

func getAvatarPlaceholder() io.ReadCloser {
	dat, _ := base64.StdEncoding.DecodeString(avatarPlaceholder)
	return io.NopCloser(bytes.NewBuffer(dat))
}

func FetchAvatar(ctx context.Context, g *globals.Context, username string) (res io.ReadCloser, err error) {
	avMap, err := g.GetAvatarLoader().LoadUsers(libkb.NewMetaContext(ctx, g.ExternalG()), []string{username}, []keybase1.AvatarFormat{"square_192"})
	if err != nil {
		return res, err
	}
	avatarURL := avMap.Picmap[username]["square_192"].String()
	if len(avatarURL) == 0 {
		return getAvatarPlaceholder(), nil
	}

	var avatarReader io.ReadCloser
	parsed, err := url.Parse(avatarURL)
	if err != nil {
		return res, err
	}
	switch parsed.Scheme {
	case "http", "https":
		resp, err := libkb.ProxyHTTPGet(g.ExternalG(), g.GetEnv(), avatarURL, "FetchAvatar")
		if err != nil {
			return res, err
		}
		if resp.StatusCode >= 400 {
			avatarReader = getAvatarPlaceholder()
		} else {
			avatarReader = resp.Body
		}
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
	defer avatarReader.Close()
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

	draw.Draw(result, bounds, &circle{middle, borderedRadius, blue}, image.Point{}, draw.Over)
	draw.Draw(result, bounds, &circle{middle, avatarRadius + innerBorder, white}, image.Point{}, draw.Over)
	draw.DrawMask(result, iconRect, scaledAvatar, image.Point{}, mask, image.Point{}, draw.Over)

	var buf bytes.Buffer
	err = png.Encode(&buf, result)
	if err != nil {
		return res, length, err
	}
	return io.NopCloser(bytes.NewReader(buf.Bytes())), int64(buf.Len()), nil
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
