package keybase

import (
	"encoding/json"
	"errors"
	"fmt"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/client/go/uidmap"
	context "golang.org/x/net/context"
)

var extensionRi chat1.RemoteClient
var extensionInited bool
var extensionInitMu sync.Mutex

func ExtensionIsInited() bool {
	extensionInitMu.Lock()
	defer extensionInitMu.Unlock()
	return extensionInited
}

func ExtensionInit(homeDir string, mobileSharedHome string, logFile string, runModeStr string,
	accessGroupOverride bool, externalDNSNSFetcher ExternalDNSNSFetcher, nvh NativeVideoHelper) (err error) {
	extensionInitMu.Lock()
	defer extensionInitMu.Unlock()
	defer func() { err = flattenError(err) }()
	defer func() {
		if err == nil {
			extensionInited = true
		}
		kbCtx.Log.Debug("Init complete: err: %s extensionInited: %v", err, extensionInited)
	}()
	if extensionInited {
		return nil
	}
	fmt.Printf("Go: Extension Initializing: home: %s mobileSharedHome: %s\n", homeDir, mobileSharedHome)
	if logFile != "" {
		fmt.Printf("Go: Using log: %s\n", logFile)
	}

	dnsNSFetcher := newDNSNSFetcher(externalDNSNSFetcher)
	dnsServers := dnsNSFetcher.GetServers()
	for _, srv := range dnsServers {
		fmt.Printf("Go: DNS Server: %s\n", srv)
	}

	kbCtx = libkb.NewGlobalContext()
	kbCtx.Init()
	kbCtx.SetServices(externals.GetServices())

	// 10k uid -> FullName cache entries allowed
	kbCtx.SetUIDMapper(uidmap.NewUIDMap(10000))
	usage := libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
	var runMode kbconst.RunMode
	if runMode, err = libkb.StringToRunMode(runModeStr); err != nil {
		return err
	}
	config := libkb.AppConfig{
		HomeDir:                        homeDir,
		MobileSharedHomeDir:            mobileSharedHome,
		MobileExtension:                true,
		LogFile:                        logFile,
		RunMode:                        runMode,
		Debug:                          true,
		LocalRPCDebug:                  "",
		VDebugSetting:                  "mobile", // use empty string for same logging as desktop default
		SecurityAccessGroupOverride:    accessGroupOverride,
		ChatInboxSourceLocalizeThreads: 5,
		AttachmentHTTPStartPort:        16500,
		AttachmentDisableMulti:         true,
	}
	if err = kbCtx.Configure(config, usage); err != nil {
		return err
	}
	if err = kbCtx.LocalDb.ForceOpen(); err != nil {
		kbCtx.Log.Debug("Failed to open local db, using memory db: %s", err)
		kbCtx.LocalDb = libkb.NewJSONLocalDb(libkb.NewMemDb(1000))
	}
	if err = kbCtx.LocalChatDb.ForceOpen(); err != nil {
		kbCtx.Log.Debug("Failed to open local chat db, using memory db: %s", err)
		kbCtx.LocalChatDb = libkb.NewJSONLocalDb(libkb.NewMemDb(1000))
	}

	svc := service.NewService(kbCtx, false)
	if err = svc.StartLoopbackServer(); err != nil {
		return err
	}
	kbCtx.SetService()
	uir := service.NewUIRouter(kbCtx)
	kbCtx.SetUIRouter(uir)
	kbCtx.SetDNSNameServerFetcher(dnsNSFetcher)
	svc.SetupCriticalSubServices()

	var uid gregor1.UID
	extensionRi = chat1.RemoteClient{Cli: chat.OfflineClient{}}
	svc.SetupChatModules(func() chat1.RemoteInterface { return extensionRi })
	kbChatCtx = svc.ChatContextified.ChatG()
	gc := globals.NewContext(kbCtx, kbChatCtx)
	if uid, err = assertLoggedInUID(context.Background(), gc); err != nil {
		return err
	}
	if extensionRi, err = getGregorClient(context.Background(), gc); err != nil {
		return err
	}
	kbChatCtx.NativeVideoHelper = newVideoHelper(nvh)
	kbChatCtx.InboxSource = chat.NewRemoteInboxSource(gc, func() chat1.RemoteInterface { return extensionRi })
	kbChatCtx.EphemeralPurger.Start(context.Background(), uid) // need to start this to send
	return nil
}

func assertLoggedInUID(ctx context.Context, gc *globals.Context) (uid gregor1.UID, err error) {
	if !gc.ActiveDevice.HaveKeys() {
		return uid, libkb.LoginRequiredError{}
	}
	k1uid := gc.Env.GetUID()
	if k1uid.IsNil() {
		return uid, libkb.LoginRequiredError{}
	}
	return gregor1.UID(k1uid.ToBytes()), nil
}

func ExtensionGetInbox() (res string, err error) {
	defer kbCtx.Trace("ExtensionGetInbox", func() error { return err })()
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	uid, err := assertLoggedInUID(ctx, gc)
	if err != nil {
		return res, err
	}
	inbox := storage.NewInbox(gc, uid)
	sharedInbox, err := inbox.ReadShared(ctx)
	if err != nil {
		return res, err
	}

	// Pretty up the names
	username := kbCtx.GetEnv().GetUsername().String()
	filterCurrentUsername := func(name string) string {
		// Check for self conv or big team conv
		if name == username || strings.Contains(name, "#") {
			return name
		}
		name = strings.Replace(name, fmt.Sprintf(",%s", username), "", -1)
		name = strings.Replace(name, fmt.Sprintf("%s,", username), "", -1)
		return name
	}
	for index := range sharedInbox {
		sharedInbox[index].Name = filterCurrentUsername(sharedInbox[index].Name)
	}

	// JSON up to send to native
	dat, err := json.Marshal(sharedInbox)
	if err != nil {
		return res, err
	}
	return string(dat), nil
}

type extensionGregorHandler struct {
	globals.Contextified
	nist *libkb.NIST
}

func newExtensionGregorHandler(gc *globals.Context, nist *libkb.NIST) *extensionGregorHandler {
	return &extensionGregorHandler{
		Contextified: globals.NewContextified(gc),
		nist:         nist,
	}
}

func (g *extensionGregorHandler) HandlerName() string {
	return "extensionGregorHandler"
}
func (g *extensionGregorHandler) OnConnect(ctx context.Context, conn *rpc.Connection, cli rpc.GenericClient, srv *rpc.Server) error {
	gcli := gregor1.AuthClient{Cli: cli}
	uid := gregor1.UID(g.G().GetEnv().GetUID().ToBytes())
	authRes, err := gcli.AuthenticateSessionToken(ctx, gregor1.SessionToken(g.nist.Token().String()))
	if err != nil {
		return err
	}
	if !authRes.Uid.Eq(uid) {
		return errors.New("wrong uid authed")
	}
	return nil
}
func (g *extensionGregorHandler) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
}
func (g *extensionGregorHandler) OnDisconnected(ctx context.Context, status rpc.DisconnectStatus) {
}
func (g *extensionGregorHandler) OnDoCommandError(err error, nextTime time.Duration) {}
func (g *extensionGregorHandler) ShouldRetry(name string, err error) bool {
	return false
}
func (g *extensionGregorHandler) ShouldRetryOnConnect(err error) bool {
	return false
}

func getGregorClient(ctx context.Context, gc *globals.Context) (res chat1.RemoteClient, err error) {
	// Get session token
	nist, _, err := kbCtx.ActiveDevice.NISTAndUID(ctx)
	if nist == nil {
		kbCtx.Log.CDebugf(ctx, "getGregorClient: got a nil NIST, is the user logged out?")
		return res, errors.New("not logged in")
	}
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "getGregorClient: failed to get logged in session: %s", err)
		return res, err
	}
	// Make an ad hoc connection to gregor
	uri, err := rpc.ParseFMPURI(kbCtx.GetEnv().GetGregorURI())
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "getGregorClient: failed to parse chat server UR: %s", err)
		return res, err
	}

	var conn *rpc.Connection
	handler := newExtensionGregorHandler(gc, nist)
	if uri.UseTLS() {
		rawCA := kbCtx.GetEnv().GetBundledCA(uri.Host)
		if len(rawCA) == 0 {
			kbCtx.Log.CDebugf(ctx, "getGregorClient: failed to parse CAs: %s", err)
			return
		}
		conn = rpc.NewTLSConnection(rpc.NewFixedRemote(uri.HostPort),
			[]byte(rawCA), libkb.NewContextifiedErrorUnwrapper(kbCtx),
			handler, libkb.NewRPCLogFactory(kbCtx),
			logger.LogOutputWithDepthAdder{Logger: kbCtx.Log}, rpc.ConnectionOpts{})
	} else {
		t := rpc.NewConnectionTransport(uri, nil, libkb.MakeWrapError(kbCtx))
		conn = rpc.NewConnectionWithTransport(handler, t,
			libkb.NewContextifiedErrorUnwrapper(kbCtx),
			logger.LogOutputWithDepthAdder{Logger: kbCtx.Log}, rpc.ConnectionOpts{})
	}
	defer conn.Shutdown()

	// Make remote successful call on our ad hoc conn
	return chat1.RemoteClient{Cli: chat.NewRemoteClient(gc, conn.GetClient())}, nil
}

func restoreName(gc *globals.Context, name string) string {
	if strings.Contains(name, "#") {
		return strings.Split(name, "#")[0]
	}
	username := gc.GetEnv().GetUsername().String()
	return name + "," + username
}

func ExtensionPostText(strConvID, name string, public bool, body string, pusher PushNotifier) (err error) {
	defer kbCtx.Trace("ExtensionPostText", func() error { return err })()
	defer func() { err = flattenError(err) }()
	defer func() { extensionPushResult(pusher, err, strConvID, "message") }()

	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))

	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	sender := chat.NewBlockingSender(gc, chat.NewBoxer(gc),
		func() chat1.RemoteInterface { return extensionRi })
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: chat1.MessageType_TEXT,
			TlfName:     restoreName(gc, name),
			TlfPublic:   public,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: body,
		}),
	}
	if _, _, err = sender.Send(ctx, convID, msg, 0, nil); err != nil {
		return err
	}
	return nil
}

func extensionPushResult(pusher PushNotifier, err error, strConvID, typ string) {
	var msg string
	if err != nil {
		msg = fmt.Sprintf("We could not send your %s. Please try from the Keybase app.", typ)
	} else {
		msg = fmt.Sprintf("Your %s was shared successfully.", typ)
	}
	pusher.LocalNotification("extension", msg, -1, "default", strConvID, "chat.extension")
}

func ExtensionPostJPEG(strConvID, name string, public bool, caption string, filename string,
	baseWidth, baseHeight, previewWidth, previewHeight int, previewData []byte, pusher PushNotifier) (err error) {
	defer kbCtx.Trace("ExtensionPostJPEG", func() error { return err })()
	defer func() { err = flattenError(err) }()
	defer func() { extensionPushResult(pusher, err, strConvID, "file") }()

	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	uid, err := assertLoggedInUID(ctx, gc)
	if err != nil {
		return err
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}

	vis := keybase1.TLFVisibility_PRIVATE
	if public {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	sender := chat.NewBlockingSender(gc, chat.NewBoxer(gc),
		func() chat1.RemoteInterface { return extensionRi })
	name = restoreName(gc, name)

	// Compute preview result from the native params
	mimeType := "image/jpeg"
	location := chat1.NewPreviewLocationWithBytes(previewData)
	baseMD := chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
		Width:  baseWidth,
		Height: baseHeight,
	})
	previewMD := chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
		Width:  previewWidth,
		Height: previewHeight,
	})
	callerPreview := chat1.MakePreviewRes{
		MimeType:        mimeType,
		PreviewMimeType: &mimeType,
		Location:        &location,
		Metadata:        &previewMD,
		BaseMetadata:    &baseMD,
	}

	if _, _, err = attachments.NewSender(gc).PostFileAttachment(ctx, sender, uid, convID, name, vis, nil,
		filename, caption, nil, 0, nil, &callerPreview); err != nil {
		return err
	}
	return nil
}

func ExtensionPostVideo(strConvID, name string, public bool, caption string, filename string,
	duration, baseWidth, baseHeight, previewWidth, previewHeight int, previewData []byte, pusher PushNotifier) (err error) {
	defer kbCtx.Trace("ExtensionPostVideo", func() error { return err })()
	defer func() { err = flattenError(err) }()
	defer func() { extensionPushResult(pusher, err, strConvID, "file") }()

	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	uid, err := assertLoggedInUID(ctx, gc)
	if err != nil {
		return err
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}

	vis := keybase1.TLFVisibility_PRIVATE
	if public {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	sender := chat.NewBlockingSender(gc, chat.NewBoxer(gc),
		func() chat1.RemoteInterface { return extensionRi })
	name = restoreName(gc, name)

	// Compute preview result from the native params
	mimeType := "video/quicktime"
	previewMimeType := "image/jpeg"
	location := chat1.NewPreviewLocationWithBytes(previewData)
	if duration < 1 {
		// clamp to 1 so we know it is a video, but also not to compute a duration for it
		duration = 1
	} else {
		duration *= 1000
	}
	baseMD := chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{
		Width:      baseWidth,
		Height:     baseHeight,
		DurationMs: duration,
	})
	previewMD := chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
		Width:  previewWidth,
		Height: previewHeight,
	})
	callerPreview := chat1.MakePreviewRes{
		MimeType:        mimeType,
		PreviewMimeType: &previewMimeType,
		Location:        &location,
		Metadata:        &previewMD,
		BaseMetadata:    &baseMD,
	}

	if _, _, err = attachments.NewSender(gc).PostFileAttachment(ctx, sender, uid, convID, name, vis, nil,
		filename, caption, nil, 0, nil, &callerPreview); err != nil {
		return err
	}
	return nil
}

func ExtensionPostFile(strConvID, name string, public bool, caption string, filename string,
	pusher PushNotifier) (err error) {
	defer kbCtx.Trace("ExtensionPostFile", func() error { return err })()
	defer func() { err = flattenError(err) }()
	defer func() { extensionPushResult(pusher, err, strConvID, "file") }()

	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	uid, err := assertLoggedInUID(ctx, gc)
	if err != nil {
		return err
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	vis := keybase1.TLFVisibility_PRIVATE
	if public {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	sender := chat.NewBlockingSender(gc, chat.NewBoxer(gc),
		func() chat1.RemoteInterface { return extensionRi })
	name = restoreName(gc, name)
	if _, _, err = attachments.NewSender(gc).PostFileAttachment(ctx, sender, uid, convID, name, vis, nil,
		filename, caption, nil, 0, nil, nil); err != nil {
		return err
	}
	return nil
}

// ExtensionForceGC Forces a gc
func ExtensionForceGC() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("mem stats (before): alloc: %v sys: %v\n", m.Alloc, m.Sys)
	fmt.Printf("Starting force gc\n")
	debug.FreeOSMemory()
	fmt.Printf("Done force gc\n")
	runtime.ReadMemStats(&m)
	fmt.Printf("mem stats (after): alloc: %v sys: %v\n", m.Alloc, m.Sys)
	if !ExtensionIsInited() {
		fmt.Printf("Not initialized, bailing")
		return
	}
	fmt.Printf("Flushing global caches\n")
	kbCtx.FlushCaches()
	fmt.Printf("Done flushing global caches\n")
	runtime.ReadMemStats(&m)
	fmt.Printf("mem stats (after flush): alloc: %v sys: %v\n", m.Alloc, m.Sys)
}
