package bots

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
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

type commandUpdaterJob struct {
	ConvID chat1.ConversationID
	Info   *chat1.BotInfo
}

type userCommandDesc struct {
	Description         string  `json:"description"`
	Name                string  `json:"name"`
	Usage               string  `json:"usage"`
	ExtendedDescription *string `json:"extended_description"`
}

func (c userCommandDesc) Export(username string) chat1.ConversationCommand {
	return chat1.ConversationCommand{
		Description: c.Description,
		Name:        c.Name,
		Usage:       c.Usage,
		HasHelpText: c.ExtendedDescription != nil,
		Username:    &username,
	}
}

type userCommandAdvertisement struct {
	Alias    string            `json:"alias"`
	Commands []userCommandDesc `json:"commands"`
}

type storageCommandAdvertisement struct {
	Advertisement userCommandAdvertisement
	Username      string
}

type commandsStorage struct {
	Advertisements []storageCommandAdvertisement `codec:"A"`
}

const commandsStorageVersion = 1

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
	commandUpdateCh chan commandUpdaterJob
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
		commandUpdateCh: make(chan commandUpdaterJob, 100),
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
	var s commandsStorage
	found, err := b.edb.Get(ctx, b.dbCommandsKey(convID), &s)
	if err != nil {
		return res, err
	}
	if !found {
		return nil, nil
	}
	for _, ad := range s.Advertisements {
		for _, desc := range ad.Advertisement.Commands {
			res = append(res, desc.Export(ad.Username))
		}
	}
	sort.Slice(res, func(i, j int) bool {
		l := res[i]
		r := res[j]
		if *l.Username < *r.Username {
			return true
		} else if *l.Username > *r.Username {
			return false
		} else {
			return l.Name < r.Name
		}
	})
	return res, nil
}

func (b *CachingBotCommandManager) UpdateCommands(ctx context.Context, convID chat1.ConversationID,
	info *chat1.BotInfo) (err error) {
	defer b.Trace(ctx, func() error { return err }, "UpdateCommands")()
	return b.queueCommandUpdate(ctx, convID, info)
}

func (b *CachingBotCommandManager) queueCommandUpdate(ctx context.Context, convID chat1.ConversationID,
	botInfo *chat1.BotInfo) error {
	select {
	case b.commandUpdateCh <- commandUpdaterJob{
		ConvID: convID,
		Info:   botInfo,
	}:
	default:
		return errors.New("queue full")
	}
	return nil
}

func (b *CachingBotCommandManager) getBotInfo(ctx context.Context, job commandUpdaterJob) (botInfo chat1.BotInfo, doUpdate bool, err error) {
	if job.Info != nil {
		return *job.Info, true, nil
	}
	convID := job.ConvID
	found, err := b.edb.Get(ctx, b.dbInfoKey(convID), &botInfo)
	if err != nil {
		return botInfo, false, err
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
		return botInfo, false, err
	}
	rtyp, err := res.Response.Typ()
	switch rtyp {
	case chat1.BotInfoResponseTyp_UPTODATE:
		return botInfo, false, nil
	case chat1.BotInfoResponseTyp_INFO:
		return res.Response.Info(), true, nil
	}
	return botInfo, false, errors.New("unknown response type")
}

func (b *CachingBotCommandManager) getConvAdvertisement(ctx context.Context, convID chat1.ConversationID,
	botUID gregor1.UID) (res *storageCommandAdvertisement) {
	tv, err := b.G().ConvSource.Pull(ctx, convID, b.uid, chat1.GetThreadReason_BOTCOMMANDS,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, &chat1.Pagination{Num: 1})
	if err != nil {
		b.Debug(ctx, "getConvAdvertisement: failed to read thread: %s", err)
		return nil
	}
	if len(tv.Messages) == 0 {
		b.Debug(ctx, "getConvAdvertisement: no messages")
		return nil
	}
	msg := tv.Messages[0]
	if !msg.IsValid() {
		b.Debug(ctx, "getConvAdvertisement: latest message is not valid")
		return nil
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_TEXT) {
		b.Debug(ctx, "getConvAdvertisement: latest message is not text")
		return nil
	}
	// make sure the sender is who the server said it is
	if !msg.Valid().ClientHeader.Sender.Eq(botUID) {
		b.Debug(ctx, "getConvAdvertisement: wrong sender: %s != %s", botUID, msg.Valid().ClientHeader.Sender)
		return nil
	}
	res = new(storageCommandAdvertisement)
	if err = json.Unmarshal([]byte(body.Text().Body), &res.Advertisement); err != nil {
		b.Debug(ctx, "getConvAdvertisement: failed to JSON decode: %s", err)
		return nil
	}
	res.Username = msg.Valid().SenderUsername
	return res
}

func (b *CachingBotCommandManager) commandUpdate(ctx context.Context, job commandUpdaterJob) (err error) {
	defer b.Trace(ctx, func() error { return err }, "commandUpdate")()
	botInfo, doUpdate, err := b.getBotInfo(ctx, job)
	if err != nil {
		return err
	}
	if !doUpdate {
		b.Debug(ctx, "commandUpdate: bot info uptodate, not updating")
		return nil
	}
	var s commandsStorage
	for _, cconv := range botInfo.CommandConvs {
		ad := b.getConvAdvertisement(ctx, cconv.ConvID, cconv.Uid)
		if ad != nil {
			s.Advertisements = append(s.Advertisements, *ad)
		}
	}
	if err := b.edb.Put(ctx, b.dbCommandsKey(job.ConvID), s); err != nil {
		return err
	}
	// alert that the conv is now updated
	b.G().Syncer.SendChatStaleNotifications(ctx, b.uid, []chat1.ConversationStaleUpdate{
		chat1.ConversationStaleUpdate{
			ConvID:     job.ConvID,
			UpdateType: chat1.StaleUpdateType_CONVUPDATE,
		}}, true)
	return nil
}

func (b *CachingBotCommandManager) commandUpdateLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	for {
		select {
		case job := <-b.commandUpdateCh:
			if err := b.commandUpdate(ctx, job); err != nil {
				b.Debug(ctx, "commandUpdateLoop: failed to update: %s", err)
			}
		case <-stopCh:
			return nil
		}
	}
}
