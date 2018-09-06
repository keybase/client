package keybase

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"

	"github.com/keybase/client/go/chat"
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

var initExtensionOnce sync.Once
var ri chat1.RemoteClient

func ExtensionInit(homeDir string, mobileSharedHome string, logFile string, runModeStr string,
	accessGroupOverride bool, externalDNSNSFetcher ExternalDNSNSFetcher, nvh NativeVideoHelper) (err error) {
	defer func() { err = flattenError(err) }()
	initExtensionOnce.Do(func() {
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
			return
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
		}
		if err = kbCtx.Configure(config, usage); err != nil {
			return
		}

		svc := service.NewService(kbCtx, false)
		if err = svc.StartLoopbackServer(); err != nil {
			return
		}
		kbCtx.SetService()
		uir := service.NewUIRouter(kbCtx)
		kbCtx.SetUIRouter(uir)
		kbCtx.SetDNSNameServerFetcher(dnsNSFetcher)
		svc.SetupCriticalSubServices()

		svc.SetupChatModules(func() chat1.RemoteInterface { return ri })
		gc := globals.NewContext(kbCtx, kbChatCtx)
		if ri, err = getGregorClient(context.Background(), gc); err != nil {
			return
		}
		kbChatCtx = svc.ChatContextified.ChatG()
		kbChatCtx.NativeVideoHelper = newVideoHelper(nvh)
		kbChatCtx.InboxSource = chat.NewRemoteInboxSource(gc, func() chat1.RemoteInterface { return ri })
	})
	return err
}

func ExtensionGetInbox() string {
	defer kbCtx.Trace("ExtensionGetInbox", func() error { return nil })()
	var err error
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))
	uid := gregor1.UID(gc.GetEnv().GetUID().ToBytes())
	inbox := storage.NewInbox(gc, uid)
	sharedInbox, err := inbox.ReadShared(ctx)
	if err != nil {
		return ""
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
		return ""
	}
	return string(dat)
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

func ExtensionPostURL(strConvID, name string, public bool, body string) (err error) {
	defer kbCtx.Trace("ExtensionPostURL", func() error { return err })()
	defer func() { err = flattenError(err) }()

	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := chat.Context(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))

	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	sender := chat.NewBlockingSender(gc, chat.NewBoxer(gc), func() chat1.RemoteInterface { return ri })
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
