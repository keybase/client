package bots

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"golang.org/x/sync/errgroup"
)

const storageVersion = 1

type uiResult struct {
	err      error
	settings chat1.UIBotCommandsUpdateSettings
}

type commandUpdaterJob struct {
	convID      chat1.ConversationID
	info        *chat1.BotInfo
	completeChs []chan error
	uiCh        chan uiResult
}

type userCommandAdvertisement struct {
	Alias    *string                     `json:"alias,omitempty"`
	Commands []chat1.UserBotCommandInput `json:"commands"`
}

type storageCommandAdvertisement struct {
	Advertisement     userCommandAdvertisement
	UntrustedTeamRole keybase1.TeamRole
	UID               gregor1.UID
	Username          string
}

type commandsStorage struct {
	Advertisements []storageCommandAdvertisement `codec:"A"`
	Version        int                           `codec:"V"`
}

var commandsPublicTopicName = "___keybase_botcommands_public"

type nameInfoSourceFn func(ctx context.Context, g *globals.Context, membersType chat1.ConversationMembersType) types.NameInfoSource

type CachingBotCommandManager struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid     gregor1.UID
	started bool
	eg      errgroup.Group
	stopCh  chan struct{}

	ri              func() chat1.RemoteInterface
	nameInfoSource  nameInfoSourceFn
	edb             *encrypteddb.EncryptedDB
	commandUpdateCh chan *commandUpdaterJob
	queuedUpdatedMu sync.Mutex
	queuedUpdates   map[chat1.ConvIDStr]*commandUpdaterJob
}

func NewCachingBotCommandManager(g *globals.Context, ri func() chat1.RemoteInterface,
	nameInfoSource nameInfoSourceFn) *CachingBotCommandManager {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &CachingBotCommandManager{
		Contextified:    globals.NewContextified(g),
		DebugLabeler:    utils.NewDebugLabeler(g.ExternalG(), "CachingBotCommandManager", false),
		ri:              ri,
		edb:             encrypteddb.New(g.ExternalG(), dbFn, keyFn),
		commandUpdateCh: make(chan *commandUpdaterJob, 100),
		queuedUpdates:   make(map[chat1.ConvIDStr]*commandUpdaterJob),
		nameInfoSource:  nameInfoSource,
	}
}

func (b *CachingBotCommandManager) Start(ctx context.Context, uid gregor1.UID) {
	defer b.Trace(ctx, nil, "Start")()
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
	defer b.Trace(ctx, nil, "Stop")()
	b.Lock()
	defer b.Unlock()
	ch := make(chan struct{})
	if b.started {
		close(b.stopCh)
		b.started = false
		go func() {
			err := b.eg.Wait()
			if err != nil {
				b.Debug(ctx, "CachingBotCommandManager: error waiting: %+v", err)
			}
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

func (b *CachingBotCommandManager) deriveMembersType(ctx context.Context, name string) (chat1.ConversationMembersType, error) {
	_, err := teams.Load(ctx, b.G().GlobalContext, keybase1.LoadTeamArg{Name: name})
	switch err.(type) {
	case nil:
		return chat1.ConversationMembersType_TEAM, nil
	case teams.TeamDoesNotExistError:
		return chat1.ConversationMembersType_IMPTEAMNATIVE, nil
	default:
		// https://github.com/keybase/client/blob/249cfcb4b4bd6dcc50d207d0b88eee455a7f6c2d/go/protocol/keybase1/extras.go#L2249
		if strings.Contains(err.Error(), "team names must be between 2 and 16 characters long") ||
			strings.Contains(err.Error(), "Keybase team names must be letters") {
			return chat1.ConversationMembersType_IMPTEAMNATIVE, nil
		}
		return 0, err
	}
}

func (b *CachingBotCommandManager) createConv(
	ctx context.Context, typ chat1.BotCommandsAdvertisementTyp, teamName *string, convID *chat1.ConversationID,
) (res chat1.ConversationLocal, err error) {
	username, err := b.getMyUsername(ctx)
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.BotCommandsAdvertisementTyp_PUBLIC:
		if teamName != nil {
			return res, errors.New("team name cannot be specified for public advertisements")
		} else if convID != nil {
			return res, errors.New("convID cannot be specified for public advertisements")
		}

		res, _, err = b.G().ChatHelper.NewConversation(ctx, b.uid, username, &commandsPublicTopicName,
			chat1.TopicType_DEV, chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFVisibility_PUBLIC)
		return res, err
	case chat1.BotCommandsAdvertisementTyp_TLFID_MEMBERS, chat1.BotCommandsAdvertisementTyp_TLFID_CONVS:
		if teamName == nil {
			return res, errors.New("missing team name")
		} else if convID != nil {
			return res, errors.New("convID cannot be specified for team advertisments use type 'conv'")
		}

		topicName := fmt.Sprintf("___keybase_botcommands_team_%s_%v", username, typ)
		membersType, err := b.deriveMembersType(ctx, *teamName)
		if err != nil {
			return res, err
		}
		res, _, err = b.G().ChatHelper.NewConversationSkipFindExisting(ctx, b.uid, *teamName, &topicName,
			chat1.TopicType_DEV, membersType, keybase1.TLFVisibility_PRIVATE)
		return res, err
	case chat1.BotCommandsAdvertisementTyp_CONV:
		if teamName != nil {
			return res, errors.New("unexpected team name")
		} else if convID == nil {
			return res, errors.New("missing convID")
		}

		topicName := fmt.Sprintf("___keybase_botcommands_conv_%s_%v", username, typ)
		convs, err := b.G().ChatHelper.FindConversationsByID(ctx, []chat1.ConversationID{*convID})
		if err != nil {
			return res, err
		} else if len(convs) != 1 {
			return res, errors.New("Unable able to find conversation for advertisement")
		}
		conv := convs[0]
		res, _, err = b.G().ChatHelper.NewConversationSkipFindExisting(ctx, b.uid, conv.Info.TlfName, &topicName,
			chat1.TopicType_DEV, conv.Info.MembersType, keybase1.TLFVisibility_PRIVATE)
		return res, err
	default:
		return res, fmt.Errorf("unknown bot advertisement typ %q", typ)
	}
}

func (b *CachingBotCommandManager) PublicCommandsConv(ctx context.Context, username string) (*chat1.ConversationID, error) {
	convs, err := b.G().ChatHelper.FindConversations(ctx, username, &commandsPublicTopicName,
		chat1.TopicType_DEV, chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFVisibility_PUBLIC)
	if err != nil {
		return nil, err
	}
	if len(convs) != 1 {
		b.Debug(ctx, "PublicCommandsConv: no command conv found")
		return nil, nil
	}
	convID := convs[0].GetConvID()
	return &convID, nil
}

func (b *CachingBotCommandManager) Advertise(ctx context.Context, alias *string,
	ads []chat1.AdvertiseCommandsParam) (err error) {
	defer b.Trace(ctx, &err, "Advertise")()
	remotes := make([]chat1.RemoteBotCommandsAdvertisement, 0, len(ads))
	for _, ad := range ads {
		// create conversations with the commands
		conv, err := b.createConv(ctx, ad.Typ, ad.TeamName, ad.ConvID)
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
		var vis keybase1.TLFVisibility
		var tlfID *chat1.TLFID
		var adConvID *chat1.ConversationID
		switch ad.Typ {
		case chat1.BotCommandsAdvertisementTyp_PUBLIC:
			vis = keybase1.TLFVisibility_PUBLIC
		case chat1.BotCommandsAdvertisementTyp_CONV:
			vis = keybase1.TLFVisibility_PRIVATE
			adConvID = ad.ConvID
		default:
			tlfID = &conv.Info.Triple.Tlfid
			vis = keybase1.TLFVisibility_PRIVATE
		}
		remote, err := ad.ToRemote(conv.GetConvID(), tlfID, adConvID)
		if err != nil {
			return err
		}
		// write out commands to conv
		if err := b.G().ChatHelper.SendMsgByID(ctx, conv.GetConvID(), conv.Info.TlfName,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: string(dat),
			}), chat1.MessageType_TEXT, vis); err != nil {
			return err
		}
		remotes = append(remotes, remote)
	}
	if _, err := b.ri().AdvertiseBotCommands(ctx, remotes); err != nil {
		return err
	}
	return nil
}

func (b *CachingBotCommandManager) Clear(ctx context.Context, filter *chat1.ClearBotCommandsFilter) (err error) {
	defer b.Trace(ctx, &err, "Clear")()
	var remote *chat1.RemoteClearBotCommandsFilter
	if filter != nil {
		remote = new(chat1.RemoteClearBotCommandsFilter)
		conv, err := b.createConv(ctx, filter.Typ, filter.TeamName, filter.ConvID)
		if err != nil {
			return err
		}

		var tlfID *chat1.TLFID
		var convID *chat1.ConversationID
		switch filter.Typ {
		case chat1.BotCommandsAdvertisementTyp_PUBLIC:
		case chat1.BotCommandsAdvertisementTyp_TLFID_CONVS, chat1.BotCommandsAdvertisementTyp_TLFID_MEMBERS:
			tlfID = &conv.Info.Triple.Tlfid
		case chat1.BotCommandsAdvertisementTyp_CONV:
			convID = filter.ConvID
		}

		*remote, err = filter.ToRemote(tlfID, convID)
		if err != nil {
			return err
		}
	}
	if _, err := b.ri().ClearBotCommands(ctx, remote); err != nil {
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

func (b *CachingBotCommandManager) ListCommands(ctx context.Context, convID chat1.ConversationID) (res []chat1.UserBotCommandOutput, alias map[string]string, err error) {
	defer b.Trace(ctx, &err, "ListCommands")()
	alias = make(map[string]string)
	dbKey := b.dbCommandsKey(convID)
	var s commandsStorage
	found, err := b.edb.Get(ctx, dbKey, &s)
	if err != nil {
		b.Debug(ctx, "ListCommands: failed to read cache: %s", err)
		if err := b.edb.Delete(ctx, dbKey); err != nil {
			b.Debug(ctx, "edb.Delete: %v", err)
		}
		found = false
	}
	if !found {
		return res, alias, nil
	}
	if s.Version != storageVersion {
		b.Debug(ctx, "ListCommands: deleting old version %d vs %d", s.Version, storageVersion)
		if err := b.edb.Delete(ctx, dbKey); err != nil {
			b.Debug(ctx, "edb.Delete: %v", err)
		}
		return res, alias, nil
	}

	cmdDedup := make(map[string]bool)
	for _, ad := range s.Advertisements {
		ad.Username = libkb.NewNormalizedUsername(ad.Username).String()
		if ad.Advertisement.Alias != nil {
			alias[ad.Username] = *ad.Advertisement.Alias
		}
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
	return res, alias, nil
}

func (b *CachingBotCommandManager) UpdateCommands(ctx context.Context, convID chat1.ConversationID,
	info *chat1.BotInfo) (completeCh chan error, err error) {
	defer b.Trace(ctx, &err, "UpdateCommands")()
	completeCh = make(chan error, 1)
	uiCh := make(chan uiResult, 1)
	return completeCh, b.queueCommandUpdate(ctx, &commandUpdaterJob{
		convID:      convID,
		info:        info,
		completeChs: []chan error{completeCh},
		uiCh:        uiCh,
	})
}

func (b *CachingBotCommandManager) getChatUI(ctx context.Context) libkb.ChatUI {
	ui, err := b.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		b.Debug(ctx, "getChatUI: no chat UI found: err: %s", err)
		return utils.NullChatUI{}
	}
	return ui
}

func (b *CachingBotCommandManager) runCommandUpdateUI(ctx context.Context, job *commandUpdaterJob) {
	err := b.getChatUI(ctx).ChatBotCommandsUpdateStatus(ctx, job.convID,
		chat1.NewUIBotCommandsUpdateStatusWithBlank())
	if err != nil {
		b.Debug(ctx, "getChatUI: error getting update status: %+v", err)
	}
	for {
		select {
		case res := <-job.uiCh:
			var updateStatus chat1.UIBotCommandsUpdateStatus
			if res.err != nil {
				updateStatus = chat1.NewUIBotCommandsUpdateStatusWithFailed()
			} else {
				updateStatus = chat1.NewUIBotCommandsUpdateStatusWithUptodate(res.settings)
			}
			if err = b.getChatUI(ctx).ChatBotCommandsUpdateStatus(ctx, job.convID, updateStatus); err != nil {
				b.Debug(ctx, "getChatUI: error getting update status: %+v", err)
			}
			return
		case <-time.After(800 * time.Millisecond):
			err := b.getChatUI(ctx).ChatBotCommandsUpdateStatus(ctx, job.convID,
				chat1.NewUIBotCommandsUpdateStatusWithUpdating())
			if err != nil {
				b.Debug(ctx, "getChatUI: error getting update status: %+v", err)
			}
		}
	}
}

func (b *CachingBotCommandManager) queueCommandUpdate(ctx context.Context, job *commandUpdaterJob) error {
	b.queuedUpdatedMu.Lock()
	defer b.queuedUpdatedMu.Unlock()
	if curJob, ok := b.queuedUpdates[job.convID.ConvIDStr()]; ok {
		b.Debug(ctx, "queueCommandUpdate: skipping already queued: %s", job.convID)
		curJob.completeChs = append(curJob.completeChs, job.completeChs...)
		return nil
	}
	select {
	case b.commandUpdateCh <- job:
		go b.runCommandUpdateUI(globals.BackgroundChatCtx(ctx, b.G()), job)
		b.queuedUpdates[job.convID.ConvIDStr()] = job
	default:
		return errors.New("queue full")
	}
	return nil
}

func (b *CachingBotCommandManager) getBotInfo(ctx context.Context, job *commandUpdaterJob) (botInfo chat1.BotInfo, doUpdate bool, err error) {
	defer b.Trace(ctx, &err, fmt.Sprintf("getBotInfo: %v", job.convID))()
	if job.info != nil {
		return *job.info, true, nil
	}
	convID := job.convID
	found, err := b.edb.Get(ctx, b.dbInfoKey(convID), &botInfo)
	if err != nil {
		b.Debug(ctx, "getBotInfo: failed to read cache: %s", err)
		found = false
	}
	var infoHash chat1.BotInfoHash
	if found {
		infoHash = botInfo.Hash()
	}
	res, err := b.ri().GetBotInfo(ctx, chat1.GetBotInfoArg{
		ConvID:   convID,
		InfoHash: infoHash,
		// Send up the latest client version we known about. The server
		// will apply the client version when hashing so we can cache even if
		// new clients are using a different hash function.
		ClientHashVers: chat1.ClientBotInfoHashVers,
	})
	if err != nil {
		return botInfo, false, err
	}
	rtyp, err := res.Response.Typ()
	if err != nil {
		return botInfo, false, err
	}
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
	botUID gregor1.UID, untrustedTeamRole keybase1.TeamRole) (res *storageCommandAdvertisement) {
	b.Debug(ctx, "getConvAdvertisement: reading commands from: %s for uid: %s", convID, botUID)
	tv, err := b.G().ConvSource.Pull(ctx, convID, b.uid, chat1.GetThreadReason_BOTCOMMANDS, nil,
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
	res.UID = botUID
	res.UntrustedTeamRole = untrustedTeamRole

	return res
}

func (b *CachingBotCommandManager) commandUpdate(ctx context.Context, job *commandUpdaterJob) (err error) {
	var botSettings chat1.UIBotCommandsUpdateSettings
	ctx = globals.ChatCtx(ctx, b.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer b.Trace(ctx, &err, "commandUpdate")()
	defer func() {
		b.queuedUpdatedMu.Lock()
		delete(b.queuedUpdates, job.convID.ConvIDStr())
		b.queuedUpdatedMu.Unlock()
		job.uiCh <- uiResult{
			err:      err,
			settings: botSettings,
		}
		for _, completeCh := range job.completeChs {
			completeCh <- err
		}
	}()
	var eg errgroup.Group
	eg.Go(func() error {
		botInfo, doUpdate, err := b.getBotInfo(ctx, job)
		if err != nil {
			return err
		}
		if !doUpdate {
			b.Debug(ctx, "commandUpdate: bot info uptodate, not updating")
			return nil
		}
		s := commandsStorage{
			Version: storageVersion,
		}
		for _, cconv := range botInfo.CommandConvs {
			ad := b.getConvAdvertisement(ctx, cconv.ConvID, cconv.Uid, cconv.UntrustedTeamRole)
			if ad != nil {
				s.Advertisements = append(s.Advertisements, *ad)
			}
		}
		if err := b.edb.Put(ctx, b.dbCommandsKey(job.convID), s); err != nil {
			return err
		}
		// alert that the conv is now updated
		b.G().InboxSource.NotifyUpdate(ctx, b.uid, job.convID)
		return nil
	})
	eg.Go(func() error {
		conv, err := utils.GetVerifiedConv(ctx, b.G(), b.uid, job.convID, types.InboxSourceDataSourceAll)
		if err != nil {
			return err
		}
		ni := b.nameInfoSource(ctx, b.G(), conv.GetMembersType())
		rawSettings, err := ni.TeamBotSettings(ctx, conv.Info.TlfName, conv.Info.Triple.Tlfid,
			conv.GetMembersType(), conv.IsPublic())
		if err != nil {
			return err
		}
		botSettings.Settings = make(map[string]keybase1.TeamBotSettings)
		for uv, settings := range rawSettings {
			username, err := b.G().GetUPAKLoader().LookupUsername(ctx, uv.Uid)
			if err != nil {
				return err
			}
			botSettings.Settings[username.String()] = settings
		}
		return nil
	})
	return eg.Wait()
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
