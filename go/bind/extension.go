package keybase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/client/go/uidmap"

	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/simplefs"
)

var extensionRi chat1.RemoteClient
var extensionInited bool
var extensionInitMu sync.Mutex
var extensionPusher PushNotifier
var extensionListener *extensionNotifyListener

var extensionKbfsInitedCh chan struct{}
var extensionSimpleFS keybase1.SimpleFSInterface

type extensionNotifyListener struct {
	sync.Mutex
	globals.Contextified
	libkb.NoopNotifyListener
	waiters map[string][]chan struct{}
	sent    map[string]bool
}

func newExtensionNotifyListener(g *globals.Context) *extensionNotifyListener {
	return &extensionNotifyListener{
		Contextified: globals.NewContextified(g),
		waiters:      make(map[string][]chan struct{}),
		sent:         make(map[string]bool),
	}
}

func (n *extensionNotifyListener) listenFor(outboxID chat1.OutboxID) chan struct{} {
	n.Lock()
	defer n.Unlock()
	cb := make(chan struct{})
	if n.sent[outboxID.String()] {
		close(cb)
	} else {
		n.waiters[outboxID.String()] = append(n.waiters[outboxID.String()], cb)
	}
	return cb
}

func (n *extensionNotifyListener) trigger(outboxID chat1.OutboxID) {
	n.Lock()
	defer n.Unlock()
	n.sent[outboxID.String()] = true
	for _, cb := range n.waiters[outboxID.String()] {
		close(cb)
	}
	n.waiters[outboxID.String()] = nil
}

func (n *extensionNotifyListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity,
	source chat1.ChatActivitySource) {
	// Only care about local notifications
	if source != chat1.ChatActivitySource_LOCAL {
		return
	}
	ctx := context.Background()
	st, err := activity.ActivityType()
	if err != nil {
		kbCtx.Log.Debug("NewChatActivity: failed to get type: %s", err)
		return
	}
	switch st {
	case chat1.ChatActivityType_INCOMING_MESSAGE:
		strConvID := activity.IncomingMessage().ConvID.String()
		outboxID := activity.IncomingMessage().Message.GetOutboxID()
		if outboxID != nil {
			n.trigger(*outboxID)
		}
		extensionPushResult(nil, strConvID, "message")
	case chat1.ChatActivityType_FAILED_MESSAGE:
		err := errors.New("message failed")
		recs := activity.FailedMessage().OutboxRecords
		for _, r := range recs {
			strConvID := r.ConvID.String()
			n.trigger(r.OutboxID)
			extensionPushResult(err, strConvID, "message")
		}
		for _, r := range recs {
			strConvID := r.ConvID.String()
			strOutboxID := r.OutboxID.String()
			extensionRegisterFailure(ctx, n.G(), err, strConvID, strOutboxID)
		}
	}
}

func ExtensionIsInited() bool {
	extensionInitMu.Lock()
	defer extensionInitMu.Unlock()
	return extensionInited
}

type sharingServiceCn struct {
	serviceCn
}

func (s sharingServiceCn) NewKeybaseService(config libkbfs.Config, params libkbfs.InitParams, ctx libkbfs.Context, log logger.Logger) (libkbfs.KeybaseService, error) {
	return libkbfs.NewKeybaseDaemonRPC(
		config, ctx, log, true, []rpc.Protocol{}), nil
}

func ExtensionInit(homeDir string, mobileSharedHome string, logFile string, runModeStr string,
	accessGroupOverride bool, pusher PushNotifier) (err error) {
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

	extensionPusher = pusher
	dnsNSFetcher := newDNSNSFetcher(nil)
	dnsServers := dnsNSFetcher.GetServers()
	for _, srv := range dnsServers {
		fmt.Printf("Go: DNS Server: %s\n", srv)
	}

	kbCtx = libkb.NewGlobalContext()
	kbCtx.Init()
	kbCtx.SetProofServices(externals.NewProofServices(kbCtx))

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
		LinkCacheSize:                  100,
		UPAKCacheSize:                  50,
		PayloadCacheSize:               50,
		ProofCacheSize:                 50,
		OutboxStorageEngine:            "files",
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
	extensionListener = newExtensionNotifyListener(gc)
	kbCtx.NotifyRouter.SetListener(extensionListener)
	kbChatCtx.InboxSource = chat.NewRemoteInboxSource(gc, func() chat1.RemoteInterface { return extensionRi })
	kbChatCtx.EphemeralPurger.Start(context.Background(), uid) // need to start this to send
	kbChatCtx.MessageDeliverer.Start(context.Background(), uid)
	kbChatCtx.MessageDeliverer.Connected(context.Background())

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
			context.Background(), kbfsCtx, kbfsParams, sharingServiceCn{},
			func() {}, kbCtx.Log)
		extensionSimpleFS = simplefs.NewSimpleFS(kbfsCtx, kbfsConfig)
		close(extensionKbfsInitedCh)
	}()
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

func presentInboxItem(item storage.SharedInboxItem, username string) storage.SharedInboxItem {
	// Check for self conv or big team conv
	if item.Name == username || strings.Contains(item.Name, "#") {
		return item
	}
	item.Name = strings.Replace(item.Name, fmt.Sprintf(",%s", username), "", -1)
	item.Name = strings.Replace(item.Name, fmt.Sprintf("%s,", username), "", -1)
	return item
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
	inbox := storage.NewInbox(gc)
	sharedInbox, err := inbox.ReadShared(ctx, uid)
	if err != nil {
		return res, err
	}

	// Pretty up the names
	username := kbCtx.GetEnv().GetUsername().String()
	for index := range sharedInbox {
		sharedInbox[index] = presentInboxItem(sharedInbox[index], username)
	}

	// JSON up to send to native
	dat, err := json.Marshal(sharedInbox)
	if err != nil {
		return res, err
	}
	return string(dat), nil
}

func ExtensionListPath(p string) (res string, err error) {
	defer kbCtx.Trace("ExtensionListPath", func() error { return err })()
	ctx := context.Background()
	opID, err := extensionSimpleFS.SimpleFSMakeOpid(ctx)
	if err != nil {
		return "null", err
	}

	err = extensionSimpleFS.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opID,
		Path: keybase1.NewPathWithKbfs(p),
	})
	if err != nil {
		return "null", err
	}
	err = extensionSimpleFS.SimpleFSWait(ctx, opID)
	if err != nil {
		return "null", err
	}
	listResult, err := extensionSimpleFS.SimpleFSReadList(ctx, opID)
	if err != nil {
		return "null", err
	}
	dat, err := json.Marshal(listResult.Entries)
	if err != nil {
		return "null", err
	}
	return string(dat), nil
}

func extensionGetDeviceID(ctx context.Context, gc *globals.Context) (res gregor1.DeviceID, err error) {
	deviceID := gc.ActiveDevice.DeviceID()
	if deviceID.IsNil() {
		return res, err
	}
	hdid := make([]byte, libkb.DeviceIDLen)
	if err = deviceID.ToBytes(hdid); err != nil {
		return res, err
	}
	return gregor1.DeviceID(hdid), nil
}

func extensionRegisterSendNonblock(ctx context.Context, gc *globals.Context, convID chat1.ConversationID,
	outboxID chat1.OutboxID) {
	bctx := chat.BackgroundContext(ctx, gc)
	go func(ctx context.Context) {
		deviceID, err := extensionGetDeviceID(ctx, gc)
		if err != nil {
			kbCtx.Log.CDebugf(ctx, "extensionRegisterSend: failed to get deviceID: %s", err)
			return
		}
		if err = extensionRi.RegisterSharePost(ctx, chat1.RegisterSharePostArg{
			ConvID:   convID,
			OutboxID: outboxID,
			DeviceID: deviceID,
		}); err != nil {
			kbCtx.Log.CDebugf(ctx, "extensionRegisterSend: failed to make RPC: %s", err)
			return
		}
	}(bctx)
}

func extensionRegisterFailure(ctx context.Context, gc *globals.Context, err error, strConvID,
	strOutboxID string) {
	if err == nil {
		return
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "extensionRegisterFailure: invalid convID: %s", err)
		return
	}
	outboxID := getOutboxID(strOutboxID)
	if outboxID == nil {
		kbCtx.Log.CDebugf(ctx, "extensionRegisterFailure: nil outboxID")
		return
	}
	deviceID, err := extensionGetDeviceID(ctx, gc)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "extensionRegisterFailure: failed to get deviceID: %s", err)
		return
	}
	if err := extensionRi.FailSharePost(ctx, chat1.FailSharePostArg{
		ConvID:   convID,
		OutboxID: *outboxID,
		DeviceID: deviceID,
	}); err != nil {
		kbCtx.Log.CDebugf(ctx, "extensionRegisterFailure: failed: %s", err)
	}
}

func ExtensionDetectMIMEType(filename string) (res string, err error) {
	defer kbCtx.Trace("ExtensionDetectMIMEType", func() error { return err })()
	src, err := attachments.NewFileReadResetter(filename)
	if err != nil {
		return res, err
	}
	defer src.Close()
	return attachments.DetectMIMEType(context.TODO(), src, filename)
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
	conn, _, err := utils.GetGregorConn(ctx, gc, utils.NewDebugLabeler(gc.GetLog(), "Extension", false),
		func(nist *libkb.NIST) rpc.ConnectionHandler {
			return newExtensionGregorHandler(gc, nist)
		})
	return chat1.RemoteClient{Cli: chat.NewRemoteClient(gc, conn.GetClient())}, nil
}

func restoreName(gc *globals.Context, name string, membersType chat1.ConversationMembersType) string {
	switch membersType {
	case chat1.ConversationMembersType_TEAM:
		if strings.Contains(name, "#") {
			return strings.Split(name, "#")[0]
		}
		return name
	default:
		username := gc.GetEnv().GetUsername().String()
		return name + "," + username
	}
}

func getOutboxID(strOutboxID string) *chat1.OutboxID {
	if len(strOutboxID) == 0 {
		return nil
	}
	obid, err := chat1.MakeOutboxID(strOutboxID)
	if err != nil {
		return nil
	}
	return &obid
}

func extensionNewSender(g *globals.Context) types.Sender {
	baseSender := chat.NewBlockingSender(g, chat.NewBoxer(g),
		func() chat1.RemoteInterface { return extensionRi })
	return chat.NewNonblockingSender(g, baseSender)
}

func ExtensionPostText(strConvID, name string, public bool, membersType int, body string) (err error) {
	defer kbCtx.Trace("ExtensionPostText", func() error { return err })()
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	defer func() { err = flattenError(err) }()
	defer func() {
		if err == nil {
			putSavedConv(ctx, strConvID, name, public, membersType)
		}
	}()

	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: chat1.MessageType_TEXT,
			TlfName:     restoreName(gc, name, chat1.ConversationMembersType(membersType)),
			TlfPublic:   public,
			OutboxID:    &outboxID,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: body,
		}),
	}
	if _, _, err = extensionNewSender(gc).Send(ctx, convID, msg, 0, &outboxID); err != nil {
		return err
	}
	extensionRegisterSendNonblock(ctx, gc, convID, outboxID)
	extensionWaitForResult(ctx, strConvID, extensionListener.listenFor(outboxID))
	return nil
}

func extensionPushResult(err error, strConvID, typ string) {
	var msg string
	if err != nil {
		msg = fmt.Sprintf("We could not send your %s. Please try from the Keybase app.", typ)
	} else {
		msg = fmt.Sprintf("Your %s was shared successfully.", typ)
	}
	extensionPusher.LocalNotification("extension", msg, -1, "default", strConvID, "chat.extension")
}

func extensionCreateUploadTemp(ctx context.Context, gc *globals.Context, outboxID chat1.OutboxID,
	inFilename string) (string, error) {
	// move the file into out own storage, otherwise iOS is going to blow it away
	filename, err := gc.AttachmentUploader.GetUploadTempFile(ctx, outboxID, inFilename)
	if err != nil {
		return "", err
	}
	inFile, err := os.Open(inFilename)
	if err != nil {
		return "", err
	}
	outFile, err := os.OpenFile(filename, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(outFile, inFile); err != nil {
		return "", err
	}
	return filename, nil
}

func ExtensionPostImage(strConvID, name string, public bool, membersType int,
	caption string, inFilename string, mimeType string,
	baseWidth, baseHeight, previewWidth, previewHeight int, previewData []byte) (err error) {
	defer kbCtx.Trace("ExtensionPostImage", func() error { return err })()
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	defer func() { err = flattenError(err) }()
	uid, err := assertLoggedInUID(ctx, gc)
	if err != nil {
		return err
	}
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	filename, err := extensionCreateUploadTemp(ctx, gc, outboxID, inFilename)
	if err != nil {
		return err
	}
	var callerPreview *chat1.MakePreviewRes
	if previewData != nil {
		// Compute preview result from the native params
		callerPreview = new(chat1.MakePreviewRes)
		callerPreview.MimeType = mimeType
		callerPreview.PreviewMimeType = &mimeType
		callerPreview.BaseMetadata = new(chat1.AssetMetadata)
		callerPreview.Metadata = new(chat1.AssetMetadata)
		location := chat1.NewPreviewLocationWithBytes(previewData)
		callerPreview.Location = &location
		switch mimeType {
		case "image/gif":
			*callerPreview.BaseMetadata = chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{
				Width:      baseWidth,
				Height:     baseHeight,
				DurationMs: 10, // make something up, we don't display this anyway
			})
			*callerPreview.Metadata = chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
				Width:  previewWidth,
				Height: previewHeight,
			})
			callerPreview.PreviewMimeType = new(string)
			*callerPreview.PreviewMimeType = "image/jpeg"
		default:
			*callerPreview.BaseMetadata = chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
				Width:  baseWidth,
				Height: baseHeight,
			})
			*callerPreview.Metadata = chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
				Width:  previewWidth,
				Height: previewHeight,
			})
		}
	}
	return postFileAttachment(ctx, gc, uid, strConvID, outboxID, name, public, membersType, filename,
		caption, callerPreview)
}

func ExtensionPostVideo(strConvID, name string, public bool, membersType int,
	caption string, inFilename string, mimeType string,
	duration, baseWidth, baseHeight, previewWidth, previewHeight int, previewData []byte) (err error) {
	defer kbCtx.Trace("ExtensionPostVideo", func() error { return err })()
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	defer func() { err = flattenError(err) }()
	uid, err := assertLoggedInUID(ctx, gc)
	if err != nil {
		return err
	}
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	filename, err := extensionCreateUploadTemp(ctx, gc, outboxID, inFilename)
	if err != nil {
		return err
	}
	// Compute preview result from the native params
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
	callerPreview := &chat1.MakePreviewRes{
		MimeType:        mimeType,
		PreviewMimeType: &previewMimeType,
		Location:        &location,
		Metadata:        &previewMD,
		BaseMetadata:    &baseMD,
	}
	return postFileAttachment(ctx, gc, uid, strConvID, outboxID, name, public, membersType, filename,
		caption, callerPreview)
}

func ExtensionPostFile(strConvID, name string, public bool, membersType int,
	caption string, filename string) (err error) {
	defer kbCtx.Trace("ExtensionPostFile", func() error { return err })()
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	defer func() { err = flattenError(err) }()
	uid, err := assertLoggedInUID(ctx, gc)
	if err != nil {
		return err
	}
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	return postFileAttachment(ctx, gc, uid, strConvID, outboxID, name, public, membersType, filename,
		caption, nil)
}

func extensionWaitForResult(ctx context.Context, strConvID string, cb chan struct{}) {
	// Wait for some time for success/failure before bailing out
	kbCtx.Log.CDebugf(ctx, "extensionWaitForResult: waiting for result")
	select {
	case <-cb:
	case <-time.After(30 * time.Second):
		kbCtx.Log.CDebugf(ctx, "extensionWaitForResult: timed out waiting for result, bailing out!")
		msg := "Your message is taking a long time to send, Keybase will be trying in the background."
		extensionPusher.LocalNotification("extension", msg, -1, "default", strConvID, "chat.extension")
	}
}

func postFileAttachment(ctx context.Context, gc *globals.Context, uid gregor1.UID,
	strConvID string, outboxID chat1.OutboxID, name string, public bool, membersType int, filename,
	caption string, callerPreview *chat1.MakePreviewRes) (err error) {

	name = restoreName(gc, name, chat1.ConversationMembersType(membersType))
	defer func() {
		if err == nil {
			putSavedConv(ctx, strConvID, name, public, membersType)
		}
	}()

	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	vis := keybase1.TLFVisibility_PRIVATE
	if public {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	sender := extensionNewSender(gc)
	if _, _, err = attachments.NewSender(gc).PostFileAttachmentMessage(ctx, sender, convID, name, vis,
		&outboxID, filename, caption, nil, 0, nil); err != nil {
		return err
	}
	cb := extensionListener.listenFor(outboxID)
	if _, err := gc.AttachmentUploader.Register(ctx, uid, convID, outboxID, caption,
		filename, nil, callerPreview); err != nil {
		return err
	}
	extensionRegisterSendNonblock(ctx, gc, convID, outboxID)
	extensionWaitForResult(ctx, strConvID, cb)
	return nil
}

func savedConvFile() *encrypteddb.EncryptedFile {
	path := filepath.Join(kbCtx.GetEnv().GetDataDir(), "saveconv.mpack")
	return encrypteddb.NewFile(kbCtx, path,
		func(ctx context.Context) ([32]byte, error) {
			return storage.GetSecretBoxKey(ctx, kbCtx, storage.DefaultSecretUI)
		})
}

func putSavedConv(ctx context.Context, strConvID, name string, public bool, membersType int) {
	item := storage.SharedInboxItem{
		ConvID:      strConvID,
		Name:        name,
		Public:      public,
		MembersType: chat1.ConversationMembersType(membersType),
	}
	if err := savedConvFile().Put(ctx, item); err != nil {
		kbCtx.Log.CDebugf(ctx, "putSavedConv: failed to write file: %s", err)
	}
}

func ExtensionGetSavedConv() string {
	defer kbCtx.Trace("ExtensionGetSavedConv", func() error { return nil })()
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	if _, err := assertLoggedInUID(ctx, gc); err != nil {
		kbCtx.Log.CDebugf(ctx, "ExtensionGetSavedConv: failed to get uid: %s", err)
		return ""
	}
	var item storage.SharedInboxItem
	if err := savedConvFile().Get(ctx, &item); err != nil {
		kbCtx.Log.CDebugf(ctx, "ExtensionGetSavedConv: failed to read saved conv: %s", err)
		return ""
	}
	dat, err := json.Marshal(presentInboxItem(item, kbCtx.GetEnv().GetUsername().String()))
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "ExtensionGetSavedConv: failed to marshal: %s", err)
		return ""
	}
	return string(dat)
}

// ExtensionForceGC Forces a gc
func ExtensionForceGC() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Free up gc memory first
	fmt.Printf("mem stats (before): alloc: %v sys: %v\n", m.Alloc, m.Sys)
	fmt.Printf("Starting force gc\n")
	debug.FreeOSMemory()
	fmt.Printf("Done force gc\n")
	runtime.ReadMemStats(&m)
	fmt.Printf("mem stats (after): alloc: %v sys: %v\n", m.Alloc, m.Sys)

	if !ExtensionIsInited() {
		fmt.Printf("Not initialized, bailing\n")
		return
	}

	// Free all caches, and run gc again to clear out anything
	fmt.Printf("Flushing global caches\n")
	kbCtx.FlushCaches()
	if _, ok := kbCtx.LocalChatDb.GetEngine().(*libkb.MemDb); ok {
		fmt.Printf("Nuking in memory chat db\n")
		kbCtx.LocalChatDb.Nuke()
	}
	if _, ok := kbCtx.LocalDb.GetEngine().(*libkb.MemDb); ok {
		fmt.Printf("Nuking in memory local db\n")
		kbCtx.LocalDb.Nuke()
	}
	debug.FreeOSMemory()
	fmt.Printf("Done flushing global caches\n")
	runtime.ReadMemStats(&m)
	fmt.Printf("mem stats (after flush): alloc: %v sys: %v\n", m.Alloc, m.Sys)
}
