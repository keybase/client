package tlfupgrade

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

type BackgroundTLFUpdater struct {
	libkb.Contextified
	sync.Mutex

	initialWait time.Duration
	errWait     time.Duration
	successWait time.Duration
	clock       clockwork.Clock
	shutdownCh  chan struct{}
	running     bool

	// testing
	testingAPIServer  libkb.API
	testingChatHelper libkb.ChatHelper
	upgradeCh         *chan keybase1.TLFID
}

func NewBackgroundTLFUpdater(g *libkb.GlobalContext) *BackgroundTLFUpdater {
	b := &BackgroundTLFUpdater{
		Contextified: libkb.NewContextified(g),
		initialWait:  10 * time.Second,
		errWait:      20 * time.Second,
		successWait:  time.Minute,
		shutdownCh:   make(chan struct{}),
		clock:        clockwork.NewRealClock(),
	}
	g.PushShutdownHook(func() error { return b.Shutdown() })
	return b
}

func (b *BackgroundTLFUpdater) debug(ctx context.Context, msg string, args ...interface{}) {
	b.G().Log.CDebugf(ctx, "BackgroundTLFUpdater: %s", fmt.Sprintf(msg, args...))
}

func (b *BackgroundTLFUpdater) api() libkb.API {
	if b.testingAPIServer != nil {
		return b.testingAPIServer
	}
	return b.G().API
}

func (b *BackgroundTLFUpdater) chat() libkb.ChatHelper {
	if b.testingChatHelper != nil {
		return b.testingChatHelper
	}
	return b.G().ChatHelper
}

func (b *BackgroundTLFUpdater) Run() {
	b.runAll()
	go b.monitorAppState()
}

func (b *BackgroundTLFUpdater) runAll() {
	b.Lock()
	defer b.Unlock()
	uid := b.G().Env.GetUID()
	if uid.IsNil() {
		b.debug(context.Background(), "not logged in, not starting")
		return
	}
	if !b.running && b.G().Env.GetChatMemberType() != "kbfs" {
		b.debug(context.Background(), "starting up")
		b.shutdownCh = make(chan struct{})
		b.running = true
		go b.runAppType(keybase1.TeamApplication_CHAT)
	}
}

func (b *BackgroundTLFUpdater) Shutdown() error {
	b.Lock()
	defer b.Unlock()
	if b.running {
		b.debug(context.Background(), "shutting down")
		b.running = false
		close(b.shutdownCh)
	}
	return nil
}

func (b *BackgroundTLFUpdater) monitorAppState() {
	ctx := context.Background()
	b.debug(ctx, "monitorAppState: starting up")
	state := keybase1.AppState_FOREGROUND
	for {
		state = <-b.G().AppState.NextUpdate(&state)
		switch state {
		case keybase1.AppState_FOREGROUND:
			b.debug(ctx, "monitorAppState: foregrounded, running all after: %v", b.initialWait)
			b.runAll()
		case keybase1.AppState_BACKGROUND:
			b.debug(ctx, "monitorAppState: backgrounded, suspending upgrade thread")
			b.Shutdown()
		}
	}
}

func (b *BackgroundTLFUpdater) runAppType(appType keybase1.TeamApplication) {
	var tlf *GetTLFForUpgradeAvailableRes
	ctx := context.Background()
	nextTime := b.deadline(b.initialWait)
	for {
		b.debug(ctx, "runAppType(%v): waiting until %v", appType, nextTime)
		select {
		case <-b.shutdownCh:
			b.debug(ctx, "runAppType(%v): shutdown", appType)
			return
		case <-b.clock.AfterTime(nextTime):
			b.debug(ctx, "runAppType(%v): woken up", appType)
			tlf, nextTime = b.getTLFToUpgrade(ctx, appType)
			if tlf != nil {
				b.upgradeTLF(ctx, tlf.TlfName, tlf.TlfID, tlf.IsPublic, appType)
			}
		}
	}
}

type getUpgradeRes struct {
	Status libkb.AppStatus `json:"status"`
	GetTLFForUpgradeRes
}

func (r *getUpgradeRes) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func (b *BackgroundTLFUpdater) deadline(d time.Duration) time.Time {
	return b.clock.Now().Add(d)
}

func (b *BackgroundTLFUpdater) getTLFToUpgrade(ctx context.Context, appType keybase1.TeamApplication) (*GetTLFForUpgradeAvailableRes, time.Time) {
	arg := libkb.NewAPIArgWithNetContext(ctx, "kbfs/upgrade")
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args.Add("app_type", libkb.I{Val: int(appType)})
	var res getUpgradeRes
	if err := b.api().GetDecode(arg, &res); err != nil {
		b.debug(ctx, "getTLFToUpgrade: API fail: %s", err)
		return nil, b.deadline(b.errWait)
	}
	typ, err := res.Typ()
	if err != nil {
		b.debug(ctx, "getTLFToUpgrade: failed to get typ: %s", err)
		return nil, b.deadline(b.errWait)
	}
	switch typ {
	case GetTLFForUpgradeResType_TLFAVAILABLE:
		tlf := res.Tlfavailable()
		b.debug(ctx, "getTLFUpgrade: found TLF to upgrade: %s apptype: %v", tlf.TlfID, appType)
		return &tlf, b.deadline(b.successWait)
	case GetTLFForUpgradeResType_DELAY:
		b.debug(ctx, "getTLFUpgrade: delayed: reason: %s delay: %v", res.Delay().Reason, res.Delay().Delay)
		return nil, gregor1.FromTime(res.Delay().Delay)
	case GetTLFForUpgradeResType_DISABLED:
		b.debug(ctx, "getTLFUpgrade: disabled: delay: %v", res.Disabled().Delay)
		return nil, gregor1.FromTime(res.Disabled().Delay)
	case GetTLFForUpgradeResType_ERR:
		b.debug(ctx, "getTLFUpgrade: server err: %s delay: %v", res.Err().Error, res.Err().Delay)
		return nil, gregor1.FromTime(res.Err().Delay)
	default:
		b.debug(ctx, "getTLFUpgrade: unknown result type: %v", typ)
	}
	return nil, b.deadline(b.errWait)
}

func (b *BackgroundTLFUpdater) upgradeTLF(ctx context.Context, tlfName string, tlfID keybase1.TLFID,
	public bool, appType keybase1.TeamApplication) {
	switch appType {
	case keybase1.TeamApplication_CHAT:
		b.upgradeTLFForChat(ctx, tlfName, tlfID, public)
	default:
		b.debug(ctx, "upgradeTLF: unknown app type: %v", appType)
	}
}

func (b *BackgroundTLFUpdater) upgradeTLFForChat(ctx context.Context, tlfName string, tlfID keybase1.TLFID,
	public bool) {
	chatTLFID, err := chat1.MakeTLFID(tlfID.String())
	if err != nil {
		b.debug(ctx, "upgradeTLFForChat: invalid TLFID: %s", err)
	}
	if err := b.chat().UpgradeKBFSToImpteam(ctx, tlfName, chatTLFID, public); err != nil {
		b.debug(ctx, "upgradeTLFForChat: failed to upgrade TLFID for chat: tlfID: %v err: %s", tlfID, err)
	}
	if b.upgradeCh != nil {
		*b.upgradeCh <- tlfID
	}
}
