package avatars

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
)

type Srv struct {
	libkb.Contextified

	httpSrv *libkb.HTTPSrv
	source  Source
	log     logger.Logger
}

func NewSrv(g *libkb.GlobalContext, httpSrv *libkb.HTTPSrv, source Source) *Srv {
	s := &Srv{
		Contextified: libkb.NewContextified(g),
		httpSrv:      httpSrv,
		source:       source,
	}
	s.httpSrv.HandleFunc("av", s.serve)
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
		resp, err := http.Get(raw)
		if err != nil {
			return nil, err
		}
		return resp.Body, nil
	case "file":
		return os.Open(parsed.Path)
	default:
		return nil, fmt.Errorf("unknown URL scheme: %s", parsed.Scheme)
	}
}

func (s *Srv) serve(w http.ResponseWriter, req *http.Request) {
	typ := req.URL.Query().Get("typ")
	name := req.URL.Query().Get("name")
	format := keybase1.AvatarFormat(req.URL.Query().Get("format"))
	mctx := libkb.NewMetaContextBackground(s.G())

	var loadFn func(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)
	switch typ {
	case "user":
		loadFn = s.source.LoadUsers
	case "team":
		loadFn = s.source.LoadTeams
	default:
		s.makeError(w, http.StatusBadRequest, "unknown avatar type: %s", typ)
		return
	}
	res, err := loadFn(mctx, []string{name}, []keybase1.AvatarFormat{format})
	if err != nil {
		s.makeError(w, http.StatusInternalServerError, "failed to load: %s", err)
	}
	nameRes := res.Picmap[name]
	if nameRes == nil {
		s.makeError(w, http.StatusInternalServerError, "avatar not loaded")
		return
	}
	url, ok := nameRes[format]
	if !ok {
		s.makeError(w, http.StatusInternalServerError, "format not loaded")
		return
	}
	reader, err := s.loadFromURL(url.String())
	if err != nil {
		s.makeError(w, http.StatusInternalServerError, "failed to get URL reader: %s", err)
		return
	}
	defer reader.Close()
	if _, err := io.Copy(w, reader); err != nil {
		s.makeError(w, http.StatusInternalServerError, "failed to write response: %s", err)
		return
	}
}
