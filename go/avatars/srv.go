package avatars

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"

	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/libkb"
)

type Srv struct {
	libkb.Contextified

	httpSrv *manager.Srv
	source  Source
}

func NewSrv(g *libkb.GlobalContext, httpSrv *manager.Srv, source Source) *Srv {
	s := &Srv{
		Contextified: libkb.NewContextified(g),
		httpSrv:      httpSrv,
		source:       source,
	}
	s.httpSrv.HandleFunc("av", manager.SrvTokenModeDefault, s.serve)
	return s
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
		resp, err := libkb.ProxyHTTPGet(s.G().GetEnv(), raw)
		if err != nil {
			return nil, err
		}
		return resp.Body, nil
	case "file":
		return os.Open(parsed.Path)
	default:
		return nil, fmt.Errorf("unknown URL scheme: %s raw: %s", parsed.Scheme, raw)
	}
}

func (s *Srv) loadPlaceholder(format keybase1.AvatarFormat, placeholderMap map[keybase1.AvatarFormat]string) ([]byte, error) {
	encoded, ok := placeholderMap[format]
	if !ok {
		return nil, errors.New("no placeholder for format")
	}
	return base64.StdEncoding.DecodeString(encoded)
}

func (s *Srv) serve(w http.ResponseWriter, req *http.Request) {
	typ := req.URL.Query().Get("typ")
	name := req.URL.Query().Get("name")
	format := keybase1.AvatarFormat(req.URL.Query().Get("format"))
	mctx := libkb.NewMetaContextBackground(s.G())

	var loadFn func(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)
	var placeholderMap map[keybase1.AvatarFormat]string
	switch typ {
	case "user":
		loadFn = s.source.LoadUsers
		placeholderMap = userPlaceholders
	case "team":
		loadFn = s.source.LoadTeams
		placeholderMap = teamPlaceholders
	default:
		s.makeError(w, http.StatusBadRequest, "unknown avatar type: %s", typ)
		return
	}
	res, err := loadFn(mctx, []string{name}, []keybase1.AvatarFormat{format})
	if err != nil {
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
