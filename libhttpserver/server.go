// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libhttpserver

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/libmime"
	"github.com/keybase/kbfs/tlf"
)

const tokenCacheSize = 64
const fsCacheSize = 64

// Server is a local HTTP server for serving KBFS content to the front end.
type Server struct {
	config libkbfs.Config
	server *libkb.HTTPSrv

	tokens *lru.Cache
	fs     *lru.Cache
}

var _ libkbfs.LocalHTTPServer = (*Server)(nil)

const tokenByteSize = 16

// NewToken implements the libkbfs.LocalHTTPServer interface..
func (s *Server) NewToken() (token string, err error) {
	buf := make([]byte, tokenByteSize)
	if _, err = rand.Read(buf); err != nil {
		return "", err
	}
	token = hex.EncodeToString(buf)
	s.tokens.Add(token, nil)
	return token, nil
}

func (s *Server) handleInvalidToken(w http.ResponseWriter) {
	w.WriteHeader(http.StatusForbidden)
	io.WriteString(w, `
    <html>
        <head>
            <title>.kbfs_http_token_invalid</title>
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

func (s *Server) getHTTPFileSystem(
	req *http.Request) (toStrip string, fs http.FileSystem, err error) {
	fields := strings.Split(req.URL.Path, "/")
	if len(fields) < 3 {
		return "", nil, errors.New("bad path")
	}
	var tlfType tlf.Type
	switch strings.ToLower(fields[0]) {
	case "private":
		tlfType = tlf.Private
	case "public":
		tlfType = tlf.Public
	case "team":
		tlfType = tlf.SingleTeam
	default:
		return "", nil, errors.New("unknown tlf type")
	}

	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(req.Context(),
		s.config.KBPKI(), s.config.MDOps(), fields[1], tlfType)
	if err != nil {
		return "", nil, err
	}

	toStrip = path.Join(fields[0], fields[1])

	fav := tlfHandle.ToFavorite()
	if fsCached, ok := s.fs.Get(fav); ok {
		if tlfFS, ok := fsCached.(*libfs.FS); ok {
			return toStrip, tlfFS.ToHTTPFileSystem(req.Context()), nil
		}
	}

	tlfFS, err := libfs.NewFS(req.Context(),
		s.config, tlfHandle, "", "", keybase1.MDPriorityNormal)
	if err != nil {
		return "", nil, err
	}
	s.fs.Add(fav, tlfFS)

	return toStrip, tlfFS.ToHTTPFileSystem(req.Context()), nil
}

// serve accetps "/<fs path>?token=<token>"
// For example:
//     /team/keybase/file.txt?token=1234567890abcdef1234567890abcdef
func (s *Server) serve(w http.ResponseWriter, req *http.Request) {
	token := req.URL.Query().Get("token")
	if len(token) == 0 || !s.tokens.Contains(token) {
		s.handleInvalidToken(w)
		return
	}
	toStrip, fs, err := s.getHTTPFileSystem(req)
	if err != nil {
		s.handleBadRequest(w)
		return
	}
	http.StripPrefix(toStrip, http.FileServer(fs)).ServeHTTP(w, req)
}

func overrideMimeType(ext, mimeType string) (newExt, newMimeType string) {
	// Send text/plain for all HTML and JS files to avoid them being executed
	// by the frontend WebView.
	lower := strings.ToLower(mimeType)
	if strings.Contains(lower, "javascript") ||
		strings.Contains(lower, "html") {
		return ext, "text/plain"
	}
	return ext, mimeType
}

const portStart = 7000
const portEnd = 8000
const requestPathRoot = "/files/"

// Init implements the libkbfs.LocalHTTPServer interface.
func (s *Server) Init(
	g *libkb.GlobalContext, config libkbfs.Config) (err error) {
	if s.tokens, err = lru.New(tokenCacheSize); err != nil {
		return err
	}
	if s.fs, err = lru.New(fsCacheSize); err != nil {
		return err
	}
	s.config = config
	s.server = libkb.NewHTTPSrv(
		g, libkb.NewPortRangeListenerSource(portStart, portEnd))
	// Have to start this first to populate the ServeMux object.
	if err = s.server.Start(); err != nil {
		return err
	}
	s.server.Handle(requestPathRoot,
		http.StripPrefix(requestPathRoot, http.HandlerFunc(s.serve)))
	libmime.Patch(overrideMimeType)
	return nil
}

// Address implements the libkbfs.LocalHTTPServer interface.
func (s *Server) Address() (string, error) {
	return s.server.Addr()
}

// Shutdown implements the libkbfs.LocalHTTPServer interface.
func (s *Server) Shutdown() {
	s.server.Stop()
}
