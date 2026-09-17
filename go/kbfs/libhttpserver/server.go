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
	"runtime"
	"strings"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/libmime"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

const fsCacheSize = 64

// Server is a local HTTP server for serving KBFS content over HTTP.
type Server struct {
	config libkbfs.Config
	logger logger.Logger
	vlog   *libkb.VDebugLog

	tokenLock       sync.RWMutex
	token           string
	tokenExpireTime time.Time

	fs *lru.Cache

	server *manager.Srv
}

const (
	tokenByteSize  = 32
	tokenValidTime = 10 * time.Minute
)

// CurrentToken returns the currently valid token that a HTTP client can use to
// load content from the server.
func (s *Server) CurrentToken() (token string, err error) {
	s.tokenLock.RLock()
	if s.config.Clock().Now().Before(s.tokenExpireTime) {
		defer s.tokenLock.RUnlock()
		return s.token, nil
	}

	s.tokenLock.RUnlock()

	buf := make([]byte, tokenByteSize)
	if _, err = rand.Read(buf); err != nil {
		return "", err
	}
	token = base64.URLEncoding.EncodeToString(buf)

	s.tokenLock.Lock()
	defer s.tokenLock.Unlock()

	if s.config.Clock().Now().Before(s.tokenExpireTime) {
		return s.token, nil
	}

	s.token = token
	s.tokenExpireTime = s.config.Clock().Now().Add(tokenValidTime)

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
	fs          *libfs.FS
	ch          <-chan struct{}
	unsubscribe func()
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
	toStrip string, fs http.FileSystem, err error,
) {
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

	fsLifeCh, unsubscribe, err := tlfFS.SubscribeToObsolete()
	if err != nil {
		return "", nil, err
	}

	s.fs.Add(toStrip, obsoleteTrackingFS{
		fs: tlfFS, ch: fsLifeCh, unsubscribe: unsubscribe,
	})

	return toStrip, tlfFS.ToHTTPFileSystem(ctx), nil
}

// serve accepts "/<fs path>?token=<token>"
// For example:
//
//	/team/keybase/file.txt?token=1234567890abcdef1234567890abcdef
func (s *Server) serve(w http.ResponseWriter, req *http.Request) {
	s.vlog.Log(libkb.VLog1, "Incoming request from %q: %s", req.UserAgent(), req.URL)
	addr, err := s.server.Addr()
	if err != nil {
		s.logger.Error("serve: failed to get HTTP server address: %s", err)
		s.handleInternalServerError(w)
		return
	}
	if req.Host != addr {
		s.logger.Warning("Host %s didn't match addr %s, failing request to protect against DNS rebinding", req.Host, addr)
		s.handleBadRequest(w)
		return
	}
	token := req.URL.Query().Get("token")
	currentToken, err := s.CurrentToken()
	if err != nil {
		s.logger.Error("serve: failed to get current token: %s", err)
		s.handleInternalServerError(w)
		return
	}
	if len(token) == 0 || token != currentToken {
		s.vlog.Log(libkb.VLog1, "Invalid token %q", token)
		s.handleInvalidToken(w)
		return
	}
	toStrip, fs, err := s.getHTTPFileSystem(req.Context(), req.URL.Path)
	if err != nil {
		s.logger.Warning("Bad request; error=%v", err)
		s.handleBadRequest(w)
		return
	}
	viewTypeInvariance := req.URL.Query().Get("viewTypeInvariance")
	if len(viewTypeInvariance) == 0 {
		s.logger.Warning("Bad request; missing viewTypeInvariance")
		s.handleBadRequest(w)
		return
	}
	wrappedW := newContentTypeOverridingResponseWriter(w,
		viewTypeInvariance)
	http.StripPrefix(toStrip, http.FileServer(fs)).ServeHTTP(wrappedW, req)
}

const (
	portStart       = 16723
	portEnd         = 60000
	requestPathRoot = "/files/"
)

// appState adapts env.AppStateUpdater to manager.AppState.
type appState struct {
	env.AppStateUpdater
}

func (a appState) State() keybase1.MobileAppState { return a.AppState() }

func (a appState) NextUpdate(last keybase1.MobileAppState) <-chan struct{} {
	return a.NextAppStateUpdate(last)
}

// New creates and starts a new server.
func New(appStateUpdater env.AppStateUpdater, config libkbfs.Config) (
	s *Server, err error,
) {
	logger := config.MakeLogger("HTTP")
	s = &Server{
		config: config,
		logger: logger,
		vlog:   config.MakeVLogger(logger),
	}
	s.fs, err = lru.NewWithEvict(fsCacheSize, func(_ any, value any) {
		if e, ok := value.(obsoleteTrackingFS); ok && e.unsubscribe != nil {
			e.unsubscribe()
		}
	})
	if err != nil {
		return nil, err
	}
	s.server, err = manager.New(logger, appState{appStateUpdater},
		func() kbhttp.ListenerSource {
			return kbhttp.NewRandomPortRangeListenerSource(portStart, portEnd)
		}, runtime.GOOS != "android", func(context.Context, keybase1.HttpSrvInfo) {})
	if err != nil {
		s.server.Shutdown()
		return nil, err
	}
	// The token is checked in serve. No one has the address before New
	// returns, so registering after the first start answers no request with a 404.
	s.server.HandleFunc(strings.TrimPrefix(requestPathRoot, "/"), manager.SrvTokenModeUnchecked,
		http.StripPrefix(requestPathRoot, http.HandlerFunc(s.serve)).ServeHTTP)
	libmime.Patch(additionalMimeTypes)
	return s, nil
}

// Address returns the address that the server is listening on.
func (s *Server) Address() (string, error) {
	return s.server.Addr()
}

// Shutdown shuts down the server.
func (s *Server) Shutdown() {
	s.server.Shutdown()
	// Purge the LRU so its evict callback runs and unsubscribes any
	// folder-branch observers still held by cached entries.
	s.fs.Purge()
}
