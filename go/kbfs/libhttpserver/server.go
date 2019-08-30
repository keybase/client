// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libhttpserver

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"io"
	"net/http"
	"path"
	"strings"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/libmime"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

const tokenCacheSize = 64
const fsCacheSize = 64

// Server is a local HTTP server for serving KBFS content over HTTP.
type Server struct {
	config          libkbfs.Config
	logger          logger.Logger
	appStateUpdater env.AppStateUpdater
	cancel          func()

	tokens *lru.Cache
	fs     *lru.Cache

	serverLock sync.RWMutex
	server     *kbhttp.Srv
}

const tokenByteSize = 32

// NewToken returns a new random token that a HTTP client can use to load
// content from the server.
func (s *Server) NewToken() (token string, err error) {
	buf := make([]byte, tokenByteSize)
	if _, err = rand.Read(buf); err != nil {
		return "", err
	}
	token = base64.URLEncoding.EncodeToString(buf)
	s.tokens.Add(token, nil)
	return token, nil
}

func (s *Server) handleInvalidToken(w http.ResponseWriter) {
	w.WriteHeader(http.StatusForbidden)
	_, _ = io.WriteString(w, `
    <html>
        <head>
            <title>KBFS HTTP Token Invalid</title>
        </head>
        <body>
            token invalid
        </body>
    </html>
    `)
}

func (s *Server) handleBadRequest(w http.ResponseWriter) {
	w.WriteHeader(http.StatusBadRequest)
}

func (s *Server) handleInternalServerError(w http.ResponseWriter) {
	w.WriteHeader(http.StatusInternalServerError)
}

type obsoleteTrackingFS struct {
	fs *libfs.FS
	ch <-chan struct{}
}

func (e obsoleteTrackingFS) isObsolete() bool {
	select {
	case <-e.ch:
		return true
	default:
		return false
	}
}

func (s *Server) getHTTPFileSystem(ctx context.Context, requestPath string) (
	toStrip string, fs http.FileSystem, err error) {
	fields := strings.Split(requestPath, "/")
	if len(fields) < 2 {
		return "", libfs.NewRootFS(s.config).ToHTTPFileSystem(ctx), nil
	}

	tlfType, err := tlf.ParseTlfTypeFromPath(fields[0])
	if err != nil {
		return "", nil, err
	}

	toStrip = path.Join(fields[0], fields[1])

	if fsCached, ok := s.fs.Get(toStrip); ok {
		if fsCachedTyped, ok := fsCached.(obsoleteTrackingFS); ok {
			if !fsCachedTyped.isObsolete() {
				return toStrip, fsCachedTyped.fs.ToHTTPFileSystem(ctx), nil
			}
		}
	}

	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(ctx,
		s.config.KBPKI(), s.config.MDOps(), s.config, fields[1], tlfType)
	if err != nil {
		return "", nil, err
	}

	tlfFS, err := libfs.NewFS(ctx,
		s.config, tlfHandle, data.MasterBranch, "", "",
		keybase1.MDPriorityNormal)
	if err != nil {
		return "", nil, err
	}

	fsLifeCh, err := tlfFS.SubscribeToObsolete()
	if err != nil {
		return "", nil, err
	}

	s.fs.Add(toStrip, obsoleteTrackingFS{fs: tlfFS, ch: fsLifeCh})

	return toStrip, tlfFS.ToHTTPFileSystem(ctx), nil
}

// serve accepts "/<fs path>?token=<token>"
// For example:
//     /team/keybase/file.txt?token=1234567890abcdef1234567890abcdef
func (s *Server) serve(w http.ResponseWriter, req *http.Request) {
	s.logger.Debug("Incoming request from %q: %s", req.UserAgent(), req.URL)
	addr, err := s.server.Addr()
	if err != nil {
		s.logger.Debug("serve: failed to get HTTP server address: %s", err)
		s.handleInternalServerError(w)
		return
	}
	if req.Host != addr {
		s.logger.Debug("Host %s didn't match addr %s, failing request to protect against DNS rebinding", req.Host, addr)
		s.handleBadRequest(w)
		return
	}
	token := req.URL.Query().Get("token")
	if len(token) == 0 || !s.tokens.Contains(token) {
		s.logger.Info("Invalid token %q", token)
		s.handleInvalidToken(w)
		return
	}
	toStrip, fs, err := s.getHTTPFileSystem(req.Context(), req.URL.Path)
	if err != nil {
		s.logger.Warning("Bad request; error=%v", err)
		s.handleBadRequest(w)
		return
	}
	http.StripPrefix(toStrip, http.FileServer(fs)).ServeHTTP(
		newContentTypeOverridingResponseWriter(w), req)
}

const portStart = 16723
const portEnd = 60000
const requestPathRoot = "/files/"

func (s *Server) restart() (err error) {
	s.serverLock.Lock()
	defer s.serverLock.Unlock()
	if s.server != nil {
		s.server.Stop()
		err = s.server.Start()
	}
	if s.server == nil ||
		// If pinned port is in use, just pick a new one like we never had a
		// server before.
		err == kbhttp.ErrPinnedPortInUse {
		s.server = kbhttp.NewSrv(s.logger,
			kbhttp.NewRandomPortRangeListenerSource(portStart, portEnd))
		err = s.server.Start()
	}
	if err != nil {
		return err
	}
	// Have to start this first to populate the ServeMux object.
	s.server.Handle(requestPathRoot,
		http.StripPrefix(requestPathRoot, http.HandlerFunc(s.serve)))
	return nil
}

func (s *Server) monitorAppState(ctx context.Context) {
	state := keybase1.MobileAppState_FOREGROUND
	for {
		select {
		case <-ctx.Done():
			return
		case state = <-s.appStateUpdater.NextAppStateUpdate(&state):
			// Due to the way NextUpdate is designed, it's possible we miss an
			// update if processing the last update takes too long. So it's
			// possible to get consecutive FOREGROUND updates even if there are
			// other states in-between. Since libkb/appstate.go already
			// deduplicates, it'll never actually send consecutive identical
			// states to us. In addition, apart from FOREGROUND/BACKGROUND,
			// there are other possible states too, and potentially more in the
			// future. So, we just restart the server under FOREGROUND instead
			// of trying to listen on all state updates.
			if state != keybase1.MobileAppState_FOREGROUND {
				continue
			}
			if err := s.restart(); err != nil {
				s.logger.Warning("(Re)starting server failed: %v", err)
			}
		}
	}
}

// New creates and starts a new server.
func New(appStateUpdater env.AppStateUpdater, config libkbfs.Config) (
	s *Server, err error) {
	logger := config.MakeLogger("HTTP")
	s = &Server{
		appStateUpdater: appStateUpdater,
		config:          config,
		logger:          logger,
	}
	if s.tokens, err = lru.New(tokenCacheSize); err != nil {
		return nil, err
	}
	if s.fs, err = lru.New(fsCacheSize); err != nil {
		return nil, err
	}
	if err = s.restart(); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	go s.monitorAppState(ctx)
	s.cancel = cancel
	libmime.Patch(additionalMimeTypes)
	return s, nil
}

// Address returns the address that the server is listening on.
func (s *Server) Address() (string, error) {
	s.serverLock.RLock()
	defer s.serverLock.RUnlock()
	return s.server.Addr()
}

// Shutdown shuts down the server.
func (s *Server) Shutdown() {
	s.serverLock.Lock()
	defer s.serverLock.Unlock()
	s.server.Stop()
	s.cancel()
}
