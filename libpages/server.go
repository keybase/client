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
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/libpages/config"
	"github.com/keybase/kbfs/tlf"
	"go.uber.org/zap"
	"golang.org/x/crypto/acme"
	"golang.org/x/crypto/acme/autocert"
)

// ServerConfig holds configuration parameters for Server.
type ServerConfig struct {
	DomainWhitelist  []string
	UseStaging       bool
	Logger           *zap.Logger
	UseDiskCertCache bool
	StatsReporter    StatsReporter

	domainWhitelistOnce sync.Once
	domainWhitelist     map[string]bool
}

func (c *ServerConfig) allowedByDomainWhiteList(domain string) bool {
	c.domainWhitelistOnce.Do(func() {
		if len(c.DomainWhitelist) > 0 {
			c.domainWhitelist = make(map[string]bool, len(c.DomainWhitelist))
			for _, d := range c.DomainWhitelist {
				c.domainWhitelist[d] = true
			}
		}
	})
	if c.domainWhitelist != nil {
		return c.domainWhitelist[domain]
	}

	// No domainWhitelist; allow everything!
	return true
}

const fsCacheSize = 2 << 15

// Server handles incoming HTTP requests by creating a Root for each host and
// serving content from it.
type Server struct {
	config     *ServerConfig
	kbfsConfig libkbfs.Config

	siteCache *lru.Cache
}

func (s *Server) getSite(ctx context.Context, root Root) (st *site, err error) {
	siteCached, ok := s.siteCache.Get(root)
	if ok {
		if s, ok := siteCached.(*site); ok {
			return s, nil
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

func (s *Server) handleErrorAndPopulateSRI(
	w http.ResponseWriter, err error, sri *ServedRequestInfo) {
	// TODO: have a nicer error page for configuration errors?
	switch err.(type) {
	case nil:
	case ErrKeybasePagesRecordNotFound:
		sri.HTTPStatus = http.StatusServiceUnavailable
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	case ErrKeybasePagesRecordTooMany, ErrInvalidKeybasePagesRecord:
		sri.HTTPStatus = http.StatusPreconditionFailed
		http.Error(w, err.Error(), http.StatusPreconditionFailed)
		return
	default:
		sri.HTTPStatus = http.StatusInternalServerError
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

func (s *Server) handleNeedAuthenticationAndPopulateSRI(
	w http.ResponseWriter, r *http.Request, realm string,
	sri *ServedRequestInfo) {
	w.Header().Set("WWW-Authenticate", fmt.Sprintf("Basic realm=%s", realm))
	sri.HTTPStatus = http.StatusUnauthorized
	w.WriteHeader(http.StatusUnauthorized)
}

func (s *Server) isDirWithNoIndexHTML(
	st *site, requestPath string) (bool, error) {
	fi, err := st.fs.Stat(strings.Trim(path.Clean(requestPath), "/"))
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

	fi, err = st.fs.Stat(path.Join(requestPath, "index.html"))
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

const cloningFilename = "CLONING"
const gitRootInitialTimeout = time.Second

func (s *Server) shouldShowCloningLandingPage(st *site) (bool, error) {
	if st.root.Type != GitRoot {
		// CLONING file only matters for git roots.
		return false, nil
	}
	ctxInitialRead, cancel := context.WithTimeout(
		context.Background(), gitRootInitialTimeout)
	defer cancel()
	ctxInitialRead, err := libkbfs.NewContextWithCancellationDelayer(
		libkbfs.CtxWithRandomIDReplayable(ctxInitialRead,
			ctxIDKey, ctxOpID, nil))
	if err != nil {
		return false, err
	}
	// Read under timeout to trigger a clone in case this is an initial
	// request. This should only happen to the first ever access to a site
	// backed by this git repo.
	_, err = st.fs.WithContext(ctxInitialRead).ReadDir("/")
	switch err {
	case nil, context.DeadlineExceeded, context.Canceled:
		// Assume we have triggered a clone or pull and carry on.
	default:
		return false, err
	}
	_, err = st.fs.Stat(cloningFilename)
	switch {
	case err == nil:
		return true, nil
	case os.IsNotExist(err):
		return false, nil
	default:
		return false, err
	}

}

// TODO: replace this with something nicer when fancy error pages and landing
// pages are ready.
var cloningLandingPage = []byte(`
<!DOCTYPE html>
<html>
	<head>
		<meta charset="UTF-8">
		<meta http-equiv="refresh" content="5">
		<title>CLONING</title>
	</head>
	<body>
		Keybase Pages server is cloning your site.
		This page will refresh in 5 seconds...
	</body>
</html>
`)

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

func (s *Server) logRequest(sri *ServedRequestInfo, requestPath string) {
	s.config.Logger.Info("ReqIn",
		zap.String("host", sri.Host),
		zap.String("path", requestPath),
		zap.String("proto", sri.Proto),
		zap.String("tlf_id", sri.TlfID.String()),
		zap.Int("http_status", sri.HTTPStatus),
		zap.Bool("authenticated", sri.Authenticated),
		zap.Bool("cloning_shown", sri.CloningShown),
		zap.Bool("invalid_config", sri.InvalidConfig),
	)
}

// ServeHTTP implements the http.Handler interface.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	sri := &ServedRequestInfo{
		Proto: r.Proto,
		Host:  r.Host,
		// If we don't end up responding with 200, this field will be
		// overwritten when writing the header.
		HTTPStatus: http.StatusOK,
	}
	if s.config.StatsReporter != nil {
		defer s.config.StatsReporter.ReportServedRequest(sri)
	}
	defer s.logRequest(sri, r.URL.Path)

	// Don't serve the config file itself.
	if path.Clean(strings.ToLower(r.URL.Path)) == config.DefaultConfigFilepath {
		// TODO: integrate this check into Config?
		w.WriteHeader(http.StatusForbidden)
		fmt.Fprintf(w, "Reading %s directly is forbidden.",
			config.DefaultConfigFilepath)
		return
	}

	// Construct a *site from DNS record.
	root, err := LoadRootFromDNS(s.config.Logger, r.Host)
	if err != nil {
		s.handleErrorAndPopulateSRI(w, err, sri)
		return
	}
	sri.TlfType, sri.RootType = root.TlfType, root.Type
	ctx := libkbfs.CtxWithRandomIDReplayable(r.Context(),
		CtxKBPKey, CtxKBPOpID, adaptedLogger{
			msg:    "CtxWithRandomIDReplayable",
			logger: s.config.Logger,
		})
	st, err := s.getSite(ctx, root)
	if err != nil {
		s.handleErrorAndPopulateSRI(w, err, sri)
		return
	}
	sri.TlfID = st.tlfID

	// Show a landing page if site uses git root and has a CLONING file which
	// indicates we are still cloning the assets.
	shouldShowCloningLandingPage, err := s.shouldShowCloningLandingPage(st)
	if err != nil {
		s.handleErrorAndPopulateSRI(w, err, sri)
		return
	}
	if shouldShowCloningLandingPage {
		sri.CloningShown = true
		// TODO: replace this with something nicer when fancy error pages and
		// landing pages are ready.
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write(cloningLandingPage)
		return
	}

	// Get a site config, which can be either a user-defined one, or the
	// default one if it's missing from the site root.
	cfg, err := st.getConfig(false)
	if err != nil {
		// User has a .kbp_config file but it's invalid.
		// TODO: error page to show the error message?
		sri.InvalidConfig = true
		s.handleErrorAndPopulateSRI(w, err, sri)
		return
	}

	var canRead, canList bool
	var realm string
	user, pass, ok := r.BasicAuth()
	if ok && cfg.Authenticate(user, pass) {
		sri.Authenticated = true
		canRead, canList, realm, err = cfg.GetPermissionsForUsername(
			r.URL.Path, user)
	} else {
		canRead, canList, realm, err = cfg.GetPermissionsForAnonymous(
			r.URL.Path)
	}
	if err != nil {
		s.handleErrorAndPopulateSRI(w, err, sri)
		return
	}

	// Check if it's a directory containing no index.html before letting
	// http.FileServer handle it.  This permission check should ideally
	// happen inside the http package, but unfortunately there isn't a
	// way today.
	isListing, err := s.isDirWithNoIndexHTML(st, r.URL.Path)
	if err != nil {
		s.handleErrorAndPopulateSRI(w, err, sri)
		return
	}

	if isListing && !canList {
		s.handleNeedAuthenticationAndPopulateSRI(w, r, realm, sri)
		return
	}

	if !isListing && !canRead {
		s.handleNeedAuthenticationAndPopulateSRI(w, r, realm, sri)
		return
	}

	http.FileServer(st.getHTTPFileSystem(ctx)).ServeHTTP(w, r)
}

// ErrDomainNotAllowedInWhitelist is returned when the server is configured
// with a domain whitelist, and we receive a HTTP request that was sent to a
// domain that's not in the whitelist.
type ErrDomainNotAllowedInWhitelist struct{}

// Error implements the error interface.
func (ErrDomainNotAllowedInWhitelist) Error() string {
	return "a whitelist is configured and the given domain is not in the list"
}

// allowConnection is used as a HostPolicy in autocert package.
func (s *Server) allowConnectionTo(ctx context.Context, host string) error {
	if !s.config.allowedByDomainWhiteList(host) {
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

	server := &Server{
		config:     config,
		kbfsConfig: kbfsConfig,
	}
	server.siteCache, err = lru.NewWithEvict(fsCacheSize, server.siteCacheEvict)
	if err != nil {
		return err
	}

	manager, err := makeACMEManager(
		config.UseStaging, config.UseDiskCertCache, server.allowConnectionTo)
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
