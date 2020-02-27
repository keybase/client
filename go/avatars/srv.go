package avatars

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"time"

	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/libkb"
)

var avatarTransport = &http.Transport{
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
		DualStack: true,
	}).DialContext,
	MaxConnsPerHost:       10,
	MaxIdleConns:          100,
	IdleConnTimeout:       90 * time.Second,
	TLSHandshakeTimeout:   10 * time.Second,
	ExpectContinueTimeout: 1 * time.Second,
}

func reqKey(name string, format keybase1.AvatarFormat) string {
	return name + string(format)
}

type srvReq struct {
	typ    string
	name   string
	format keybase1.AvatarFormat
	mode   string

	cb    chan keybase1.LoadAvatarsRes
	errCb chan error
}

func (r srvReq) key() string {
	return reqKey(r.name, r.format)
}

type Srv struct {
	libkb.Contextified

	httpSrv    *manager.Srv
	source     libkb.AvatarLoaderSource
	batchServe func(interface{})
}

func NewSrv(g *libkb.GlobalContext, httpSrv *manager.Srv, source libkb.AvatarLoaderSource) *Srv {

	s := &Srv{
		Contextified: libkb.NewContextified(g),
		httpSrv:      httpSrv,
		source:       source,
	}
	batchServe, batchCancel := libkb.ThrottleBatch(
		func(intReqs interface{}) {
			reqs, _ := intReqs.([]srvReq)
			s.serveReqs(reqs)
		},
		func(intReqs interface{}, intReq interface{}) interface{} {
			reqs, _ := intReqs.([]srvReq)
			req, _ := intReq.(srvReq)
			return append(reqs, req)
		},
		func() interface{} {
			return []srvReq{}
		},
		200*time.Millisecond, false,
	)
	s.batchServe = batchServe
	s.httpSrv.HandleFunc("av", manager.SrvTokenModeDefault, s.serve)
	g.PushShutdownHook(func(libkb.MetaContext) error {
		batchCancel()
		return nil
	})
	return s
}

func (s *Srv) GetUserAvatar(username string) (string, error) {
	if s.httpSrv == nil {
		return "", fmt.Errorf("HttpSrv is not ready")
	}

	addr, err := s.httpSrv.Addr()
	if err != nil {
		return "", err
	}

	token := s.httpSrv.Token()

	return fmt.Sprintf("http://%v/av?typ=user&name=%v&format=square_192&token=%v", addr, username, token), nil
}

func (s *Srv) debug(msg string, args ...interface{}) {
	s.G().GetLog().Debug("Avatars.Srv: %s", fmt.Sprintf(msg, args...))
}

func (s *Srv) makeError(w http.ResponseWriter, code int, msg string,
	args ...interface{}) {
	s.debug("serve: error code: %d msg %s", code, fmt.Sprintf(msg, args...))
	w.WriteHeader(code)
}

func (s *Srv) loadFromURL(raw string) (io.ReadCloser, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, err
	}
	switch parsed.Scheme {
	case "http", "https":
		avatarTransport.Proxy = libkb.MakeProxy(s.G().GetEnv())
		xprt := libkb.NewInstrumentedRoundTripper(s.G(), func(*http.Request) string { return "AvatarSrv" },
			libkb.NewClosingRoundTripper(avatarTransport))
		cli := &http.Client{
			Transport: xprt,
		}
		resp, err := cli.Get(raw)
		if err != nil {
			return nil, err
		}
		return resp.Body, nil
	case "file":
		filePath := parsed.Path
		if runtime.GOOS == "windows" && len(filePath) > 0 {
			filePath = filePath[1:]
		}
		return os.Open(filePath)
	default:
		return nil, fmt.Errorf("unknown URL scheme: %s raw: %s", parsed.Scheme, raw)
	}
}

func (s *Srv) mapToList(m map[string]bool) (res []string) {
	res = make([]string, 0, len(m))
	for k := range m {
		res = append(res, k)
	}
	return res
}

func (s *Srv) loadPlaceholder(format keybase1.AvatarFormat, placeholderMap map[keybase1.AvatarFormat]string) ([]byte, error) {
	encoded, ok := placeholderMap[format]
	if !ok {
		return nil, errors.New("no placeholder for format")
	}
	return base64.StdEncoding.DecodeString(encoded)
}

func (s *Srv) serveReqs(reqs []srvReq) {
	users := make(map[string]bool)
	teams := make(map[string]bool)
	keyToReq := make(map[string]srvReq)
	var formats []keybase1.AvatarFormat
	for _, req := range reqs {
		keyToReq[req.key()] = req
		formats = append(formats, req.format)
		switch req.typ {
		case "user":
			users[req.name] = true
		case "team":
			teams[req.name] = true
		}
	}
	s.debug("serveReqs: users: %d teams: %d formats: %d", len(users), len(teams), len(formats))
	var usersRes, teamsRes keybase1.LoadAvatarsRes
	genErrors := func(names map[string]bool, err error) {
		for name := range names {
			for _, format := range formats {
				req, ok := keyToReq[reqKey(name, format)]
				if ok {
					req.errCb <- err
				}
			}
		}
	}
	userDoneCh := make(chan error, 1)
	teamDoneCh := make(chan error, 1)
	if len(users) > 0 {
		go func() {
			var err error
			usersRes, err = s.source.LoadUsers(libkb.NewMetaContextBackground(s.G()), s.mapToList(users),
				formats)
			if err != nil {
				genErrors(users, err)
			}
			userDoneCh <- err
		}()
	} else {
		userDoneCh <- nil
	}
	if len(teams) > 0 {
		go func() {
			var err error
			teamsRes, err = s.source.LoadTeams(libkb.NewMetaContextBackground(s.G()), s.mapToList(teams),
				formats)
			if err != nil {
				genErrors(teams, err)
			}
			teamDoneCh <- err
		}()
	} else {
		teamDoneCh <- nil
	}
	userErr := <-userDoneCh
	teamErr := <-teamDoneCh
	for _, req := range reqs {
		switch req.typ {
		case "user":
			if userErr == nil {
				req.cb <- usersRes
			}
		case "team":
			if teamErr == nil {
				req.cb <- teamsRes
			}
		}
	}
}

func (s *Srv) serve(w http.ResponseWriter, req *http.Request) {
	typ := req.URL.Query().Get("typ")
	name := req.URL.Query().Get("name")
	format := keybase1.AvatarFormat(req.URL.Query().Get("format"))
	mode := req.URL.Query().Get("mode")

	var placeholderMap map[keybase1.AvatarFormat]string
	switch typ {
	case "user":
		placeholderMap = userPlaceholders
		if mode == "dark" {
			placeholderMap = userPlaceholdersDark
		}
	case "team":
		placeholderMap = teamPlaceholders
		if mode == "dark" {
			placeholderMap = teamPlaceholdersDark
		}
	default:
		s.makeError(w, http.StatusBadRequest, "unknown avatar type: %s", typ)
		return
	}

	var res keybase1.LoadAvatarsRes
	var err error
	sreq := srvReq{
		typ:    typ,
		name:   name,
		format: format,
		mode:   mode,
		cb:     make(chan keybase1.LoadAvatarsRes, 1),
		errCb:  make(chan error, 1),
	}
	s.batchServe(sreq)
	select {
	case res = <-sreq.cb:
	case err := <-sreq.errCb:
		s.makeError(w, http.StatusInternalServerError, "failed to load: %s", err)
		return
	}

	nameRes := res.Picmap[name]
	if nameRes == nil {
		s.makeError(w, http.StatusInternalServerError, "avatar not loaded")
		return
	}
	var reader io.ReadCloser
	url, ok := nameRes[format]
	if !ok || len(url.String()) == 0 {
		placeholder, err := s.loadPlaceholder(format, placeholderMap)
		if err != nil {
			s.makeError(w, http.StatusInternalServerError, "failed to load placeholder: %s", err)
			return
		}
		reader = ioutil.NopCloser(bytes.NewReader(placeholder))
	} else {
		if reader, err = s.loadFromURL(url.String()); err != nil {
			s.makeError(w, http.StatusInternalServerError, "failed to get URL reader: %s", err)
			return
		}
	}
	defer reader.Close()
	if _, err := io.Copy(w, reader); err != nil {
		s.makeError(w, http.StatusInternalServerError, "failed to write response: %s", err)
		return
	}
}
