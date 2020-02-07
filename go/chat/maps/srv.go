package maps

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/keybase/client/go/avatars"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/kbhttp/manager"
)

type Srv struct {
	globals.Contextified
	httpSrv *manager.Srv
}

func NewSrv(g *globals.Context, httpSrv *manager.Srv) *Srv {
	s := &Srv{
		Contextified: globals.NewContextified(g),
		httpSrv:      httpSrv,
	}
	s.httpSrv.HandleFunc("map", manager.SrvTokenModeDefault, s.serve)
	return s
}

func (s *Srv) debug(msg string, args ...interface{}) {
	s.G().GetLog().Debug("Maps.Srv: %s", fmt.Sprintf(msg, args...))
}

func (s *Srv) makeError(w http.ResponseWriter, code int, msg string, args ...interface{}) {
	s.debug("serve: error code: %d msg %s", code, fmt.Sprintf(msg, args...))
	w.WriteHeader(code)
}

func (s *Srv) serve(w http.ResponseWriter, req *http.Request) {
	ctx := globals.ChatCtx(context.Background(), s.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	strlat := req.URL.Query().Get("lat")
	strlon := req.URL.Query().Get("lon")
	strwidth := req.URL.Query().Get("width")
	strheight := req.URL.Query().Get("height")
	username := req.URL.Query().Get("username")
	lat, err := strconv.ParseFloat(strlat, 64)
	if err != nil {
		s.makeError(w, http.StatusBadRequest, "invalid lat: %s", err)
		return
	}
	lon, err := strconv.ParseFloat(strlon, 64)
	if err != nil {
		s.makeError(w, http.StatusBadRequest, "invalid lon: %s", err)
		return
	}
	width, err := strconv.ParseInt(strwidth, 0, 0)
	if err != nil {
		s.makeError(w, http.StatusBadRequest, "invalid width: %s", err)
		return
	}
	height, err := strconv.ParseInt(strheight, 0, 0)
	if err != nil {
		s.makeError(w, http.StatusBadRequest, "invalid height: %s", err)
		return
	}
	mapURL, err := GetCustomMapURL(ctx, s.G().ExternalAPIKeySource, lat, lon, int(width)*scale,
		int(height)*scale)
	if err != nil {
		s.makeError(w, http.StatusInternalServerError, "unable to get map url: %s", err)
		return
	}
	mapReader, _, err := MapReaderFromURL(ctx, s.G(), mapURL)
	if err != nil {
		s.makeError(w, http.StatusInternalServerError, "unable to get map reader: %s", err)
		return
	}

	defer mapReader.Close()

	var reader io.ReadCloser
	if username != "" {
		avatarReader, _, err := avatars.GetBorderedCircleAvatar(ctx, s.G(), username, 48, 8, 8)
		if err != nil {
			s.makeError(w, http.StatusInternalServerError, "unable to get avatar: %s", err)
			return
		}

		fancyReader, _, err := DecorateMap(ctx, avatarReader, mapReader)
		if err != nil {
			s.makeError(w, http.StatusInternalServerError, "unable to decorate map: %s", err)
			return
		}
		reader = fancyReader
	} else {
		reader = mapReader
	}

	if _, err := io.Copy(w, reader); err != nil {
		s.makeError(w, http.StatusInternalServerError, "unable to read map: %s", err)
		return
	}
}

func ServiceInit(g *globals.Context, httpSrv *manager.Srv) {
	NewSrv(g, httpSrv)
}
