package bots

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/encrypteddb"
	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type commandsStorage struct {
	Commands []chat1.ConversationCommand
}

type CachingBotCommandManager struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid     gregor1.UID
	started bool
	eg      errgroup.Group
	stopCh  chan struct{}

	ri              func() chat1.RemoteInterface
	edb             *encrypteddb.EncryptedDB
	commandUpdateCh chan chat1.BotInfo
}

func NewCachingBotCommandManager(g *globals.Context, ri func() chat1.RemoteInterface) *CachingBotCommandManager {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG(), storage.DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &CachingBotCommandManager{
		Contextified:    globals.NewContextified(g),
		DebugLabeler:    utils.NewDebugLabeler(g.GetLog(), "CachingBotCommandManager", false),
		ri:              ri,
		edb:             encrypteddb.New(g.ExternalG(), dbFn, keyFn),
		commandUpdateCh: make(chan chat1.BotInfo, 100),
	}
}

func (b *CachingBotCommandManager) Start(ctx context.Context, uid gregor1.UID) {
	defer b.Trace(ctx, func() error { return nil }, "Start")()
	b.Lock()
	defer b.Unlock()
	if b.started {
		return
	}
	b.stopCh = make(chan struct{})
	b.started = true
	b.uid = uid
	b.eg.Go(func() error { return b.commandUpdateLoop(b.stopCh) })
}

func (b *CachingBotCommandManager) Stop(ctx context.Context) chan struct{} {
	defer b.Trace(ctx, func() error { return nil }, "Stop")()
	b.Lock()
	defer b.Unlock()
	ch := make(chan struct{})
	if b.started {
		close(b.stopCh)
		b.started = false
		go func() {
			b.eg.Wait()
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (b *CachingBotCommandManager) Advertise(ctx context.Context, commands []chat1.BotCommands) (err error) {
	defer b.Trace(ctx, func() error { return err }, "Advertise")()
	if _, err := b.ri().AdvertiseBotCommands(ctx, commands); err != nil {
		return err
	}
	return nil
}

func (b *CachingBotCommandManager) Clear(ctx context.Context) (err error) {
	defer b.Trace(ctx, func() error { return err }, "Clear")()
	if _, err := b.ri().ClearBotCommands(ctx); err != nil {
		return err
	}
	return nil
}

func (b *CachingBotCommandManager) dbInfoKey(convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Key: fmt.Sprintf("ik:%s:%s", b.uid, convID),
		Typ: libkb.DBChatBotCommands,
	}
}

func (b *CachingBotCommandManager) dbCommandsKey(convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Key: fmt.Sprintf("ck:%s:%s", b.uid, convID),
		Typ: libkb.DBChatBotCommands,
	}
}

func (b *CachingBotCommandManager) ListCommands(ctx context.Context, convID chat1.ConversationID) (res []chat1.ConversationCommand, err error) {
	defer b.Trace(ctx, func() error { return err }, "ListCommands")()
	var commands commandsStorage
	found, err := b.edb.Get(ctx, b.dbCommandsKey(convID), &commands)
	if err != nil {
		return res, err
	}
	if !found {
		return nil, nil
	}
	return commands.Commands, nil
}

func (b *CachingBotCommandManager) UpdateCommands(ctx context.Context, convID chat1.ConversationID) (err error) {
	defer b.Trace(ctx, func() error { return err }, "UpdateCommands")()
	var botInfo chat1.BotInfo
	found, err := b.edb.Get(ctx, b.dbInfoKey(convID), &botInfo)
	if err != nil {
		return err
	}
	var infoHash chat1.BotInfoHash
	if found {
		infoHash = botInfo.Hash()
	}
	res, err := b.ri().GetBotInfo(ctx, chat1.GetBotInfoArg{
		ConvID:   convID,
		InfoHash: infoHash,
	})
	if err != nil {
		return err
	}
	rtyp, err := res.Response.Typ()
	switch rtyp {
	case chat1.BotInfoResponseTyp_UPTODATE:
	case chat1.BotInfoResponseTyp_INFO:
		b.queueCommandUpdate(ctx, res.Response.Info())
	}
	return nil
}

func (b *CachingBotCommandManager) queueCommandUpdate(ctx context.Context, info chat1.BotInfo) {
	select {
	case b.commandUpdateCh <- info:
	default:
		b.Debug(ctx, "queueCommandUpdate: queue full failing")
	}
}

func (b *CachingBotCommandManager) commandUpdate(ctx context.Context, info chat1.BotInfo) {

}

func (b *CachingBotCommandManager) commandUpdateLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	for {
		select {
		case info := <-b.commandUpdateCh:
			b.commandUpdate(ctx, info)
		case <-stopCh:
			return nil
		}
	}
}
