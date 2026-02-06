// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"runtime/trace"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/status"
	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/fsrpc"
	"github.com/keybase/client/go/kbfs/libgit"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/simplefs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/client/go/uidmap"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

var (
	kbCtx          *libkb.GlobalContext
	kbChatCtx      *globals.ChatContext
	kbSvc          *service.Service
	conn           net.Conn
	startOnce      sync.Once
	logSendContext status.LogSendContext
)

var (
	initMutex    sync.Mutex
	initComplete bool
)

// JS readiness synchronization
var (
	jsReadyOnce sync.Once
	jsReadyCh   = make(chan struct{})
	connMutex   sync.Mutex // Protects conn operations
)

// log writes to kbCtx.Log if available, otherwise falls back to fmt.Printf
func log(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	if kbCtx != nil && kbCtx.Log != nil {
		kbCtx.Log.Info(msg)
	} else {
		fmt.Printf("%s\n", msg)
	}
}

type PushNotifier interface {
	LocalNotification(ident string, msg string, badgeCount int, soundName string, convID string, typ string)
	DisplayChatNotification(notification *ChatNotification)
}

type NativeVideoHelper interface {
	Thumbnail(filename string) []byte
	Duration(filename string) int
}

// ShareIntentDonator is implemented by the native iOS layer to donate INSendMessageIntent
// for recent conversations. When nil (Android, desktop), donations are skipped.
// Uses JSON string because gomobile does not support []struct in interface methods.
type ShareIntentDonator interface {
	DonateShareConversations(conversationsJSON string)
	DeleteAllDonations()
	DeleteDonationByConversationID(conversationID string)
}

// shareIntentDonatorAdapter adapts keybase.ShareIntentDonator to types.ShareIntentDonator.
type shareIntentDonatorAdapter struct {
	wrapped ShareIntentDonator
}

func (a shareIntentDonatorAdapter) DonateShareConversations(conversations []types.ShareConversation) {
	if a.wrapped == nil {
		return
	}
	// Serialize to JSON; gomobile does not support []struct in interface methods.
	data, err := json.Marshal(conversations)
	if err != nil {
		log("shareIntentDonatorAdapter: JSON marshal failed: %v", err)
		return
	}
	a.wrapped.DonateShareConversations(string(data))
}

func (a shareIntentDonatorAdapter) DeleteAllDonations() {
	if a.wrapped == nil {
		return
	}
	a.wrapped.DeleteAllDonations()
}

func (a shareIntentDonatorAdapter) DeleteDonationByConversationID(conversationID string) {
	if a.wrapped == nil {
		return
	}
	a.wrapped.DeleteDonationByConversationID(conversationID)
}

// NativeInstallReferrerListener is implemented in Java on Android.
type NativeInstallReferrerListener interface {
	// StartInstallReferrerListener is used to get referrer information from the
	// google play store on Android (to implement deferred deep links). This is
	// asynchronous (due to the underlying play store api being so): pass it a
	// callback function which will be called with the referrer string once it
	// is available (or an empty string in case of errors).
	StartInstallReferrerListener(callback StringReceiver)
}

type StringReceiver interface {
	CallbackWithString(s string)
}

// InstallReferrerListener is a wrapper around NativeInstallReferrerListener to
// work around gomobile/gobind limitations while preventing import cycles.
type InstallReferrerListener struct {
	n NativeInstallReferrerListener
}

func (i InstallReferrerListener) StartInstallReferrerListener(callback service.StringReceiver) {
	i.n.StartInstallReferrerListener(callback)
}

var _ service.InstallReferrerListener = InstallReferrerListener{}

func newInstallReferrerListener(n NativeInstallReferrerListener) service.InstallReferrerListener {
	return InstallReferrerListener{n: n}
}

type videoHelper struct {
	nvh NativeVideoHelper
}

func newVideoHelper(nvh NativeVideoHelper) videoHelper {
	return videoHelper{
		nvh: nvh,
	}
}

func (v videoHelper) ThumbnailAndDuration(ctx context.Context, filename string) ([]byte, int, error) {
	return v.nvh.Thumbnail(filename), v.nvh.Duration(filename), nil
}

type ExternalDNSNSFetcher interface {
	GetServers() []byte
}

type dnsNSFetcher struct {
	externalFetcher ExternalDNSNSFetcher
}

func newDNSNSFetcher(d ExternalDNSNSFetcher) dnsNSFetcher {
	return dnsNSFetcher{
		externalFetcher: d,
	}
}

func (d dnsNSFetcher) processExternalResult(raw []byte) []string {
	return strings.Split(string(raw), ",")
}

func (d dnsNSFetcher) GetServers() []string {
	if d.externalFetcher != nil {
		return d.processExternalResult(d.externalFetcher.GetServers())
	}
	return getDNSServers()
}

var _ libkb.DNSNameServerFetcher = dnsNSFetcher{}

func flattenError(err error) error {
	if err != nil {
		return errors.New(err.Error())
	}
	return err
}

func isInited() bool {
	initMutex.Lock()
	defer initMutex.Unlock()
	return initComplete
}

func setInited() {
	initMutex.Lock()
	defer initMutex.Unlock()
	initComplete = true
}

// InitOnce runs the Keybase services (only runs one time)
func InitOnce(homeDir, mobileSharedHome, logFile, runModeStr string,
	accessGroupOverride bool, dnsNSFetcher ExternalDNSNSFetcher, nvh NativeVideoHelper,
	mobileOsVersion string, isIPad bool, installReferrerListener NativeInstallReferrerListener, isIOS bool,
	shareIntentDonator ShareIntentDonator,
) {
	startOnce.Do(func() {
		if err := Init(homeDir, mobileSharedHome, logFile, runModeStr, accessGroupOverride, dnsNSFetcher, nvh, mobileOsVersion, isIPad, installReferrerListener, isIOS, shareIntentDonator); err != nil {
			kbCtx.Log.Errorf("Init error: %s", err)
		}
	})
}

// Init runs the Keybase services
func Init(homeDir, mobileSharedHome, logFile, runModeStr string,
	accessGroupOverride bool, externalDNSNSFetcher ExternalDNSNSFetcher, nvh NativeVideoHelper,
	mobileOsVersion string, isIPad bool, installReferrerListener NativeInstallReferrerListener, isIOS bool,
	shareIntentDonator ShareIntentDonator,
) (err error) {
	// better crash logging
	os.Setenv("GOTRACEBACK", "crash")
	debug.SetTraceback("all")

	begin := time.Now()
	log("Go: Initializing: home: %s mobileSharedHome: %s", homeDir, mobileSharedHome)
	defer func() {
		err = flattenError(err)
		if err == nil {
			setInited()
		}
		log("Go: Init complete: %v err: %v", time.Since(begin), err)
	}()

	if isIOS {
		// buffer of bytes
		buffer = make([]byte, 300*1024)
	} else {
		const targetBufferSize = 300 * 1024
		// bufferSize must be divisible by 3 to ensure that we don't split
		// our b64 encode across a payload boundary if we go over our buffer
		// size.
		const bufferSize = targetBufferSize - (targetBufferSize % 3)
		// buffer for the conn.Read
		buffer = make([]byte, bufferSize)
	}

	var perfLogFile, ekLogFile, guiLogFile string
	if logFile != "" {
		log("Go: Using log: %s", logFile)
		ekLogFile = logFile + ".ek"
		log("Go: Using eklog: %s", ekLogFile)
		perfLogFile = logFile + ".perf"
		log("Go: Using perfLog: %s", perfLogFile)
		guiLogFile = logFile + ".gui"
		log("Go: Using guilog: %s", guiLogFile)
	}
	libkb.IsIPad = isIPad

	// Reduce OS threads on mobile so we don't have too much contention with JS thread
	// oldProcs := runtime.GOMAXPROCS(0)
	// newProcs := oldProcs - 2
	// if newProcs <= 0 {
	// 	newProcs = 1
	// }
	// runtime.GOMAXPROCS(newProcs)
	// fmt.Printf("Go: setting GOMAXPROCS to: %d previous: %d\n", newProcs, oldProcs)

	startTrace(logFile)

	dnsNSFetcher := newDNSNSFetcher(externalDNSNSFetcher)
	dnsServers := dnsNSFetcher.GetServers()
	for _, srv := range dnsServers {
		log("Go: DNS Server: %s", srv)
	}

	kbCtx = libkb.NewGlobalContext()
	kbCtx.Init()
	kbCtx.SetProofServices(externals.NewProofServices(kbCtx))

	var suffix string
	if isIPad {
		suffix = " (iPad)"
	}
	log("Go (GOOS:%s): Mobile OS version is: %q%v", runtime.GOOS, mobileOsVersion, suffix)
	kbCtx.MobileOsVersion = mobileOsVersion

	// 10k uid -> FullName cache entries allowed
	kbCtx.SetUIDMapper(uidmap.NewUIDMap(10000))
	kbCtx.SetServiceSummaryMapper(uidmap.NewServiceSummaryMap(1000))
	usage := libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
	runMode, err := libkb.StringToRunMode(runModeStr)
	if err != nil {
		return err
	}
	config := libkb.AppConfig{
		HomeDir:                        homeDir,
		MobileSharedHomeDir:            mobileSharedHome,
		LogFile:                        logFile,
		EKLogFile:                      ekLogFile,
		PerfLogFile:                    perfLogFile,
		GUILogFile:                     guiLogFile,
		RunMode:                        runMode,
		Debug:                          true,
		LocalRPCDebug:                  "",
		VDebugSetting:                  "mobile", // use empty string for same logging as desktop default
		SecurityAccessGroupOverride:    accessGroupOverride,
		ChatInboxSourceLocalizeThreads: 2,
		LinkCacheSize:                  1000,
	}
	if err = kbCtx.Configure(config, usage); err != nil {
		log("failed to configure: %s", err)
		return err
	}

	kbSvc = service.NewService(kbCtx, false)
	if err = kbSvc.StartLoopbackServer(libkb.LoginAttemptOffline); err != nil {
		log("failed to start loopback: %s", err)
		return err
	}
	kbCtx.SetService()
	uir := service.NewUIRouter(kbCtx)
	kbCtx.SetUIRouter(uir)
	kbCtx.SetDNSNameServerFetcher(dnsNSFetcher)
	if err = kbSvc.SetupCriticalSubServices(); err != nil {
		log("failed subservices setup: %s", err)
		return err
	}
	kbSvc.SetupChatModules(nil)
	if installReferrerListener != nil {
		kbSvc.SetInstallReferrerListener(newInstallReferrerListener(installReferrerListener))
	}
	kbSvc.RunBackgroundOperations(uir)
	kbChatCtx = kbSvc.ChatG()
	kbChatCtx.NativeVideoHelper = newVideoHelper(nvh)
	if shareIntentDonator != nil {
		kbChatCtx.ShareIntentDonator = shareIntentDonatorAdapter{wrapped: shareIntentDonator}
	}

	logs := status.Logs{
		Service: config.GetLogFile(),
		EK:      config.GetEKLogFile(),
		Perf:    config.GetPerfLogFile(),
	}

	log("Go: Using config: %+v", kbCtx.Env.GetLogFileConfig(config.GetLogFile()))

	logSendContext = status.LogSendContext{
		Contextified: libkb.NewContextified(kbCtx),
		Logs:         logs,
	}

	// open the connection
	if err = Reset(); err != nil {
		log("failed conn setup %s", err)
		return err
	}

	go func() {
		kbfsCtx := env.NewContextFromGlobalContext(kbCtx)
		kbfsParams := libkbfs.DefaultInitParams(kbfsCtx)
		// Setting this flag will enable KBFS debug logging to always
		// be true in a mobile setting. Change these back to the
		// commented-out values if we need to make a mobile release
		// before KBFS-on-mobile is ready.
		kbfsParams.Debug = true                         // false
		kbfsParams.Mode = libkbfs.InitConstrainedString // libkbfs.InitMinimalString
		if _, err = libkbfs.Init(
			context.Background(), kbfsCtx, kbfsParams, serviceCn{}, nil,
			kbCtx.Log); err != nil {
			log("unable to init KBFS: %s", err)
		}
	}()

	return nil
}

func LogToService(str string) {
	kbCtx.Log.Info(str)
}

type serviceCn struct{}

func (s serviceCn) NewKeybaseService(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.KeybaseService, error) {
	// TODO: plumb the func somewhere it can be called on shutdown?
	gitrpc, _ := libgit.NewRPCHandlerWithCtx(
		ctx, config, nil)
	sfsIface, _ := simplefs.NewSimpleFS(ctx, config)
	additionalProtocols := []rpc.Protocol{
		keybase1.SimpleFSProtocol(sfsIface),
		keybase1.KBFSGitProtocol(gitrpc),
		keybase1.FsProtocol(fsrpc.NewFS(config, log)),
	}
	keybaseService := libkbfs.NewKeybaseDaemonRPC(
		config, ctx, log, true, additionalProtocols)
	return keybaseService, nil
}

func (s serviceCn) NewCrypto(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.Crypto, error) {
	return libkbfs.NewCryptoClientRPC(config, ctx), nil
}

func (s serviceCn) NewChat(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.Chat, error) {
	return libkbfs.NewChatRPC(config, ctx), nil
}

// LogSend sends a log to Keybase
func LogSend(statusJSON string, feedback string, sendLogs, sendMaxBytes bool, traceDir, cpuProfileDir string) (res string, err error) {
	defer func() { err = flattenError(err) }()
	env := kbCtx.Env
	logSendContext.UID = env.GetUID()
	logSendContext.InstallID = env.GetInstallID()
	logSendContext.StatusJSON = statusJSON
	logSendContext.Feedback = feedback
	logSendContext.Logs.GUI = env.GetGUILogFile()
	logSendContext.Logs.Trace = traceDir
	logSendContext.Logs.CPUProfile = cpuProfileDir
	var numBytes int
	switch kbCtx.MobileNetState.State() {
	case keybase1.MobileNetworkState_WIFI:
		numBytes = status.LogSendDefaultBytesMobileWifi
	default:
		numBytes = status.LogSendDefaultBytesMobileNoWifi
	}
	if sendMaxBytes {
		numBytes = status.LogSendMaxBytes
	}

	logSendID, err := logSendContext.LogSend(sendLogs, numBytes, true /* mergeExtendedStatus */, true /* addNetworkStats */)
	logSendContext.Clear()
	return string(logSendID), err
}

// WriteArr sends raw bytes encoded msgpack rpc payload, ios only
func WriteArr(b []byte) (err error) {
	bytes := make([]byte, len(b))
	copy(bytes, b)
	defer func() { err = flattenError(err) }()

	// Lazily initialize connection on first write
	connMutex.Lock()
	if conn == nil {
		if err := ensureConnection(); err != nil {
			connMutex.Unlock()
			return fmt.Errorf("Failed to establish connection: %s", err)
		}
	}
	currentConn := conn
	connMutex.Unlock()

	if currentConn == nil {
		return errors.New("connection not initialized")
	}

	n, err := currentConn.Write(bytes)
	if err != nil {
		return fmt.Errorf("Write error: %s", err)
	}
	if n != len(bytes) {
		return errors.New("Did not write all the data")
	}
	return nil
}

const bufferSize = 1024 * 1024

// buffer for the conn.Read
var buffer = make([]byte, bufferSize)

// ReadArr is a blocking read for msgpack rpc data.
// It is called serially by the mobile run loops.
func ReadArr() (data []byte, err error) {
	defer func() { err = flattenError(err) }()

	// Wait for JS to signal it's ready (only blocks once)
	<-jsReadyCh

	// Lazily initialize connection on first read
	connMutex.Lock()
	if conn == nil {
		if err := ensureConnection(); err != nil {
			connMutex.Unlock()
			return nil, fmt.Errorf("Failed to establish connection: %s", err)
		}
	}
	currentConn := conn
	connMutex.Unlock()

	if currentConn == nil {
		return nil, errors.New("connection not initialized")
	}

	n, err := currentConn.Read(buffer)
	if n > 0 && err == nil {
		return buffer[0:n], nil
	}

	if err != nil {
		// Attempt to fix the connection
		if ierr := Reset(); ierr != nil {
			log("failed to Reset: %v", ierr)
		}
		return nil, fmt.Errorf("Read error: %s", err)
	}

	return nil, nil
}

// ensureConnection establishes the loopback connection if not already connected.
// Must be called with connMutex held.
func ensureConnection() error {
	if !isInited() {
		return errors.New("keybase not initialized")
	}
	if kbCtx == nil || kbCtx.LoopbackListener == nil {
		return errors.New("loopback listener not initialized")
	}

	var err error
	conn, err = kbCtx.LoopbackListener.Dial()
	if err != nil {
		return fmt.Errorf("Failed to dial loopback listener: %s", err)
	}
	log("Go: Established loopback connection")
	return nil
}

// Reset resets the socket connection
func Reset() error {
	connMutex.Lock()
	defer connMutex.Unlock()

	if conn != nil {
		conn.Close()
		conn = nil
	}
	if kbCtx == nil || kbCtx.LoopbackListener == nil {
		return nil
	}

	// Connection will be re-established lazily on next read/write
	log("Go: Connection reset, will reconnect on next operation")
	return nil
}

// NotifyJSReady signals that the JavaScript side is ready to send/receive RPCs.
// This unblocks the ReadArr loop and allows bidirectional communication.
func NotifyJSReady() {
	jsReadyOnce.Do(func() {
		log("Go: JS signaled ready, unblocking RPC communication")
		close(jsReadyCh)
	})
}

// ForceGC Forces a gc
func ForceGC() {
	log("Flushing global caches")
	kbCtx.FlushCaches()
	log("Done flushing global caches")
	runtime.GC()
	log("Starting force gc")
	debug.FreeOSMemory()
	log("Done force gc")
}

// Version returns semantic version string
func Version() string {
	return libkb.VersionString()
}

func IsAppStateForeground() bool {
	if !isInited() {
		return false
	}
	return kbCtx.MobileAppState.State() == keybase1.MobileAppState_FOREGROUND
}

func SetAppStateForeground() {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("SetAppStateForeground", nil)()
	kbCtx.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
}

func SetAppStateBackground() {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("SetAppStateBackground", nil)()
	kbCtx.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
}

func SetAppStateInactive() {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("SetAppStateInactive", nil)()
	kbCtx.MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
}

func SetAppStateBackgroundActive() {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("SetAppStateBackgroundActive", nil)()
	kbCtx.MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
}

func waitForInit(maxDur time.Duration) error {
	if isInited() {
		return nil
	}
	maxCh := time.After(maxDur)
	for {
		select {
		case <-time.After(200 * time.Millisecond):
			if isInited() {
				return nil
			}
		case <-maxCh:
			return errors.New("waitForInit timeout")
		}
	}
}

func BackgroundSync() {
	// On Android there is a race where this function can be called before Init when starting up in the
	// background. Let's wait a little bit here for Init to get run, and bail out if it never does.
	if err := waitForInit(5 * time.Second); err != nil {
		return
	}
	defer kbCtx.Trace("BackgroundSync", nil)()

	// Skip the sync if we aren't in the background
	if state := kbCtx.MobileAppState.State(); state != keybase1.MobileAppState_BACKGROUND {
		kbCtx.Log.Debug("BackgroundSync: skipping, app not in background state: %v", state)
		return
	}

	nextState := keybase1.MobileAppState_BACKGROUNDACTIVE
	kbCtx.MobileAppState.Update(nextState)
	doneCh := make(chan struct{})
	go func() {
		defer func() { close(doneCh) }()
		select {
		case state := <-kbCtx.MobileAppState.NextUpdate(&nextState):
			// if literally anything happens, let's get out of here
			kbCtx.Log.Debug("BackgroundSync: bailing out early, appstate change: %v", state)
			return
		case <-time.After(10 * time.Second):
			kbCtx.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
			return
		}
	}()
	<-doneCh
}

// pushPendingMessageFailure sends at most one notification that a message
// failed to send. We only notify the user about visible messages that have
// failed.
func pushPendingMessageFailure(obrs []chat1.OutboxRecord, pusher PushNotifier) {
	for _, obr := range obrs {
		if topicType := obr.Msg.ClientHeader.Conv.TopicType; obr.Msg.IsBadgableType() && topicType == chat1.TopicType_CHAT {
			kbCtx.Log.Debug("pushPendingMessageFailure: pushing convID: %s", obr.ConvID)
			pusher.LocalNotification("failedpending",
				"Heads up! Your message hasn't sent yet, tap here to retry.",
				-1, "default", obr.ConvID.String(), "chat.failedpending")
			return
		}
	}
	kbCtx.Log.Debug("pushPendingMessageFailure: skipped notification for: %d items", len(obrs))
}

// AppWillExit is called reliably on iOS when the app is about to terminate
// not as reliably on android
func AppWillExit(pusher PushNotifier) {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("AppWillExit", nil)()
	ctx := context.Background()
	obrs, err := kbChatCtx.MessageDeliverer.ActiveDeliveries(ctx)
	if err == nil {
		// We are about to get killed with messages still to send, let the user
		// know they will get stuck
		pushPendingMessageFailure(obrs, pusher)
	}
	kbCtx.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
}

// AppDidEnterBackground notifies the service that the app is in the background
// [iOS] returning true will request about ~3mins from iOS to continue execution
func AppDidEnterBackground() bool {
	if !isInited() {
		return false
	}
	defer kbCtx.Trace("AppDidEnterBackground", nil)()
	ctx := context.Background()
	convs, err := kbChatCtx.MessageDeliverer.ActiveDeliveries(ctx)
	if err != nil {
		kbCtx.Log.Debug("AppDidEnterBackground: failed to get active deliveries: %s", err)
		convs = nil
	}
	stayRunning := false
	switch {
	case len(convs) > 0:
		kbCtx.Log.Debug("AppDidEnterBackground: active deliveries in progress")
		stayRunning = true
	case kbChatCtx.LiveLocationTracker.ActivelyTracking(ctx):
		kbCtx.Log.Debug("AppDidEnterBackground: active live location in progress")
		stayRunning = true
	case kbChatCtx.CoinFlipManager.HasActiveGames(ctx):
		kbCtx.Log.Debug("AppDidEnterBackground: active coin flip games in progress")
		stayRunning = true
	}
	if stayRunning {
		kbCtx.Log.Debug("AppDidEnterBackground: setting background active")
		kbCtx.MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
		return true
	}
	SetAppStateBackground()
	return false
}

func AppBeginBackgroundTaskNonblock(pusher PushNotifier) {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("AppBeginBackgroundTaskNonblock", nil)()
	go AppBeginBackgroundTask(pusher)
}

// AppBeginBackgroundTask notifies us that an app background task has been started on our behalf. This
// function will return once we no longer need any time in the background.
func AppBeginBackgroundTask(pusher PushNotifier) {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("AppBeginBackgroundTask", nil)()
	ctx := context.Background()
	// Poll active deliveries in case we can shutdown early
	beginTime := libkb.ForceWallClock(time.Now())
	ticker := time.NewTicker(5 * time.Second)
	appState := kbCtx.MobileAppState.State()
	if appState != keybase1.MobileAppState_BACKGROUNDACTIVE {
		kbCtx.Log.Debug("AppBeginBackgroundTask: not in background mode, early out")
		return
	}
	var g *errgroup.Group
	g, ctx = errgroup.WithContext(ctx)
	g.Go(func() error {
		select {
		case appState = <-kbCtx.MobileAppState.NextUpdate(&appState):
			kbCtx.Log.Debug(
				"AppBeginBackgroundTask: app state change, aborting with no task shutdown: %v", appState)
			return errors.New("app state change")
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	g.Go(func() error {
		ch, cancel := kbChatCtx.MessageDeliverer.NextFailure()
		defer cancel()
		select {
		case obrs := <-ch:
			kbCtx.Log.Debug(
				"AppBeginBackgroundTask: failure received, alerting the user: %d marked", len(obrs))
			pushPendingMessageFailure(obrs, pusher)
			return errors.New("failure received")
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	g.Go(func() error {
		successCount := 0
		for {
			select {
			case <-ticker.C:
				obrs, err := kbChatCtx.MessageDeliverer.ActiveDeliveries(ctx)
				if err != nil {
					kbCtx.Log.Debug("AppBeginBackgroundTask: failed to query active deliveries: %s", err)
					continue
				}
				if len(obrs) == 0 {
					kbCtx.Log.Debug("AppBeginBackgroundTask: delivered everything: successCount: %d",
						successCount)
					// We can race the failure case here, so lets go a couple passes of no pending
					// convs before we abort due to ths condition.
					if successCount > 1 {
						return errors.New("delivered everything")
					}
					successCount++
				}
				curTime := libkb.ForceWallClock(time.Now())
				if curTime.Sub(beginTime) >= 10*time.Minute {
					kbCtx.Log.Debug("AppBeginBackgroundTask: failed to deliver and time is up, aborting")
					pushPendingMessageFailure(obrs, pusher)
					return errors.New("time expired")
				}
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	})
	if err := g.Wait(); err != nil {
		kbCtx.Log.Debug("AppBeginBackgroundTask: dropped out of wait because: %s", err)
	}
}

func startTrace(logFile string) {
	if os.Getenv("KEYBASE_TRACE_MOBILE") != "1" {
		return
	}

	tname := filepath.Join(filepath.Dir(logFile), "svctrace.out")
	f, err := os.Create(tname)
	if err != nil {
		log("error creating %s", tname)
		return
	}
	log("Go: starting trace %s", tname)
	_ = trace.Start(f)
	go func() {
		log("Go: sleeping 30s for trace")
		time.Sleep(30 * time.Second)
		log("Go: stopping trace %s", tname)
		trace.Stop()
		time.Sleep(5 * time.Second)
		log("Go: trace stopped")
	}()
}
