// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"runtime/trace"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/status"
	"golang.org/x/sync/errgroup"

	"strings"

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
	context "golang.org/x/net/context"
)

var kbCtx *libkb.GlobalContext
var kbChatCtx *globals.ChatContext
var kbSvc *service.Service
var conn net.Conn
var startOnce sync.Once
var logSendContext status.LogSendContext
var kbfsConfig libkbfs.Config

var initMutex sync.Mutex
var initComplete bool

type PushNotifier interface {
	LocalNotification(ident string, msg string, badgeCount int, soundName string, convID string, typ string)
	DisplayChatNotification(notification *ChatNotification)
}

type NativeVideoHelper interface {
	Thumbnail(filename string) []byte
	Duration(filename string) int
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
	mobileOsVersion string) {
	startOnce.Do(func() {
		if err := Init(homeDir, mobileSharedHome, logFile, runModeStr, accessGroupOverride, dnsNSFetcher, nvh, mobileOsVersion); err != nil {
			kbCtx.Log.Errorf("Init error: %s", err)
		}
	})
}

// Init runs the Keybase services
func Init(homeDir, mobileSharedHome, logFile, runModeStr string,
	accessGroupOverride bool, externalDNSNSFetcher ExternalDNSNSFetcher, nvh NativeVideoHelper,
	mobileOsVersion string) (err error) {
	defer func() {
		err = flattenError(err)
		if err == nil {
			setInited()
		}
	}()

	fmt.Printf("Go: Initializing: home: %s mobileSharedHome: %s\n", homeDir, mobileSharedHome)
	var ekLogFile, guiLogFile string
	if logFile != "" {
		fmt.Printf("Go: Using log: %s\n", logFile)
		ekLogFile = logFile + ".ek"
		fmt.Printf("Go: Using eklog: %s\n", ekLogFile)
		guiLogFile = logFile + ".gui"
		fmt.Printf("Go: Using guilog: %s\n", guiLogFile)
	}

	// Reduce OS threads on mobile so we don't have too much contention with JS thread
	oldProcs := runtime.GOMAXPROCS(0)
	newProcs := oldProcs - 2
	if newProcs <= 0 {
		newProcs = 1
	}
	runtime.GOMAXPROCS(newProcs)
	fmt.Printf("Go: setting GOMAXPROCS to: %d previous: %d\n", newProcs, oldProcs)

	startTrace(logFile)

	dnsNSFetcher := newDNSNSFetcher(externalDNSNSFetcher)
	dnsServers := dnsNSFetcher.GetServers()
	for _, srv := range dnsServers {
		fmt.Printf("Go: DNS Server: %s\n", srv)
	}

	kbCtx = libkb.NewGlobalContext()
	kbCtx.Init()
	kbCtx.SetProofServices(externals.NewProofServices(kbCtx))

	fmt.Printf("Go: Mobile OS version is: %q\n", mobileOsVersion)
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
		GUILogFile:                     guiLogFile,
		RunMode:                        runMode,
		Debug:                          true,
		LocalRPCDebug:                  "",
		VDebugSetting:                  "mobile", // use empty string for same logging as desktop default
		SecurityAccessGroupOverride:    accessGroupOverride,
		ChatInboxSourceLocalizeThreads: 5,
		LinkCacheSize:                  1000,
	}
	err = kbCtx.Configure(config, usage)
	if err != nil {
		return err
	}

	kbSvc = service.NewService(kbCtx, false)
	err = kbSvc.StartLoopbackServer(libkb.LoginAttemptOffline)
	if err != nil {
		return err
	}
	kbCtx.SetService()
	uir := service.NewUIRouter(kbCtx)
	kbCtx.SetUIRouter(uir)
	kbCtx.SetDNSNameServerFetcher(dnsNSFetcher)
	err = kbSvc.SetupCriticalSubServices()
	if err != nil {
		return err
	}
	kbSvc.SetupChatModules(nil)
	kbSvc.RunBackgroundOperations(uir)
	kbChatCtx = kbSvc.ChatContextified.ChatG()
	kbChatCtx.NativeVideoHelper = newVideoHelper(nvh)

	logs := status.Logs{
		Service: config.GetLogFile(),
		EK:      config.GetEKLogFile(),
	}

	fmt.Printf("Go: Using config: %+v\n", kbCtx.Env.GetLogFileConfig(config.GetLogFile()))

	logSendContext = status.LogSendContext{
		Contextified: libkb.NewContextified(kbCtx),
		Logs:         logs,
	}

	// open the connection
	if err = Reset(); err != nil {
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
		kbfsConfig, _ = libkbfs.Init(
			context.Background(), kbfsCtx, kbfsParams, serviceCn{}, func() error { return nil },
			kbCtx.Log)
	}()

	return nil
}

type serviceCn struct{}

func (s serviceCn) NewKeybaseService(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.KeybaseService, error) {
	// TODO: plumb the func somewhere it can be called on shutdown?
	gitrpc, _ := libgit.NewRPCHandlerWithCtx(
		ctx, config, nil)
	additionalProtocols := []rpc.Protocol{
		keybase1.SimpleFSProtocol(
			simplefs.NewSimpleFS(ctx, config)),
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

	logSendID, err := logSendContext.LogSend(sendLogs, numBytes, true /* mergeExtendedStatus */)
	logSendContext.Clear()
	return string(logSendID), err
}

// WriteB64 sends a base64 encoded msgpack rpc payload
func WriteB64(str string) (err error) {
	defer func() { err = flattenError(err) }()
	if conn == nil {
		return errors.New("connection not initialized")
	}
	data, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return fmt.Errorf("Base64 decode error: %s; %s", err, str)
	}
	n, err := conn.Write(data)
	if err != nil {
		return fmt.Errorf("Write error: %s", err)
	}
	if n != len(data) {
		return errors.New("Did not write all the data")
	}
	return nil
}

const targetBufferSize = 300 * 1024

// bufferSize must be divisible by 3 to ensure that we don't split
// our b64 encode across a payload boundary if we go over our buffer
// size.
const bufferSize = targetBufferSize - (targetBufferSize % 3)

// buffer for the conn.Read
var buffer = make([]byte, bufferSize)

// ReadB64 is a blocking read for base64 encoded msgpack rpc data.
// It is called serially by the mobile run loops.
func ReadB64() (res string, err error) {
	defer func() { err = flattenError(err) }()
	if conn == nil {
		return "", errors.New("connection not initialized")
	}
	n, err := conn.Read(buffer)
	if n > 0 && err == nil {
		str := base64.StdEncoding.EncodeToString(buffer[0:n])
		return str, nil
	}

	if err != nil {
		// Attempt to fix the connection
		_ = Reset()
		return "", fmt.Errorf("Read error: %s", err)
	}

	return "", nil
}

// Reset resets the socket connection
func Reset() error {
	if conn != nil {
		conn.Close()
	}
	if !isInited() {
		return nil
	}

	var err error
	conn, err = kbCtx.LoopbackListener.Dial()
	if err != nil {
		return fmt.Errorf("Socket error: %s", err)
	}
	return nil
}

// ForceGC Forces a gc
func ForceGC() {
	fmt.Printf("Flushing global caches\n")
	kbCtx.FlushCaches()
	fmt.Printf("Done flushing global caches\n")

	fmt.Printf("Starting force gc\n")
	debug.FreeOSMemory()
	fmt.Printf("Done force gc\n")
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
	defer kbCtx.Trace("SetAppStateForeground", func() error { return nil })()
	kbCtx.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
}
func SetAppStateBackground() {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("SetAppStateBackground", func() error { return nil })()
	kbCtx.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
}
func SetAppStateInactive() {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("SetAppStateInactive", func() error { return nil })()
	kbCtx.MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
}
func SetAppStateBackgroundActive() {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("SetAppStateBackgroundActive", func() error { return nil })()
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
	defer kbCtx.Trace("BackgroundSync", func() error { return nil })()

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
// failed to send. We don't notify the user about background failures like
// unfurling.
func pushPendingMessageFailure(obrs []chat1.OutboxRecord, pusher PushNotifier) {
	for _, obr := range obrs {
		if !obr.IsUnfurl() {
			kbCtx.Log.Debug("pushPendingMessageFailure: pushing convID: %s", obr.ConvID)
			pusher.LocalNotification("failedpending",
				"Heads up! One or more pending messages failed to send. Tap here to retry them.",
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
	defer kbCtx.Trace("AppWillExit", func() error { return nil })()
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
	defer kbCtx.Trace("AppDidEnterBackground", func() error { return nil })()
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
	defer kbCtx.Trace("AppBeginBackgroundTaskNonblock", func() error { return nil })()
	go AppBeginBackgroundTask(pusher)
}

// AppBeginBackgroundTask notifies us that an app background task has been started on our behalf. This
// function will return once we no longer need any time in the background.
func AppBeginBackgroundTask(pusher PushNotifier) {
	if !isInited() {
		return
	}
	defer kbCtx.Trace("AppBeginBackgroundTask", func() error { return nil })()
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
		fmt.Printf("error creating %s\n", tname)
		return
	}
	fmt.Printf("Go: starting trace %s\n", tname)
	_ = trace.Start(f)
	go func() {
		fmt.Printf("Go: sleeping 30s for trace\n")
		time.Sleep(30 * time.Second)
		fmt.Printf("Go: stopping trace %s\n", tname)
		trace.Stop()
		time.Sleep(5 * time.Second)
		fmt.Printf("Go: trace stopped\n")
	}()
}
