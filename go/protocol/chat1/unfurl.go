// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/unfurl.avdl

package chat1

import (
	"errors"
	"fmt"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type UnfurlType int

const (
	UnfurlType_GENERIC UnfurlType = 0
	UnfurlType_YOUTUBE UnfurlType = 1
	UnfurlType_GIPHY   UnfurlType = 2
	UnfurlType_MAPS    UnfurlType = 3
)

func (o UnfurlType) DeepCopy() UnfurlType { return o }

var UnfurlTypeMap = map[string]UnfurlType{
	"GENERIC": 0,
	"YOUTUBE": 1,
	"GIPHY":   2,
	"MAPS":    3,
}

var UnfurlTypeRevMap = map[UnfurlType]string{
	0: "GENERIC",
	1: "YOUTUBE",
	2: "GIPHY",
	3: "MAPS",
}

func (e UnfurlType) String() string {
	if v, ok := UnfurlTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UnfurlVideo struct {
	Url      string `codec:"url" json:"url"`
	MimeType string `codec:"mimeType" json:"mimeType"`
	Height   int    `codec:"height" json:"height"`
	Width    int    `codec:"width" json:"width"`
}

func (o UnfurlVideo) DeepCopy() UnfurlVideo {
	return UnfurlVideo{
		Url:      o.Url,
		MimeType: o.MimeType,
		Height:   o.Height,
		Width:    o.Width,
	}
}

type UnfurlGenericRaw struct {
	Title       string       `codec:"title" json:"title"`
	Url         string       `codec:"url" json:"url"`
	SiteName    string       `codec:"siteName" json:"siteName"`
	FaviconUrl  *string      `codec:"faviconUrl,omitempty" json:"faviconUrl,omitempty"`
	ImageUrl    *string      `codec:"imageUrl,omitempty" json:"imageUrl,omitempty"`
	Video       *UnfurlVideo `codec:"video,omitempty" json:"video,omitempty"`
	PublishTime *int         `codec:"publishTime,omitempty" json:"publishTime,omitempty"`
	Description *string      `codec:"description,omitempty" json:"description,omitempty"`
}

func (o UnfurlGenericRaw) DeepCopy() UnfurlGenericRaw {
	return UnfurlGenericRaw{
		Title:    o.Title,
		Url:      o.Url,
		SiteName: o.SiteName,
		FaviconUrl: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.FaviconUrl),
		ImageUrl: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ImageUrl),
		Video: (func(x *UnfurlVideo) *UnfurlVideo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Video),
		PublishTime: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.PublishTime),
		Description: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Description),
	}
}

type UnfurlYoutubeRaw struct {
}

func (o UnfurlYoutubeRaw) DeepCopy() UnfurlYoutubeRaw {
	return UnfurlYoutubeRaw{}
}

type UnfurlGiphyRaw struct {
	ImageUrl   *string      `codec:"imageUrl,omitempty" json:"imageUrl,omitempty"`
	Video      *UnfurlVideo `codec:"video,omitempty" json:"video,omitempty"`
	FaviconUrl *string      `codec:"faviconUrl,omitempty" json:"faviconUrl,omitempty"`
}

func (o UnfurlGiphyRaw) DeepCopy() UnfurlGiphyRaw {
	return UnfurlGiphyRaw{
		ImageUrl: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ImageUrl),
		Video: (func(x *UnfurlVideo) *UnfurlVideo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Video),
		FaviconUrl: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.FaviconUrl),
	}
}

type UnfurlMapsRaw struct {
	Title               string        `codec:"title" json:"title"`
	Url                 string        `codec:"url" json:"url"`
	SiteName            string        `codec:"siteName" json:"siteName"`
	ImageUrl            string        `codec:"imageUrl" json:"imageUrl"`
	HistoryImageUrl     *string       `codec:"historyImageUrl,omitempty" json:"historyImageUrl,omitempty"`
	Description         string        `codec:"description" json:"description"`
	Coord               Coordinate    `codec:"coord" json:"coord"`
	Time                gregor1.Time  `codec:"time" json:"time"`
	LiveLocationEndTime *gregor1.Time `codec:"liveLocationEndTime,omitempty" json:"liveLocationEndTime,omitempty"`
	LiveLocationDone    bool          `codec:"liveLocationDone" json:"liveLocationDone"`
}

func (o UnfurlMapsRaw) DeepCopy() UnfurlMapsRaw {
	return UnfurlMapsRaw{
		Title:    o.Title,
		Url:      o.Url,
		SiteName: o.SiteName,
		ImageUrl: o.ImageUrl,
		HistoryImageUrl: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.HistoryImageUrl),
		Description: o.Description,
		Coord:       o.Coord.DeepCopy(),
		Time:        o.Time.DeepCopy(),
		LiveLocationEndTime: (func(x *gregor1.Time) *gregor1.Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.LiveLocationEndTime),
		LiveLocationDone: o.LiveLocationDone,
	}
}

type UnfurlRaw struct {
	UnfurlType__ UnfurlType        `codec:"unfurlType" json:"unfurlType"`
	Generic__    *UnfurlGenericRaw `codec:"generic,omitempty" json:"generic,omitempty"`
	Youtube__    *UnfurlYoutubeRaw `codec:"youtube,omitempty" json:"youtube,omitempty"`
	Giphy__      *UnfurlGiphyRaw   `codec:"giphy,omitempty" json:"giphy,omitempty"`
	Maps__       *UnfurlMapsRaw    `codec:"maps,omitempty" json:"maps,omitempty"`
}

func (o *UnfurlRaw) UnfurlType() (ret UnfurlType, err error) {
	switch o.UnfurlType__ {
	case UnfurlType_GENERIC:
		if o.Generic__ == nil {
			err = errors.New("unexpected nil value for Generic__")
			return ret, err
		}
	case UnfurlType_YOUTUBE:
		if o.Youtube__ == nil {
			err = errors.New("unexpected nil value for Youtube__")
			return ret, err
		}
	case UnfurlType_GIPHY:
		if o.Giphy__ == nil {
			err = errors.New("unexpected nil value for Giphy__")
			return ret, err
		}
	case UnfurlType_MAPS:
		if o.Maps__ == nil {
			err = errors.New("unexpected nil value for Maps__")
			return ret, err
		}
	}
	return o.UnfurlType__, nil
}

func (o UnfurlRaw) Generic() (res UnfurlGenericRaw) {
	if o.UnfurlType__ != UnfurlType_GENERIC {
		panic("wrong case accessed")
	}
	if o.Generic__ == nil {
		return
	}
	return *o.Generic__
}

func (o UnfurlRaw) Youtube() (res UnfurlYoutubeRaw) {
	if o.UnfurlType__ != UnfurlType_YOUTUBE {
		panic("wrong case accessed")
	}
	if o.Youtube__ == nil {
		return
	}
	return *o.Youtube__
}

func (o UnfurlRaw) Giphy() (res UnfurlGiphyRaw) {
	if o.UnfurlType__ != UnfurlType_GIPHY {
		panic("wrong case accessed")
	}
	if o.Giphy__ == nil {
		return
	}
	return *o.Giphy__
}

func (o UnfurlRaw) Maps() (res UnfurlMapsRaw) {
	if o.UnfurlType__ != UnfurlType_MAPS {
		panic("wrong case accessed")
	}
	if o.Maps__ == nil {
		return
	}
	return *o.Maps__
}

func NewUnfurlRawWithGeneric(v UnfurlGenericRaw) UnfurlRaw {
	return UnfurlRaw{
		UnfurlType__: UnfurlType_GENERIC,
		Generic__:    &v,
	}
}

func NewUnfurlRawWithYoutube(v UnfurlYoutubeRaw) UnfurlRaw {
	return UnfurlRaw{
		UnfurlType__: UnfurlType_YOUTUBE,
		Youtube__:    &v,
	}
}

func NewUnfurlRawWithGiphy(v UnfurlGiphyRaw) UnfurlRaw {
	return UnfurlRaw{
		UnfurlType__: UnfurlType_GIPHY,
		Giphy__:      &v,
	}
}

func NewUnfurlRawWithMaps(v UnfurlMapsRaw) UnfurlRaw {
	return UnfurlRaw{
		UnfurlType__: UnfurlType_MAPS,
		Maps__:       &v,
	}
}

func (o UnfurlRaw) DeepCopy() UnfurlRaw {
	return UnfurlRaw{
		UnfurlType__: o.UnfurlType__.DeepCopy(),
		Generic__: (func(x *UnfurlGenericRaw) *UnfurlGenericRaw {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Generic__),
		Youtube__: (func(x *UnfurlYoutubeRaw) *UnfurlYoutubeRaw {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Youtube__),
		Giphy__: (func(x *UnfurlGiphyRaw) *UnfurlGiphyRaw {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Giphy__),
		Maps__: (func(x *UnfurlMapsRaw) *UnfurlMapsRaw {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Maps__),
	}
}

type UnfurlGenericMapInfo struct {
	Coord               Coordinate    `codec:"coord" json:"coord"`
	Time                gregor1.Time  `codec:"time" json:"time"`
	LiveLocationEndTime *gregor1.Time `codec:"liveLocationEndTime,omitempty" json:"liveLocationEndTime,omitempty"`
	IsLiveLocationDone  bool          `codec:"isLiveLocationDone" json:"isLiveLocationDone"`
}

func (o UnfurlGenericMapInfo) DeepCopy() UnfurlGenericMapInfo {
	return UnfurlGenericMapInfo{
		Coord: o.Coord.DeepCopy(),
		Time:  o.Time.DeepCopy(),
		LiveLocationEndTime: (func(x *gregor1.Time) *gregor1.Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.LiveLocationEndTime),
		IsLiveLocationDone: o.IsLiveLocationDone,
	}
}

type UnfurlGeneric struct {
	Title       string                `codec:"title" json:"title"`
	Url         string                `codec:"url" json:"url"`
	SiteName    string                `codec:"siteName" json:"siteName"`
	Favicon     *Asset                `codec:"favicon,omitempty" json:"favicon,omitempty"`
	Image       *Asset                `codec:"image,omitempty" json:"image,omitempty"`
	PublishTime *int                  `codec:"publishTime,omitempty" json:"publishTime,omitempty"`
	Description *string               `codec:"description,omitempty" json:"description,omitempty"`
	MapInfo     *UnfurlGenericMapInfo `codec:"mapInfo,omitempty" json:"mapInfo,omitempty"`
}

func (o UnfurlGeneric) DeepCopy() UnfurlGeneric {
	return UnfurlGeneric{
		Title:    o.Title,
		Url:      o.Url,
		SiteName: o.SiteName,
		Favicon: (func(x *Asset) *Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Favicon),
		Image: (func(x *Asset) *Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Image),
		PublishTime: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.PublishTime),
		Description: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Description),
		MapInfo: (func(x *UnfurlGenericMapInfo) *UnfurlGenericMapInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MapInfo),
	}
}

type UnfurlYoutube struct {
}

func (o UnfurlYoutube) DeepCopy() UnfurlYoutube {
	return UnfurlYoutube{}
}

type UnfurlGiphy struct {
	Favicon *Asset `codec:"favicon,omitempty" json:"favicon,omitempty"`
	Image   *Asset `codec:"image,omitempty" json:"image,omitempty"`
	Video   *Asset `codec:"video,omitempty" json:"video,omitempty"`
}

func (o UnfurlGiphy) DeepCopy() UnfurlGiphy {
	return UnfurlGiphy{
		Favicon: (func(x *Asset) *Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Favicon),
		Image: (func(x *Asset) *Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Image),
		Video: (func(x *Asset) *Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Video),
	}
}

type Unfurl struct {
	UnfurlType__ UnfurlType     `codec:"unfurlType" json:"unfurlType"`
	Generic__    *UnfurlGeneric `codec:"generic,omitempty" json:"generic,omitempty"`
	Youtube__    *UnfurlYoutube `codec:"youtube,omitempty" json:"youtube,omitempty"`
	Giphy__      *UnfurlGiphy   `codec:"giphy,omitempty" json:"giphy,omitempty"`
}

func (o *Unfurl) UnfurlType() (ret UnfurlType, err error) {
	switch o.UnfurlType__ {
	case UnfurlType_GENERIC:
		if o.Generic__ == nil {
			err = errors.New("unexpected nil value for Generic__")
			return ret, err
		}
	case UnfurlType_YOUTUBE:
		if o.Youtube__ == nil {
			err = errors.New("unexpected nil value for Youtube__")
			return ret, err
		}
	case UnfurlType_GIPHY:
		if o.Giphy__ == nil {
			err = errors.New("unexpected nil value for Giphy__")
			return ret, err
		}
	}
	return o.UnfurlType__, nil
}

func (o Unfurl) Generic() (res UnfurlGeneric) {
	if o.UnfurlType__ != UnfurlType_GENERIC {
		panic("wrong case accessed")
	}
	if o.Generic__ == nil {
		return
	}
	return *o.Generic__
}

func (o Unfurl) Youtube() (res UnfurlYoutube) {
	if o.UnfurlType__ != UnfurlType_YOUTUBE {
		panic("wrong case accessed")
	}
	if o.Youtube__ == nil {
		return
	}
	return *o.Youtube__
}

func (o Unfurl) Giphy() (res UnfurlGiphy) {
	if o.UnfurlType__ != UnfurlType_GIPHY {
		panic("wrong case accessed")
	}
	if o.Giphy__ == nil {
		return
	}
	return *o.Giphy__
}

func NewUnfurlWithGeneric(v UnfurlGeneric) Unfurl {
	return Unfurl{
		UnfurlType__: UnfurlType_GENERIC,
		Generic__:    &v,
	}
}

func NewUnfurlWithYoutube(v UnfurlYoutube) Unfurl {
	return Unfurl{
		UnfurlType__: UnfurlType_YOUTUBE,
		Youtube__:    &v,
	}
}

func NewUnfurlWithGiphy(v UnfurlGiphy) Unfurl {
	return Unfurl{
		UnfurlType__: UnfurlType_GIPHY,
		Giphy__:      &v,
	}
}

func (o Unfurl) DeepCopy() Unfurl {
	return Unfurl{
		UnfurlType__: o.UnfurlType__.DeepCopy(),
		Generic__: (func(x *UnfurlGeneric) *UnfurlGeneric {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Generic__),
		Youtube__: (func(x *UnfurlYoutube) *UnfurlYoutube {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Youtube__),
		Giphy__: (func(x *UnfurlGiphy) *UnfurlGiphy {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Giphy__),
	}
}

type UnfurlResult struct {
	Unfurl Unfurl `codec:"unfurl" json:"unfurl"`
	Url    string `codec:"url" json:"url"`
}

func (o UnfurlResult) DeepCopy() UnfurlResult {
	return UnfurlResult{
		Unfurl: o.Unfurl.DeepCopy(),
		Url:    o.Url,
	}
}

type UnfurlImageDisplay struct {
	Url     string `codec:"url" json:"url"`
	Height  int    `codec:"height" json:"height"`
	Width   int    `codec:"width" json:"width"`
	IsVideo bool   `codec:"isVideo" json:"isVideo"`
}

func (o UnfurlImageDisplay) DeepCopy() UnfurlImageDisplay {
	return UnfurlImageDisplay{
		Url:     o.Url,
		Height:  o.Height,
		Width:   o.Width,
		IsVideo: o.IsVideo,
	}
}

type UnfurlGenericDisplay struct {
	Title       string                `codec:"title" json:"title"`
	Url         string                `codec:"url" json:"url"`
	SiteName    string                `codec:"siteName" json:"siteName"`
	Favicon     *UnfurlImageDisplay   `codec:"favicon,omitempty" json:"favicon,omitempty"`
	Media       *UnfurlImageDisplay   `codec:"media,omitempty" json:"media,omitempty"`
	PublishTime *int                  `codec:"publishTime,omitempty" json:"publishTime,omitempty"`
	Description *string               `codec:"description,omitempty" json:"description,omitempty"`
	MapInfo     *UnfurlGenericMapInfo `codec:"mapInfo,omitempty" json:"mapInfo,omitempty"`
}

func (o UnfurlGenericDisplay) DeepCopy() UnfurlGenericDisplay {
	return UnfurlGenericDisplay{
		Title:    o.Title,
		Url:      o.Url,
		SiteName: o.SiteName,
		Favicon: (func(x *UnfurlImageDisplay) *UnfurlImageDisplay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Favicon),
		Media: (func(x *UnfurlImageDisplay) *UnfurlImageDisplay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Media),
		PublishTime: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.PublishTime),
		Description: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Description),
		MapInfo: (func(x *UnfurlGenericMapInfo) *UnfurlGenericMapInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MapInfo),
	}
}

type UnfurlYoutubeDisplay struct {
}

func (o UnfurlYoutubeDisplay) DeepCopy() UnfurlYoutubeDisplay {
	return UnfurlYoutubeDisplay{}
}

type UnfurlGiphyDisplay struct {
	Favicon *UnfurlImageDisplay `codec:"favicon,omitempty" json:"favicon,omitempty"`
	Image   *UnfurlImageDisplay `codec:"image,omitempty" json:"image,omitempty"`
	Video   *UnfurlImageDisplay `codec:"video,omitempty" json:"video,omitempty"`
}

func (o UnfurlGiphyDisplay) DeepCopy() UnfurlGiphyDisplay {
	return UnfurlGiphyDisplay{
		Favicon: (func(x *UnfurlImageDisplay) *UnfurlImageDisplay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Favicon),
		Image: (func(x *UnfurlImageDisplay) *UnfurlImageDisplay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Image),
		Video: (func(x *UnfurlImageDisplay) *UnfurlImageDisplay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Video),
	}
}

type UnfurlDisplay struct {
	UnfurlType__ UnfurlType            `codec:"unfurlType" json:"unfurlType"`
	Generic__    *UnfurlGenericDisplay `codec:"generic,omitempty" json:"generic,omitempty"`
	Youtube__    *UnfurlYoutubeDisplay `codec:"youtube,omitempty" json:"youtube,omitempty"`
	Giphy__      *UnfurlGiphyDisplay   `codec:"giphy,omitempty" json:"giphy,omitempty"`
}

func (o *UnfurlDisplay) UnfurlType() (ret UnfurlType, err error) {
	switch o.UnfurlType__ {
	case UnfurlType_GENERIC:
		if o.Generic__ == nil {
			err = errors.New("unexpected nil value for Generic__")
			return ret, err
		}
	case UnfurlType_YOUTUBE:
		if o.Youtube__ == nil {
			err = errors.New("unexpected nil value for Youtube__")
			return ret, err
		}
	case UnfurlType_GIPHY:
		if o.Giphy__ == nil {
			err = errors.New("unexpected nil value for Giphy__")
			return ret, err
		}
	}
	return o.UnfurlType__, nil
}

func (o UnfurlDisplay) Generic() (res UnfurlGenericDisplay) {
	if o.UnfurlType__ != UnfurlType_GENERIC {
		panic("wrong case accessed")
	}
	if o.Generic__ == nil {
		return
	}
	return *o.Generic__
}

func (o UnfurlDisplay) Youtube() (res UnfurlYoutubeDisplay) {
	if o.UnfurlType__ != UnfurlType_YOUTUBE {
		panic("wrong case accessed")
	}
	if o.Youtube__ == nil {
		return
	}
	return *o.Youtube__
}

func (o UnfurlDisplay) Giphy() (res UnfurlGiphyDisplay) {
	if o.UnfurlType__ != UnfurlType_GIPHY {
		panic("wrong case accessed")
	}
	if o.Giphy__ == nil {
		return
	}
	return *o.Giphy__
}

func NewUnfurlDisplayWithGeneric(v UnfurlGenericDisplay) UnfurlDisplay {
	return UnfurlDisplay{
		UnfurlType__: UnfurlType_GENERIC,
		Generic__:    &v,
	}
}

func NewUnfurlDisplayWithYoutube(v UnfurlYoutubeDisplay) UnfurlDisplay {
	return UnfurlDisplay{
		UnfurlType__: UnfurlType_YOUTUBE,
		Youtube__:    &v,
	}
}

func NewUnfurlDisplayWithGiphy(v UnfurlGiphyDisplay) UnfurlDisplay {
	return UnfurlDisplay{
		UnfurlType__: UnfurlType_GIPHY,
		Giphy__:      &v,
	}
}

func (o UnfurlDisplay) DeepCopy() UnfurlDisplay {
	return UnfurlDisplay{
		UnfurlType__: o.UnfurlType__.DeepCopy(),
		Generic__: (func(x *UnfurlGenericDisplay) *UnfurlGenericDisplay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Generic__),
		Youtube__: (func(x *UnfurlYoutubeDisplay) *UnfurlYoutubeDisplay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Youtube__),
		Giphy__: (func(x *UnfurlGiphyDisplay) *UnfurlGiphyDisplay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Giphy__),
	}
}

type UnfurlMode int

const (
	UnfurlMode_ALWAYS      UnfurlMode = 0
	UnfurlMode_NEVER       UnfurlMode = 1
	UnfurlMode_WHITELISTED UnfurlMode = 2
)

func (o UnfurlMode) DeepCopy() UnfurlMode { return o }

var UnfurlModeMap = map[string]UnfurlMode{
	"ALWAYS":      0,
	"NEVER":       1,
	"WHITELISTED": 2,
}

var UnfurlModeRevMap = map[UnfurlMode]string{
	0: "ALWAYS",
	1: "NEVER",
	2: "WHITELISTED",
}

func (e UnfurlMode) String() string {
	if v, ok := UnfurlModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UnfurlSettings struct {
	Mode      UnfurlMode      `codec:"mode" json:"mode"`
	Whitelist map[string]bool `codec:"whitelist" json:"whitelist"`
}

func (o UnfurlSettings) DeepCopy() UnfurlSettings {
	return UnfurlSettings{
		Mode: o.Mode.DeepCopy(),
		Whitelist: (func(x map[string]bool) map[string]bool {
			if x == nil {
				return nil
			}
			ret := make(map[string]bool, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Whitelist),
	}
}

type UnfurlSettingsDisplay struct {
	Mode      UnfurlMode `codec:"mode" json:"mode"`
	Whitelist []string   `codec:"whitelist" json:"whitelist"`
}

func (o UnfurlSettingsDisplay) DeepCopy() UnfurlSettingsDisplay {
	return UnfurlSettingsDisplay{
		Mode: o.Mode.DeepCopy(),
		Whitelist: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Whitelist),
	}
}

type UnfurlInterface interface {
}

func UnfurlProtocol(i UnfurlInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "chat.1.unfurl",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type UnfurlClient struct {
	Cli rpc.GenericClient
}
