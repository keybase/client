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
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

type dummyHTTPSrv struct {
	t       *testing.T
	srv     *http.Server
	handler func(w http.ResponseWriter, r *http.Request)
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

func strPtr(s string) *string {
	return &s
}

func TestScraper(t *testing.T) {
	scraper := NewScraper(logger.NewTestLogger(t))
	srv := newDummyHTTPSrv(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		name := r.URL.Query().Get("name")
		dat, err := ioutil.ReadFile(filepath.Join("testcases", name+".html"))
		require.NoError(t, err)
		_, err = io.Copy(w, bytes.NewBuffer(dat))
		require.NoError(t, err)
	})
	addr := srv.Start()
	defer srv.Stop()
	testCase := func(name string, expected chat1.UnfurlRaw) {
		res, err := scraper.Scrape(context.TODO(), "http://"+addr+"/?name="+name)
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
			require.Equal(t, e.Url, r.Url)
			require.True(t, (e.Description == nil && r.Description == nil) || (e.Description != nil && r.Description != nil))
			if e.Description != nil {
				require.Equal(t, *e.Description, *r.Description)
			}

			require.True(t, (e.ImageUrl == nil && r.ImageUrl == nil) || (e.ImageUrl != nil && r.ImageUrl != nil))
			if e.ImageUrl != nil {
				require.Equal(t, *e.ImageUrl, *r.ImageUrl)
			}

			require.True(t, (e.FaviconUrl == nil && r.FaviconUrl == nil) || (e.FaviconUrl != nil && r.FaviconUrl != nil))
			if e.FaviconUrl != nil {
				require.Equal(t, *e.FaviconUrl, *r.FaviconUrl)
			}
		default:
			require.Fail(t, "unknown unfurl typ")
		}
	}
	testCase("cnn0", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Kanye West seeks separation from politics",
		Url:         "https://www.cnn.com/2018/10/30/entertainment/kanye-west-politics/index.html",
		SiteName:    "CNN",
		Description: strPtr("Just weeks after visiting the White House, Kanye West appears to be a little tired of politics."),
		ImageUrl:    strPtr("https://cdn.cnn.com/cnnnext/dam/assets/181011162312-11-week-in-photos-1011-super-tease.jpg"),
		FaviconUrl:  strPtr("http://127.0.0.1/favicon.ie9.ico"),
	}))
	testCase("wsj0", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "U.S. Stocks Jump as Tough Month Sets to Wrap",
		Url:         "https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261",
		SiteName:    "WSJ",
		Description: strPtr("A surge in technology shares following Facebook’s latest earnings lifted U.S. stocks, helping major indexes trim some of their October declines following a punishing period for global investors."),
		ImageUrl:    strPtr("https://images.wsj.net/im-33925/social"),
		FaviconUrl:  strPtr("https://s.wsj.net/media/wsj_favicon-16x16.png"),
	}))
	testCase("nytimes0", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "First Up if Democrats Win: Campaign and Ethics Changes, Infrastructure and Drug Prices",
		Url:         "https://www.nytimes.com/2018/10/31/us/politics/democrats-midterm-elections.html",
		SiteName:    "0.1", // the default for these tests (from the localhost domain)
		Description: strPtr("House Democratic leaders, for the first time, laid out an ambitious opening salvo of bills for a majority, including an overhaul of campaign and ethics laws."),
		ImageUrl:    strPtr("https://static01.nyt.com/images/2018/10/31/us/politics/31dc-dems/31dc-dems-facebookJumbo.jpg"),
		FaviconUrl:  strPtr("http://127.0.0.1/vi-assets/static-assets/favicon-4bf96cb6a1093748bf5b3c429accb9b4.ico"),
	}))
	testCase("github0", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "keybase/client",
		Url:         "https://github.com/keybase/client",
		SiteName:    "GitHub",
		Description: strPtr("Keybase Go Library, Client, Service, OS X, iOS, Android, Electron - keybase/client"),
		ImageUrl:    strPtr("https://avatars1.githubusercontent.com/u/5400834?s=400&v=4"),
		FaviconUrl:  strPtr("https://assets-cdn.github.com/favicon.ico"),
	}))
	testCase("youtube0", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Mario Kart Wii: The History of the Ultra Shortcut",
		Url:         "https://www.youtube.com/watch?v=mmJ_LT8bUj0",
		SiteName:    "YouTube",
		Description: strPtr("https://www.twitch.tv/summoningsalt https://twitter.com/summoningsalt Music List- https://docs.google.com/document/d/1p2qV31ZhtNuP7AAXtRjGNZr2QwMSolzuz2wX6wu..."),
		ImageUrl:    strPtr("https://i.ytimg.com/vi/mmJ_LT8bUj0/hqdefault.jpg"),
		FaviconUrl:  strPtr("https://s.ytimg.com/yts/img/favicon-vfl8qSV2F.ico"),
	}))
	testCase("twitter0", chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Title:       "Ars Technica on Twitter",
		Url:         "https://twitter.com/arstechnica/status/1057679097869094917",
		SiteName:    "Twitter",
		Description: strPtr("“Nintendo recommits to “keep the business going” for 3DS https://t.co/wTIJxmGTJH by @KyleOrl”"),
		ImageUrl:    strPtr("https://pbs.twimg.com/profile_images/2215576731/ars-logo_400x400.png"),
		FaviconUrl:  strPtr("http://abs.twimg.com/favicons/favicon.ico"),
	}))
}
