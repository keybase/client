package bots

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/encrypteddb"
	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type commandUpdaterJob struct {
	convID     chat1.ConversationID
	info       *chat1.BotInfo
	completeCh chan error
	uiCh       chan error
}

type userCommandAdvertisement struct {
	Alias    *string                     `json:"alias,omitempty"`
	Commands []chat1.UserBotCommandInput `json:"commands"`
}

type storageCommandAdvertisement struct {
	Advertisement userCommandAdvertisement
	Username      string
}

type commandsStorage struct {
	Advertisements []storageCommandAdvertisement `codec:"A"`
}

const commandsStorageVersion = 1

var commandsPublicTopicName = "___keybase_botcommands_public"

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
	queuedUpdatedMu sync.Mutex
	queuedUpdates   map[string]bool
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
		queuedUpdates:   make(map[string]bool),
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

func (b *CachingBotCommandManager) getMyUsername(ctx context.Context) (string, error) {
	nn, err := b.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(b.uid.String()))
	if err != nil {
		return "", err
	}
	return nn.String(), nil
}

func (b *CachingBotCommandManager) createConv(ctx context.Context, param chat1.AdvertiseCommandsParam) (res chat1.ConversationLocal, err error) {
	username, err := b.getMyUsername(ctx)
	if err != nil {
		return res, err
	}
	switch param.Typ {
	case chat1.BotCommandsAdvertisementTyp_PUBLIC:
		return b.G().ChatHelper.NewConversation(ctx, b.uid, username, &commandsPublicTopicName,
			chat1.TopicType_DEV, chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFVisibility_PUBLIC)
	case chat1.BotCommandsAdvertisementTyp_TLFID_MEMBERS, chat1.BotCommandsAdvertisementTyp_TLFID_CONVS:
		if param.TeamName == nil {
			return res, errors.New("missing team name")
		}
		topicName := fmt.Sprintf("___keybase_botcommands_team_%s_%v", username, param.Typ)
		return b.G().ChatHelper.NewConversationSkipFindExisting(ctx, b.uid, *param.TeamName, &topicName,
			chat1.TopicType_DEV, chat1.ConversationMembersType_TEAM, keybase1.TLFVisibility_PRIVATE)
	default:
		return res, errors.New("unknown bot advertisement typ")
	}
}

func (b *CachingBotCommandManager) Advertise(ctx context.Context, alias *string,
	ads []chat1.AdvertiseCommandsParam) (err error) {
	defer b.Trace(ctx, func() error { return err }, "Advertise")()
	var remotes []chat1.RemoteBotCommandsAdvertisement
	for _, ad := range ads {
		// create conversations with the commands
		conv, err := b.createConv(ctx, ad)
		if err != nil {
			return err
		}
		// marshal contents
		payload := userCommandAdvertisement{
			Alias:    alias,
			Commands: ad.Commands,
		}
		dat, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		// write out commands to conv
		vis := keybase1.TLFVisibility_PUBLIC
		if ad.Typ != chat1.BotCommandsAdvertisementTyp_PUBLIC {
			vis = keybase1.TLFVisibility_PRIVATE
		}
		if err := b.G().ChatHelper.SendMsgByID(ctx, conv.GetConvID(), conv.Info.TlfName,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: string(dat),
			}), chat1.MessageType_TEXT, vis); err != nil {
			return err
		}
		remote, err := ad.ToRemote(conv.GetConvID(), &conv.Info.Triple.Tlfid)
		if err != nil {
			return err
		}
		remotes = append(remotes, remote)
	}
	if _, err := b.ri().AdvertiseBotCommands(ctx, remotes); err != nil {
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

func (b *CachingBotCommandManager) ListCommands(ctx context.Context, convID chat1.ConversationID) (res []chat1.UserBotCommandOutput, err error) {
	defer b.Trace(ctx, func() error { return err }, "ListCommands")()
	var s commandsStorage
	found, err := b.edb.Get(ctx, b.dbCommandsKey(convID), &s)
	if err != nil {
		return res, err
	}
	if !found {
		return nil, nil
	}
	cmdDedup := make(map[string]bool)
	for _, ad := range s.Advertisements {
		for _, cmd := range ad.Advertisement.Commands {
			key := cmd.Name + ad.Username
			if !cmdDedup[key] {
				res = append(res, cmd.ToOutput(ad.Username))
				cmdDedup[key] = true
			}
		}
	}
	sort.Slice(res, func(i, j int) bool {
		l := res[i]
		r := res[j]
		if l.Username < r.Username {
			return true
		} else if l.Username > r.Username {
			return false
		} else {
			return l.Name < r.Name
		}
	})
	return res, nil
}

func (b *CachingBotCommandManager) UpdateCommands(ctx context.Context, convID chat1.ConversationID,
	info *chat1.BotInfo) (completeCh chan error, err error) {
	defer b.Trace(ctx, func() error { return err }, "UpdateCommands")()
	completeCh = make(chan error, 1)
	uiCh := make(chan error, 1)
	return completeCh, b.queueCommandUpdate(ctx, commandUpdaterJob{
		convID:     convID,
		info:       info,
		completeCh: completeCh,
		uiCh:       uiCh,
	})
}

type nullChatUI struct {
	libkb.ChatUI
}

func (n nullChatUI) ChatBotCommandsUpdateStatus(ctx context.Context, convID chat1.ConversationID,
	status chat1.UIBotCommandsUpdateStatus) error {
	return nil
}

func (b *CachingBotCommandManager) getChatUI(ctx context.Context) libkb.ChatUI {
	ui, err := b.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		b.Debug(ctx, "getChatUI: no chat UI found: err: %s", err)
		return nullChatUI{}
	}
	return ui
}

func (b *CachingBotCommandManager) runCommandUpdateUI(ctx context.Context, job commandUpdaterJob) {
	b.getChatUI(ctx).ChatBotCommandsUpdateStatus(ctx, job.convID,
		chat1.UIBotCommandsUpdateStatus_BLANK)
	sentUpdating := false
	for {
		select {
		case err := <-job.uiCh:
			if sentUpdating {
				updateStatus := chat1.UIBotCommandsUpdateStatus_UPTODATE
				if err != nil {
					updateStatus = chat1.UIBotCommandsUpdateStatus_FAILED
				}
				b.getChatUI(ctx).ChatBotCommandsUpdateStatus(ctx, job.convID, updateStatus)
			}
			return
		case <-time.After(800 * time.Millisecond):
			b.getChatUI(ctx).ChatBotCommandsUpdateStatus(ctx, job.convID,
				chat1.UIBotCommandsUpdateStatus_UPDATING)
			sentUpdating = true
		}
	}
}

func (b *CachingBotCommandManager) queueCommandUpdate(ctx context.Context, job commandUpdaterJob) error {
	b.queuedUpdatedMu.Lock()
	defer b.queuedUpdatedMu.Unlock()
	if b.queuedUpdates[job.convID.String()] {
		b.Debug(ctx, "queueCommandUpdate: skipping already queued: %s", job.convID)
		return nil
	}
	select {
	case b.commandUpdateCh <- job:
		go b.runCommandUpdateUI(globals.BackgroundChatCtx(ctx, b.G()), job)
		b.queuedUpdates[job.convID.String()] = true
	default:
		return errors.New("queue full")
	}
	return nil
}

func (b *CachingBotCommandManager) getBotInfo(ctx context.Context, job commandUpdaterJob) (botInfo chat1.BotInfo, doUpdate bool, err error) {
	if job.info != nil {
		return *job.info, true, nil
	}
	convID := job.convID
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
		if err := b.edb.Put(ctx, b.dbInfoKey(convID), res.Response.Info()); err != nil {
			return botInfo, false, err
		}
		return res.Response.Info(), true, nil
	}
	return botInfo, false, errors.New("unknown response type")
}

func (b *CachingBotCommandManager) getConvAdvertisement(ctx context.Context, convID chat1.ConversationID,
	botUID gregor1.UID) (res *storageCommandAdvertisement) {
	b.Debug(ctx, "getConvAdvertisement: reading commands from: %s for uid: %s", convID, botUID)
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
	ctx = globals.ChatCtx(ctx, b.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer b.Trace(ctx, func() error { return err }, "commandUpdate")()
	defer func() {
		b.queuedUpdatedMu.Lock()
		delete(b.queuedUpdates, job.convID.String())
		b.queuedUpdatedMu.Unlock()
		job.uiCh <- err
		job.completeCh <- err
	}()
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
	if err := b.edb.Put(ctx, b.dbCommandsKey(job.convID), s); err != nil {
		return err
	}
	// alert that the conv is now updated
	if err := storage.NewInbox(b.G()).IncrementLocalConvVersion(ctx, b.uid, job.convID); err != nil {
		b.Debug(ctx, "commandUpdate: unable to IncrementLocalConvVersion, err", err)
	}
	conv, err := utils.GetVerifiedConv(ctx, b.G(), b.uid, job.convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	username, err := b.getMyUsername(ctx)
	if err != nil {
		return err
	}
	act := chat1.NewChatActivityWithConvsUpdated(chat1.ConvsUpdated{
		Items: []chat1.InboxUIItem{utils.PresentConversationLocal(ctx, conv, username)},
	})
	b.G().ActivityNotifier.Activity(ctx, b.uid, chat1.TopicType_CHAT, &act,
		chat1.ChatActivitySource_LOCAL)
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
