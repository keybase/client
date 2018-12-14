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
	"os"
	"path"
	"reflect"
	"strings"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/libmime"
	"github.com/keybase/kbfs/libpages/config"
	"github.com/keybase/kbfs/tlf"
	"go.uber.org/zap"
	"golang.org/x/crypto/acme"
	"golang.org/x/crypto/acme/autocert"
)

// ServerConfig holds configuration parameters for Server.
type ServerConfig struct {
	// If DomainWhitelist is non-nil and non-empty, only domains in the
	// whitelist are served and others are blocked.
	DomainWhitelist []string
	// If DomainBlacklist is non-nil and non-empty, domains in the blacklist
	// and all subdomains under them are blocked. When a domain is present in
	// both blacklist and whitelist, the domain is blocked.
	DomainBlacklist  []string
	UseStaging       bool
	Logger           *zap.Logger
	UseDiskCertCache bool
	StatsReporter    StatsReporter

	domainListsOnce sync.Once
	domainWhitelist map[string]bool
	domainBlacklist []string
}

// ErrDomainBlockedInBlacklist is returned when the server is configured
// with a domain blacklist, and we receive a HTTP request that was sent to a
// domain that's in the blacklist.
type ErrDomainBlockedInBlacklist struct{}

// Error implements the error interface.
func (ErrDomainBlockedInBlacklist) Error() string {
	return "a blacklist is configured and the given domain is in the list"
}

// ErrDomainNotAllowedInWhitelist is returned when the server is configured
// with a domain whitelist, and we receive a HTTP request that was sent to a
// domain that's not in the whitelist.
type ErrDomainNotAllowedInWhitelist struct{}

// Error implements the error interface.
func (ErrDomainNotAllowedInWhitelist) Error() string {
	return "a whitelist is configured and the given domain is not in the list"
}

func (c *ServerConfig) checkDomainLists(domain string) error {
	c.domainListsOnce.Do(func() {
		if len(c.DomainWhitelist) > 0 {
			c.domainWhitelist = make(map[string]bool, len(c.DomainWhitelist))
			for _, d := range c.DomainWhitelist {
				c.domainWhitelist[strings.ToLower(strings.TrimSpace(d))] = true
			}
		}
		if len(c.DomainBlacklist) > 0 {
			c.domainBlacklist = make([]string, len(c.DomainBlacklist))
			for i, d := range c.DomainBlacklist {
				c.domainBlacklist[i] = strings.ToLower(strings.TrimSpace(d))
			}
		}
	})

	for _, blocked := range c.domainBlacklist {
		if strings.HasSuffix(domain, blocked) {
			return ErrDomainBlockedInBlacklist{}
		}
	}
	if len(c.domainWhitelist) > 0 && !c.domainWhitelist[domain] {
		return ErrDomainNotAllowedInWhitelist{}
	}

	// No domainWhitelist; allow everything!
	return nil
}

const fsCacheSize = 2 << 15

// Server handles incoming HTTP requests by creating a Root for each host and
// serving content from it.
type Server struct {
	config     *ServerConfig
	kbfsConfig libkbfs.Config

	rootLoader RootLoader
	siteCache  *lru.Cache
}

func (s *Server) getSite(ctx context.Context, root Root) (st *site, err error) {
	siteCached, ok := s.siteCache.Get(root)
	if ok {
		if st, ok := siteCached.(*site); ok {
			if !st.fs.IsObsolete() {
				return st, nil
			}
			s.config.Logger.Info("fs end of life",
				zap.String("root", fmt.Sprintf("%#+v", root)))
		}
		s.config.Logger.Error("nasty entry in s.siteCache",
			zap.String("reflect_type", reflect.TypeOf(siteCached).String()))
	}
	fs, tlfID, fsShutdown, err := root.MakeFS(ctx, s.config.Logger, s.kbfsConfig)
	if err != nil {
		return nil, err
	}
	var added bool
	defer func() {
		// This is in case there's a panic before we get to add st into
		// s.siteCache.
		if !added {
			fsShutdown()
		}
	}()
	st = makeSite(fs, tlfID, fsShutdown, root)
	s.siteCache.Add(root, st)
	added = true
	return st, nil
}

func (s *Server) siteCacheEvict(_ interface{}, value interface{}) {
	if s, ok := value.(*site); ok {
		// It's possible to have a race here where a site gets evicted by the
		// LRU cache while the server is still using it to serve a request. But
		// since the cache is LRU, this should almost never happen given a
		// sufficiently large cache, and under the assumption that serving a
		// request won't take super long.
		s.shutdown()
		return
	}
	s.config.Logger.Error("nasty entry in s.siteCache",
		zap.String("reflect_type", reflect.TypeOf(value).String()))
}

func (s *Server) handleError(w http.ResponseWriter, err error) {
	// TODO: have a nicer error page for configuration errors?
	switch err.(type) {
	case nil:
	case ErrKeybasePagesRecordNotFound,
		ErrDomainNotAllowedInWhitelist, ErrDomainBlockedInBlacklist:
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	case ErrKeybasePagesRecordTooMany, ErrInvalidKeybasePagesRecord:
		http.Error(w, err.Error(), http.StatusPreconditionFailed)
		return
	case config.ErrDuplicateAccessControlPath, config.ErrInvalidPermissions,
		config.ErrInvalidVersion, config.ErrUndefinedUsername:
		http.Error(w, "invalid .kbp_config", http.StatusPreconditionFailed)
		return
	default:
		// Don't write unknown errors in case we leak data unintentionally.
		http.Error(w, "", http.StatusInternalServerError)
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

func (s *Server) handleUnauthorized(w http.ResponseWriter,
	r *http.Request, realm string, authorizationPossible bool) {
	if authorizationPossible {
		w.Header().Set("WWW-Authenticate", fmt.Sprintf("Basic realm=%s", realm))
		w.WriteHeader(http.StatusUnauthorized)
	} else {
		w.WriteHeader(http.StatusForbidden)
	}
}

func (s *Server) isDirWithNoIndexHTML(
	realFS *libfs.FS, requestPath string) (bool, error) {
	fi, err := realFS.Stat(strings.Trim(path.Clean(requestPath), "/"))
	switch {
	case os.IsNotExist(err):
		// It doesn't exist! So just let the http package handle it.
		return false, nil
	case err != nil:
		// Some other error happened. To be safe, error here.
		return false, err
	default:
		// continue
	}

	if !fi.IsDir() {
		return false, nil
	}

	fi, err = realFS.Stat(path.Join(requestPath, "index.html"))
	switch {
	case err == nil:
		return false, nil
	case os.IsNotExist(err):
		return true, nil
	default:
		// Some other error happened. To be safe, error here.
		return false, err
	}
}

// ServedRequestInfo holds information regarding to an incoming request
// that might be useful for stats.
type ServedRequestInfo struct {
	// Host is the `Host` field of http.Request.
	Host string
	// Proto is the `Proto` field of http.Request.
	Proto string
	// Authenticated means the client set WWW-Authenticate in this request and
	// authentication using the given credentials has succeeded. It doesn't
	// necessarily indicate that the authentication is required for this
	// particular request.
	Authenticated bool
	// TlfID is the TLF ID associated with the site.
	TlfID tlf.ID
	// TlfType is the TLF type of the root that's used to serve the request.
	TlfType tlf.Type
	// RootType is the type of the root that's used to serve the request.
	RootType RootType
	// HTTPStatus is the HTTP status code that we have written for the request
	// in the response header.
	HTTPStatus int
	// CloningShown is set to true if a "CLONING" page instead of the real site
	// was served to the request.
	CloningShown bool
	// InvalidConfig is set to true if user has a config for the site being
	// requested, but it's invalid.
	InvalidConfig bool
}

type statusCodePeekingResponseWriter struct {
	w    http.ResponseWriter
	code *int
}

var _ http.ResponseWriter = statusCodePeekingResponseWriter{}

func (w statusCodePeekingResponseWriter) Header() http.Header {
	return w.w.Header()
}

func (w statusCodePeekingResponseWriter) WriteHeader(status int) {
	if *w.code == 0 {
		*w.code = status
	}
	w.w.WriteHeader(status)
}

func (w statusCodePeekingResponseWriter) Write(data []byte) (int, error) {
	if *w.code == 0 {
		*w.code = http.StatusOK
	}
	return w.w.Write(data)
}

func (s *ServedRequestInfo) wrapResponseWriter(
	w http.ResponseWriter) http.ResponseWriter {
	return statusCodePeekingResponseWriter{w: w, code: &s.HTTPStatus}
}

func (s *Server) logRequest(sri *ServedRequestInfo, requestPath string, startTime time.Time, err *error) {
	s.config.Logger.Info("ReqProcessed",
		zap.String("host", sri.Host),
		zap.String("path", requestPath),
		zap.String("proto", sri.Proto),
		zap.String("tlf_id", sri.TlfID.String()),
		zap.Int("http_status", sri.HTTPStatus),
		zap.Bool("authenticated", sri.Authenticated),
		zap.Bool("cloning_shown", sri.CloningShown),
		zap.Bool("invalid_config", sri.InvalidConfig),
		zap.Duration("duration", time.Since(startTime)),
		zap.NamedError("pre_FileServer_error", *err),
	)
}

func (s *Server) setCommonResponseHeaders(w http.ResponseWriter) {
	// Enforce XSS protection. References:
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection
	// https://blog.innerht.ml/the-misunderstood-x-xss-protection/
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	// Only allow HTTPS on this domain, and make this policy expire in a
	// week. This means if user decides to migrate off Keybase Pages, there's a
	// 1-week gap before they can use HTTP again. Note that we don't use the
	// 'preload' directive, for the same reason we use 302 instead of 301 for
	// HTTP->HTTPS redirection. Reference: https://hstspreload.org/#opt-in
	w.Header().Set("Strict-Transport-Security", "max-age=604800")
	// TODO: allow user to opt-in some directives of Content-Security-Policy?
}

// ServeHTTP implements the http.Handler interface.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	sri := &ServedRequestInfo{
		Proto: r.Proto,
		Host:  r.Host,
	}
	w = sri.wrapResponseWriter(w)
	if s.config.StatsReporter != nil {
		defer s.config.StatsReporter.ReportServedRequest(sri)
	}

	var err error
	defer s.logRequest(sri, r.URL.Path, startTime, &err)

	if err = s.config.checkDomainLists(r.Host); err != nil {
		s.handleError(w, err)
		return
	}

	s.setCommonResponseHeaders(w)

	// Don't serve the config file itself.
	if path.Clean(strings.ToLower(r.URL.Path)) == config.DefaultConfigFilepath {
		// TODO: integrate this check into Config?
		http.Error(w, fmt.Sprintf("Reading %s directly is forbidden.",
			config.DefaultConfigFilepath), http.StatusForbidden)
		return
	}

	// Construct a *site from DNS record.
	root, err := s.rootLoader.LoadRoot(r.Host)
	if err != nil {
		s.handleError(w, err)
		return
	}
	sri.TlfType, sri.RootType = root.TlfType, root.Type
	ctx := libfs.EnableFastMode(
		libkbfs.CtxWithRandomIDReplayable(r.Context(),
			CtxKBPKey, CtxKBPOpID, adaptedLogger{
				msg:    "CtxWithRandomIDReplayable",
				logger: s.config.Logger,
			}),
	)
	st, err := s.getSite(ctx, root)
	if err != nil {
		s.handleError(w, err)
		return
	}
	sri.TlfID = st.tlfID

	realFS, err := st.fs.Use()
	if err != nil {
		s.handleError(w, err)
		return
	}

	// Get a site config, which can be either a user-defined one, or the
	// default one if it's missing from the site root.
	cfg, err := st.getConfig(false)
	if err != nil {
		// User has a .kbp_config file but it's invalid.
		// TODO: error page to show the error message?
		sri.InvalidConfig = true
		s.handleError(w, err)
		return
	}

	var username *string
	user, pass, ok := r.BasicAuth()
	if ok && cfg.Authenticate(r.Context(), user, pass) {
		sri.Authenticated = true
		username = &user
	}
	canRead, canList, possibleRead, possibleList,
		realm, err := cfg.GetPermissions(r.URL.Path, username)
	if err != nil {
		s.handleError(w, err)
		return
	}

	// Check if it's a directory containing no index.html before letting
	// http.FileServer handle it.  This permission check should ideally
	// happen inside the http package, but unfortunately there isn't a
	// way today.
	isListing, err := s.isDirWithNoIndexHTML(realFS, r.URL.Path)
	if err != nil {
		s.handleError(w, err)
		return
	}

	if isListing && !canList {
		s.handleUnauthorized(w, r, realm, possibleList)
		return
	}

	if !isListing && !canRead {
		s.handleUnauthorized(w, r, realm, possibleRead)
		return
	}

	http.FileServer(realFS.ToHTTPFileSystem(ctx)).ServeHTTP(w, r)
}

// allowDomain is used to determine whether a given domain should be
// served. It's also used as a HostPolicy in autocert package.
func (s *Server) allowDomain(ctx context.Context, host string) (err error) {
	host = strings.ToLower(strings.TrimSpace(host))
	if err = s.config.checkDomainLists(host); err != nil {
		return err
	}

	// DoS protection: look up kbp TXT record before attempting ACME cert
	// issuance, and only allow those that have DNS records configured. This is
	// in case someone keeps sending us TLS handshakes with random SNIs,
	// causing us to be rate-limited by the ACME server.
	//
	// TODO: cache the parsed root somewhere so we don't end up doing it twice
	// for each connection.
	if _, err = s.rootLoader.LoadRoot(host); err != nil {
		return err
	}

	return nil
}

const (
	gracefulShutdownTimeout = 16 * time.Second
	httpReadHeaderTimeout   = 8 * time.Second
	httpIdleTimeout         = 1 * time.Minute
	stagingDiskCacheName    = "./kbp-cert-cache-staging"
	prodDiskCacheName       = "./kbp-cert-cache"
)

func makeACMEManager(
	useStaging bool, useDiskCertCacache bool, hostPolicy autocert.HostPolicy) (
	*autocert.Manager, error) {
	manager := &autocert.Manager{
		Prompt:     autocert.AcceptTOS,
		HostPolicy: hostPolicy,
	}

	if useDiskCertCacache {
		if useStaging {
			manager.Cache = autocert.DirCache(stagingDiskCacheName)
		} else {
			manager.Cache = autocert.DirCache(prodDiskCacheName)
		}
	}

	if useStaging {
		acmeKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return nil, err
		}
		manager.Client = &acme.Client{
			DirectoryURL: "https://acme-staging.api.letsencrypt.org/directory",
			Key:          acmeKey,
		}
	}

	return manager, nil
}

// ListenAndServe listens on 443 and 80 ports of all addresses, and serve
// Keybase Pages based on config and kbfsConfig. HTTPs setup is handled with
// ACME.
func ListenAndServe(ctx context.Context,
	config *ServerConfig, kbfsConfig libkbfs.Config) (err error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	libmime.Patch(nil)

	server := &Server{
		config:     config,
		kbfsConfig: kbfsConfig,
		rootLoader: DNSRootLoader{log: config.Logger},
	}
	server.siteCache, err = lru.NewWithEvict(fsCacheSize, server.siteCacheEvict)
	if err != nil {
		return err
	}

	manager, err := makeACMEManager(
		config.UseStaging, config.UseDiskCertCache, server.allowDomain)
	if err != nil {
		return err
	}

	httpsServer := http.Server{
		Handler:           server,
		ReadHeaderTimeout: httpReadHeaderTimeout,
		IdleTimeout:       httpIdleTimeout,
	}

	httpServer := http.Server{
		Addr: ":80",
		// Enable http-01 by calling the HTTPHandler method, and set the
		// fallback HTTP handler to nil. As described in the autocert doc
		// (https://github.com/golang/crypto/blob/13931e22f9e72ea58bb73048bc752b48c6d4d4ac/acme/autocert/autocert.go#L248-L251),
		// this means for requests not for ACME domain verification, a default
		// fallback handler is used, which redirects all HTTP traffic using GET
		// and HEAD to HTTPS using 302 Found, and responds with 400 Bad Request
		// for requests with other methods.
		Handler:           manager.HTTPHandler(nil),
		ReadHeaderTimeout: httpReadHeaderTimeout,
		IdleTimeout:       httpIdleTimeout,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(
			context.Background(), gracefulShutdownTimeout)
		defer cancel()
		httpsServer.Shutdown(shutdownCtx)
		httpServer.Shutdown(shutdownCtx)
	}()

	go func() {
		err := httpServer.ListenAndServe()
		if err != nil {
			config.Logger.Error("http.ListenAndServe:80", zap.Error(err))
		}
	}()

	return httpsServer.Serve(manager.Listener())
}
