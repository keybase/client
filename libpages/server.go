// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"
	"net/http"
	"reflect"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"go.uber.org/zap"
	"golang.org/x/crypto/acme"
	"golang.org/x/crypto/acme/autocert"
)

// ServerConfig holds configuration parameters for Server.
type ServerConfig struct {
	AutoDirectHTTP     bool
	DomainWhitelist    []string
	UseStaging         bool
	Logger             *zap.Logger
	UseDiskCacheForDev bool
}

const fsCacheSize = 2 << 15

// Server handles incoming HTTP requests by creating a Root for each host and
// serving content from it.
type Server struct {
	config     ServerConfig
	kbfsConfig libkbfs.Config

	fsCache *lru.Cache

	whiteList     map[string]bool
	whiteListOnce sync.Once
}

func (s *Server) getFS(
	ctx context.Context, root Root) (http.FileSystem, error) {
	fsCached, ok := s.fsCache.Get(root)
	if ok {
		if fs, ok := fsCached.(*libfs.FS); ok {
			return fs.ToHTTPFileSystem(ctx), nil
		}
		s.config.Logger.Error("nasty entry in s.fsCache",
			zap.String("type", reflect.TypeOf(fsCached).String()))
	}
	fs, err := root.MakeFS(ctx, s.config.Logger, s.kbfsConfig)
	if err != nil {
		return nil, err
	}
	s.fsCache.Add(root, fs)
	return fs.ToHTTPFileSystem(ctx), nil
}

func (s *Server) handleError(w http.ResponseWriter, err error) {
	// TODO: have a nicer error page for configuration errors?
	switch err.(type) {
	case nil:
	case ErrKeybasePagesRecordNotFound:
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	case ErrKeybasePagesRecordTooMany:
		w.WriteHeader(http.StatusPreconditionFailed)
		return
	case ErrInvalidKeybasePagesRecord:
		w.WriteHeader(http.StatusPreconditionFailed)
	default:
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

// CtxKBPTagKey is the type used for unique context tags within kbp and
// libpages.
type CtxKBPTagKey int

const (
	// CtxKBPKey is the tag key for unique operation IDs within kbp and
	// libpages.
	CtxKBPKey CtxKBPTagKey = iota
)

// CtxKBPOpID is the display name for unique operations in kbp and libpages.
const CtxKBPOpID = "KBP"

type adaptedLogger struct {
	msg    string
	logger *zap.Logger
}

func (a adaptedLogger) Warning(format string, args ...interface{}) {
	a.logger.Warn(a.msg, zap.String("desc", fmt.Sprintf(format, args...)))
}

// ServeHTTP implements the http.Handler interface.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.config.Logger.Info("ServeHTTP",
		zap.String("host", r.Host),
		zap.String("urk", r.RequestURI),
		zap.String("proto", r.Proto),
	)
	root, err := LoadRootFromDNS(s.config.Logger, r.Host)
	if err != nil {
		s.handleError(w, err)
		return
	}
	ctx := libkbfs.CtxWithRandomIDReplayable(r.Context(),
		CtxKBPKey, CtxKBPOpID, adaptedLogger{
			msg:    "CtxWithRandomIDReplayable",
			logger: s.config.Logger,
		})
	fs, err := s.getFS(ctx, root)
	if err != nil {
		s.handleError(w, err)
		return
	}
	http.FileServer(fs).ServeHTTP(w, r)
}

// ErrDomainNotAllowedInWhitelist is returned when the server is configured
// with a domain whitelist, and we receive a HTTP request that was sent to a
// domain that's not in the whitelist.
type ErrDomainNotAllowedInWhitelist struct{}

// Error implements the error interface.
func (ErrDomainNotAllowedInWhitelist) Error() string {
	return "a whitelist is configured and the given domain is not in the list"
}

func (s *Server) allowedByDomainWhiteList(domain string) bool {
	s.whiteListOnce.Do(func() {
		if len(s.config.DomainWhitelist) > 0 {
			s.whiteList = make(map[string]bool, len(s.config.DomainWhitelist))
			for _, d := range s.config.DomainWhitelist {
				s.whiteList[d] = true
			}
		}
	})
	if s.whiteList != nil {
		return s.whiteList[domain]
	}

	// No whitelist; allow everything!
	return true
}

// allowConnection is used as a HostPolicy in autocert package.
func (s *Server) allowConnectionTo(ctx context.Context, host string) error {
	if !s.allowedByDomainWhiteList(host) {
		return ErrDomainNotAllowedInWhitelist{}
	}

	// DoS protection: look up kbp TXT record before attempting ACME cert
	// issuance, and only allow those that have DNS records configured. This is
	// in case someone keeps sending us TLS handshakes with random SNIs,
	// causing us to be rate-limited by the ACME server.
	//
	// TODO: cache the parsed root somewhere so we don't end up doing it twice
	// for each connection.
	_, err := LoadRootFromDNS(s.config.Logger, host)
	if err != nil {
		return err
	}

	return nil
}

const (
	gracefulShutdownTimeout = 10 * time.Second
)

// ListenAndServe listens on 443 and 80 ports of all addresses, and serve
// Keybase Pages based on config and kbfsConfig. HTTPs setup is handled with
// ACME.
func ListenAndServe(ctx context.Context,
	config ServerConfig, kbfsConfig libkbfs.Config) (err error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	fsCache, err := lru.New(fsCacheSize)
	if err != nil {
		return err
	}
	server := &Server{
		config:     config,
		kbfsConfig: kbfsConfig,
		fsCache:    fsCache,
	}

	if config.AutoDirectHTTP {
		// TODO
	}

	manager := autocert.Manager{
		Prompt:     autocert.AcceptTOS,
		HostPolicy: server.allowConnectionTo,
	}

	if config.UseDiskCacheForDev {
		manager.Cache = autocert.DirCache("./kbp-cert-cache-dev")
	}

	if config.UseStaging {
		acmeKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return err
		}
		manager.Client = &acme.Client{
			DirectoryURL: "https://acme-staging.api.letsencrypt.org/directory",
			Key:          acmeKey,
		}
	}

	httpServer := http.Server{
		Handler: server,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(
			context.Background(), gracefulShutdownTimeout)
		defer cancel()
		httpServer.Shutdown(shutdownCtx)
	}()

	return httpServer.Serve(manager.Listener())
}
