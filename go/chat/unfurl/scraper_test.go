package unfurl

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"

	"github.com/keybase/client/go/chat/maps"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type dummyHTTPSrv struct {
	t                         *testing.T
	srv                       *http.Server
	shouldServeAppleTouchIcon bool
	handler                   func(w http.ResponseWriter, r *http.Request)
}

func newDummyHTTPSrv(t *testing.T, handler func(w http.ResponseWriter, r *http.Request)) *dummyHTTPSrv {
	return &dummyHTTPSrv{
		t:       t,
		handler: handler,
	}
}

func (d *dummyHTTPSrv) Start() string {
	localhost := "127.0.0.1"
	listener, err := net.Listen("tcp", fmt.Sprintf("%s:0", localhost))
	require.NoError(d.t, err)
	port := listener.Addr().(*net.TCPAddr).Port
	mux := http.NewServeMux()
	mux.HandleFunc("/", d.handler)
	mux.HandleFunc("/apple-touch-icon.png", d.serveAppleTouchIcon)
	d.srv = &http.Server{
		Addr:    fmt.Sprintf("%s:%d", localhost, port),
		Handler: mux,
	}
	go d.srv.Serve(listener)
	return d.srv.Addr
}

func (d *dummyHTTPSrv) Stop() {
	require.NoError(d.t, d.srv.Close())
}

func (d *dummyHTTPSrv) serveAppleTouchIcon(w http.ResponseWriter, r *http.Request) {
	if d.shouldServeAppleTouchIcon {
		w.WriteHeader(200)
		dat, _ := ioutil.ReadFile(filepath.Join("testcases", "github.png"))
		io.Copy(w, bytes.NewBuffer(dat))
		return
	}
	w.WriteHeader(404)
}

func strPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

func createTestCaseHTTPSrv(t *testing.T) *dummyHTTPSrv {
	return newDummyHTTPSrv(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		name := r.URL.Query().Get("name")
		contentType := r.URL.Query().Get("content_type")
		if len(contentType) > 0 {
			w.Header().Set("Content-Type", contentType)
		}
		dat, err := ioutil.ReadFile(filepath.Join("testcases", name))
		require.NoError(t, err)
		_, err = io.Copy(w, bytes.NewBuffer(dat))
		require.NoError(t, err)
	})
}

func TestScraper(t *testing.T) {
	tc := libkb.SetupTest(t, "scraper", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	scraper := NewScraper(g)

	clock := clockwork.NewFakeClock()
	scraper.cache.setClock(clock)
	scraper.giphyProxy = false

	srv := createTestCaseHTTPSrv(t)
	addr := srv.Start()
	defer srv.Stop()
	forceGiphy := new(chat1.UnfurlType)
	*forceGiphy = chat1.UnfurlType_GIPHY
	testCase := func(name string, expected chat1.UnfurlRaw, success bool, contentType *string,
		forceTyp *chat1.UnfurlType) {
		uri := fmt.Sprintf("http://%s/?name=%s", addr, name)
		if contentType != nil {
			uri += fmt.Sprintf("&content_type=%s", *contentType)
		}
		res, err := scraper.Scrape(context.TODO(), uri, forceTyp)
		if !success {
			require.Error(t, err)
			return
		}
		require.NoError(t, err)
		etyp, err := expected.UnfurlType()
		require.NoError(t, err)
		rtyp, err := res.UnfurlType()
		require.NoError(t, err)
		require.Equal(t, etyp, rtyp)

		t.Logf("expected:\n%v\n\nactual:\n%v", expected, res)
		switch rtyp {
		case chat1.UnfurlType_GENERIC:
			e := expected.Generic()
			r := res.Generic()
			require.Equal(t, e.Title, r.Title)
			require.Equal(t, e.SiteName, r.SiteName)
			require.True(t, (e.Description == nil && r.Description == nil) || (e.Description != nil && r.Description != nil))
			if e.Description != nil {
				require.Equal(t, *e.Description, *r.Description)
			}
			require.True(t, (e.PublishTime == nil && r.PublishTime == nil) || (e.PublishTime != nil && r.PublishTime != nil))
			if e.PublishTime != nil {
				require.Equal(t, *e.PublishTime, *r.PublishTime)
			}

			require.True(t, (e.ImageUrl == nil && r.ImageUrl == nil) || (e.ImageUrl != nil && r.ImageUrl != nil))
			if e.ImageUrl != nil {
				require.Equal(t, *e.ImageUrl, *r.ImageUrl)
			}

			require.True(t, (e.FaviconUrl == nil && r.FaviconUrl == nil) || (e.FaviconUrl != nil && r.FaviconUrl != nil))
			if e.FaviconUrl != nil {
				require.Equal(t, *e.FaviconUrl, *r.FaviconUrl)
			}

			require.True(t, (e.Video == nil && r.Video == nil) || (e.Video != nil && r.Video != nil))
			if e.Video != nil {
				require.Equal(t, e.Video.Url, r.Video.Url)
				require.Equal(t, e.Video.Height, r.Video.Height)
				require.Equal(t, e.Video.Width, r.Video.Width)
			}
		case chat1.UnfurlType_GIPHY:
			e := expected.Giphy()
			r := res.Giphy()
			require.Equal(t, e.ImageUrl, r.ImageUrl)
			require.NotNil(t, r.FaviconUrl)
			require.NotNil(t, e.FaviconUrl)
			require.Equal(t, *e.FaviconUrl, *r.FaviconUrl)
			require.NotNil(t, r.Video)
			require.NotNil(t, e.Video)
			require.Equal(t, e.Video.Url, r.Video.Url)
			require.Equal(t, e.Video.Height, r.Video.Height)
			require.Equal(t, e.Video.Width, r.Video.Width)
		default:
			require.Fail(t, "unknown unfurl typ")
		}

		// test caching
		cachedRes, valid := scraper.cache.get(uri)
		require.True(t, valid)
		require.Equal(t, res, cachedRes.data.(chat1.UnfurlRaw))

		clock.Advance(defaultCacheLifetime * 2)
		cachedRes, valid = scraper.cache.get(uri)
		require.False(t, valid)
	}

	testCase("cnn0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Kanye West seeks separation from politics",
		Url:         "https://www.cnn.com/2018/10/30/entertainment/kanye-west-politics/index.html",
		SiteName:    "CNN",
		Description: strPtr("Just weeks after visiting the White House, Kanye West appears to be a little tired of politics."),
		PublishTime: intPtr(1540941044),
		ImageUrl:    strPtr("https://cdn.cnn.com/cnnnext/dam/assets/181011162312-11-week-in-photos-1011-super-tease.jpg"),
		FaviconUrl:  strPtr("http://cdn.cnn.com/cnn/.e/img/3.0/global/misc/apple-touch-icon.png"),
	}), true, nil, nil)
	testCase("wsj0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "U.S. Stocks Jump as Tough Month Sets to Wrap",
		Url:         "https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261",
		SiteName:    "WSJ",
		Description: strPtr("A surge in technology shares following Facebook’s latest earnings lifted U.S. stocks, helping major indexes trim some of their October declines following a punishing period for global investors."),
		PublishTime: intPtr(1541004540),
		ImageUrl:    strPtr("https://images.wsj.net/im-33925/social"),
		FaviconUrl:  strPtr("https://s.wsj.net/media/wsj_apple-touch-icon-180x180.png"),
	}), true, nil, nil)
	testCase("nytimes0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "First Up if Democrats Win: Campaign and Ethics Changes, Infrastructure and Drug Prices",
		Url:         "https://www.nytimes.com/2018/10/31/us/politics/democrats-midterm-elections.html",
		SiteName:    "0.1", // the default for these tests (from the localhost domain)
		Description: strPtr("House Democratic leaders, for the first time, laid out an ambitious opening salvo of bills for a majority, including an overhaul of campaign and ethics laws."),
		PublishTime: intPtr(1540990881),
		ImageUrl:    strPtr("https://static01.nyt.com/images/2018/10/31/us/politics/31dc-dems/31dc-dems-facebookJumbo.jpg"),
		FaviconUrl:  strPtr("http://127.0.0.1/vi-assets/static-assets/apple-touch-icon-319373aaf4524d94d38aa599c56b8655.png"),
	}), true, nil, nil)
	srv.shouldServeAppleTouchIcon = true
	testCase("github0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "keybase/client",
		Url:         "https://github.com/keybase/client",
		SiteName:    "GitHub",
		Description: strPtr("Keybase Go Library, Client, Service, OS X, iOS, Android, Electron - keybase/client"),
		ImageUrl:    strPtr("https://avatars1.githubusercontent.com/u/5400834?s=400&v=4"),
		FaviconUrl:  strPtr(fmt.Sprintf("http://%s/apple-touch-icon.png", addr)),
	}), true, nil, nil)
	srv.shouldServeAppleTouchIcon = false
	testCase("youtube0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Mario Kart Wii: The History of the Ultra Shortcut",
		Url:         "https://www.youtube.com/watch?v=mmJ_LT8bUj0",
		SiteName:    "YouTube",
		Description: strPtr("https://www.twitch.tv/summoningsalt https://twitter.com/summoningsalt Music List- https://docs.google.com/document/d/1p2qV31ZhtNuP7AAXtRjGNZr2QwMSolzuz2wX6wu..."),
		ImageUrl:    strPtr("https://i.ytimg.com/vi/mmJ_LT8bUj0/hqdefault.jpg"),
		FaviconUrl:  strPtr("https://s.ytimg.com/yts/img/favicon-vfl8qSV2F.ico"),
	}), true, nil, nil)
	testCase("twitter0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Ars Technica on Twitter",
		Url:         "https://twitter.com/arstechnica/status/1057679097869094917",
		SiteName:    "Twitter",
		Description: strPtr("“Nintendo recommits to “keep the business going” for 3DS https://t.co/wTIJxmGTJH by @KyleOrl”"),
		ImageUrl:    strPtr("https://pbs.twimg.com/profile_images/2215576731/ars-logo_400x400.png"),
		FaviconUrl:  strPtr("https://abs.twimg.com/icons/apple-touch-icon-192x192.png"),
	}), true, nil, nil)
	testCase("pinterest0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Halloween",
		Url:         "https://www.pinterest.com/pinterest/halloween/",
		SiteName:    "Pinterest",
		Description: strPtr("Dracula dentures, kitten costumes, no-carve pumpkins—find your next killer idea on Pinterest."),
		ImageUrl:    strPtr("https://i.pinimg.com/custom_covers/200x150/424605139807203572_1414340303.jpg"),
		FaviconUrl:  strPtr("https://s.pinimg.com/webapp/style/images/logo_trans_144x144-642179a1.png"),
	}), true, nil, nil)
	testCase("wikipedia0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Merkle tree - Wikipedia",
		SiteName:    "0.1",
		Description: nil,
		ImageUrl:    strPtr("https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hash_Tree.svg/1200px-Hash_Tree.svg.png"),
		FaviconUrl:  strPtr("http://127.0.0.1/static/apple-touch/wikipedia.png"),
	}), true, nil, nil)
	testCase("reddit0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "r/Stellar",
		Url:         "https://www.reddit.com/r/Stellar/",
		SiteName:    "reddit",
		Description: strPtr("r/Stellar: Stellar is a decentralized protocol that enables you to send money to anyone in the world, for fractions of a penny, instantly, and in any currency.  \n\n/r/Stellar is for news, announcements and discussion related to Stellar.\n\nPlease focus on community-oriented content, such as news and discussions, instead of individual-oriented content, such as questions and help. Follow the [Stellar Community Guidelines](https://www.stellar.org/community-guidelines/) ."),
		ImageUrl:    strPtr("https://b.thumbs.redditmedia.com/D857u25iiE2ORpt8yVx7fCuiMlLVP-b5fwSUjaw4lVU.png"),
		FaviconUrl:  strPtr("https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png"),
	}), true, nil, nil)
	testCase("etsy0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "The Beatles - Minimalist Poster - Sgt Pepper",
		Url:         "https://www.etsy.com/listing/602032869/the-beatles-minimalist-poster-sgt-pepper?utm_source=OpenGraph&utm_medium=PageTools&utm_campaign=Share",
		SiteName:    "Etsy",
		Description: strPtr("The Beatles Sgt Peppers Lonely Hearts Club Ban  Created using mixed media  Fits a 10 x 8 inch frame aperture - photograph shows item framed in a 12 x 10 inch frame  Choose from: high lustre paper - 210g which produces very vibrant colours; textured watercolour paper - 190g - which looks"),
		ImageUrl:    strPtr("https://i.etsystatic.com/12686588/r/il/c3b4bc/1458062296/il_570xN.1458062296_rary.jpg"),
		FaviconUrl:  strPtr("http://127.0.0.1/images/favicon.ico"),
	}), true, nil, nil)
	testCase("giphy0.html", chat1.NewUnfurlRawWithGiphy(chat1.UnfurlGiphyRaw{
		ImageUrl:   strPtr("https://media.giphy.com/media/5C3Zrs5xUg5fHV4Kcf/giphy-downsized-large.gif"),
		FaviconUrl: strPtr("https://giphy.com/static/img/icons/apple-touch-icon-180px.png"),
		Video: &chat1.UnfurlVideo{
			Url:    "https://media.giphy.com/media/5C3Zrs5xUg5fHV4Kcf/giphy.mp4",
			Height: 480,
			Width:  480,
		},
	}), true, nil, forceGiphy)
	testCase("imgur0.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Amazing Just Cause 4 Easter egg",
		Url:         "https://i.imgur.com/lXDyzHY.gifv",
		SiteName:    "Imgur",
		Description: strPtr("2433301 views and 2489 votes on Imgur"),
		ImageUrl:    strPtr("https://i.imgur.com/lXDyzHY.jpg?play"),
		FaviconUrl:  strPtr(fmt.Sprintf("http://%s/favicon.ico", addr)),
		Video: &chat1.UnfurlVideo{
			Url:    "https://i.imgur.com/lXDyzHY.mp4",
			Height: 408,
			Width:  728,
		},
	}), true, nil, nil)
	srv.shouldServeAppleTouchIcon = false
	testCase("nytogimage.jpg", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		SiteName:   "0.1",
		FaviconUrl: strPtr(fmt.Sprintf("http://%s/favicon.ico", addr)),
		ImageUrl:   strPtr(fmt.Sprintf("http://%s/?name=nytogimage.jpg&content_type=image/jpeg", addr)),
	}), true, strPtr("image/jpeg"), nil)
	srv.shouldServeAppleTouchIcon = true
	testCase("slim.html", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{}), false, nil, nil)

}

func TestGiphySearchScrape(t *testing.T) {
	tc := libkb.SetupTest(t, "giphyScraper", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	scraper := NewScraper(g)

	clock := clockwork.NewFakeClock()
	scraper.cache.setClock(clock)
	scraper.giphyProxy = false

	url := "https://media0.giphy.com/media/iJDLBX5GY8niCpZYkR/giphy.mp4#height=360&width=640&isvideo=true"
	res, err := scraper.Scrape(context.TODO(), url, nil)
	require.NoError(t, err)
	typ, err := res.UnfurlType()
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlType_GIPHY, typ)
	require.Nil(t, res.Giphy().ImageUrl)
	require.NotNil(t, res.Giphy().Video)
	require.Equal(t, res.Giphy().Video.Url, url)
	require.Equal(t, 360, res.Giphy().Video.Height)
	require.Equal(t, 640, res.Giphy().Video.Width)

	url = "https://media0.giphy.com/media/iJDLBX5GY8niCpZYkR/giphy.mp4#height=360&width=640&isvideo=false"
	res, err = scraper.Scrape(context.TODO(), url, nil)
	require.NoError(t, err)
	typ, err = res.UnfurlType()
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlType_GIPHY, typ)
	require.NotNil(t, res.Giphy().ImageUrl)
	require.Nil(t, res.Giphy().Video)
	require.Equal(t, *res.Giphy().ImageUrl, url)
}

func TestMapScraper(t *testing.T) {
	tc := libkb.SetupTest(t, "mapScraper", 1)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{
		ExternalAPIKeySource: types.DummyExternalAPIKeySource{},
	})
	scraper := NewScraper(g)
	lat := 40.800099
	lon := -73.969341
	acc := 65.00
	url := fmt.Sprintf("https://%s/?lat=%f&lon=%f&acc=%f&done=true", types.MapsDomain, lat, lon, acc)
	unfurl, err := scraper.Scrape(context.TODO(), url, nil)
	require.NoError(t, err)
	typ, err := unfurl.UnfurlType()
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlType_MAPS, typ)
	require.True(t, strings.Contains(unfurl.Maps().Url, fmt.Sprintf("%f", lat)))
	require.True(t, strings.Contains(unfurl.Maps().Url, fmt.Sprintf("%f", lon)))
	require.NotNil(t, unfurl.Maps().ImageUrl)
	require.True(t, strings.Contains(unfurl.Maps().ImageUrl, maps.MapsProxy))
	require.True(t, strings.Contains(unfurl.Maps().ImageUrl, fmt.Sprintf("%f", lat)))
	require.True(t, strings.Contains(unfurl.Maps().ImageUrl, fmt.Sprintf("%f", lon)))
}

type testingLiveLocationTracker struct {
	coords []chat1.Coordinate
}

func (t *testingLiveLocationTracker) Start(ctx context.Context, uid gregor1.UID) {}
func (t *testingLiveLocationTracker) Stop(ctx context.Context) chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}

func (t *testingLiveLocationTracker) StartTracking(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID, endTime time.Time) {
}

func (t *testingLiveLocationTracker) GetCurrentPosition(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID) {
}

func (t *testingLiveLocationTracker) LocationUpdate(ctx context.Context, coord chat1.Coordinate) {
	t.coords = append(t.coords, coord)
}

func (t *testingLiveLocationTracker) GetCoordinates(ctx context.Context, key types.LiveLocationKey) []chat1.Coordinate {
	return t.coords
}

func (t *testingLiveLocationTracker) ActivelyTracking(ctx context.Context) bool {
	return false
}

func (t *testingLiveLocationTracker) StopAllTracking(ctx context.Context) {}

func TestLiveMapScraper(t *testing.T) {
	tc := libkb.SetupTest(t, "liveMapScraper", 1)
	defer tc.Cleanup()
	liveLocation := &testingLiveLocationTracker{}
	g := globals.NewContext(tc.G, &globals.ChatContext{
		ExternalAPIKeySource: types.DummyExternalAPIKeySource{},
		LiveLocationTracker:  liveLocation,
	})
	scraper := NewScraper(g)
	first := chat1.Coordinate{
		Lat:      40.800099,
		Lon:      -73.969341,
		Accuracy: 65.00,
	}
	watchID := chat1.LocationWatchID(20)
	liveLocation.LocationUpdate(context.TODO(), chat1.Coordinate{
		Lat:      40.756325,
		Lon:      -73.992533,
		Accuracy: 65,
	})
	liveLocation.LocationUpdate(context.TODO(), chat1.Coordinate{
		Lat:      40.704454,
		Lon:      -74.010893,
		Accuracy: 65,
	})
	url := fmt.Sprintf("https://%s/?lat=%f&lon=%f&acc=%f&watchID=%d&done=false&livekey=mike",
		types.MapsDomain, first.Lat, first.Lon, first.Accuracy, watchID)
	unfurl, err := scraper.Scrape(context.TODO(), url, nil)
	require.NoError(t, err)
	typ, err := unfurl.UnfurlType()
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlType_MAPS, typ)
	require.NotZero(t, len(unfurl.Maps().ImageUrl))
	require.Equal(t, "Live Location Share", unfurl.Maps().SiteName)

	url = fmt.Sprintf("https://%s/?lat=%f&lon=%f&acc=%f&watchID=%d&done=true&livekey=mike", types.MapsDomain,
		first.Lat, first.Lon, first.Accuracy, watchID)
	unfurl, err = scraper.Scrape(context.TODO(), url, nil)
	require.NoError(t, err)
	typ, err = unfurl.UnfurlType()
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlType_MAPS, typ)
	require.Equal(t, "Live Location Share (finished)", unfurl.Maps().SiteName)
}
