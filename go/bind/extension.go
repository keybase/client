package keybase

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/client/go/uidmap"
	context "golang.org/x/net/context"
)

func ExtensionInit(homeDir string, mobileSharedHome string, logFile string, runModeStr string,
	accessGroupOverride bool, externalDNSNSFetcher ExternalDNSNSFetcher, nvh NativeVideoHelper) (err error) {
	defer func() { err = flattenError(err) }()

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
	runMode, err := libkb.StringToRunMode(runModeStr)
	if err != nil {
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
	}
	err = kbCtx.Configure(config, usage)
	if err != nil {
		return err
	}

	svc := service.NewService(kbCtx, false)
	err = svc.StartLoopbackServer()
	if err != nil {
		return err
	}
	kbCtx.SetService()
	uir := service.NewUIRouter(kbCtx)
	kbCtx.SetUIRouter(uir)
	kbCtx.SetDNSNameServerFetcher(dnsNSFetcher)
	svc.SetupCriticalSubServices()
	svc.SetupChatModules()
	kbChatCtx = svc.ChatContextified.ChatG()
	kbChatCtx.NativeVideoHelper = newVideoHelper(nvh)

	return nil
}

func ExtensionGetInbox() string {
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
	dat, err := json.Marshal(sharedInbox)
	if err != nil {
		return ""
	}
	return string(dat)
}
