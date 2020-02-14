package chat

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
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/sync/errgroup"
)

type UIInboxLoader struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid     gregor1.UID
	stopCh  chan struct{}
	started bool
	eg      errgroup.Group

	clock                 clockwork.Clock
	transmitCh            chan interface{}
	layoutCh              chan chat1.InboxLayoutReselectMode
	bigTeamUnboxCh        chan []chat1.ConversationID
	convTransmitBatch     map[chat1.ConvIDStr]chat1.ConversationLocal
	batchDelay            time.Duration
	lastBatchFlush        time.Time
	lastLayoutFlush       time.Time
	smallTeamBound        int
	defaultSmallTeamBound int

	// layout tracking
	lastLayoutMu sync.Mutex
	lastLayout   *chat1.UIInboxLayout

	// testing
	testingLayoutForceMode bool
}

func NewUIInboxLoader(g *globals.Context) *UIInboxLoader {
	defaultSmallTeamBound := 100
	if g.IsMobileAppType() {
		defaultSmallTeamBound = 50
	}
	return &UIInboxLoader{
		Contextified:          globals.NewContextified(g),
		DebugLabeler:          utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "UIInboxLoader", false),
		convTransmitBatch:     make(map[chat1.ConvIDStr]chat1.ConversationLocal),
		clock:                 clockwork.NewRealClock(),
		batchDelay:            200 * time.Millisecond,
		smallTeamBound:        defaultSmallTeamBound,
		defaultSmallTeamBound: defaultSmallTeamBound,
	}
}

func (h *UIInboxLoader) Start(ctx context.Context, uid gregor1.UID) {
	defer h.Trace(ctx, func() error { return nil }, "Start")()
	h.Lock()
	defer h.Unlock()
	if h.started {
		return
	}
	h.transmitCh = make(chan interface{}, 1000)
	h.layoutCh = make(chan chat1.InboxLayoutReselectMode, 1000)
	h.bigTeamUnboxCh = make(chan []chat1.ConversationID, 1000)
	h.stopCh = make(chan struct{})
	h.started = true
	h.uid = uid
	h.eg.Go(func() error { return h.transmitLoop(h.stopCh) })
	h.eg.Go(func() error { return h.layoutLoop(h.stopCh) })
	h.eg.Go(func() error { return h.bigTeamUnboxLoop(h.stopCh) })
}

func (h *UIInboxLoader) Stop(ctx context.Context) chan struct{} {
	defer h.Trace(ctx, func() error { return nil }, "Stop")()
	h.Lock()
	defer h.Unlock()
	ch := make(chan struct{})
	if h.started {
		close(h.stopCh)
		h.started = false
		go func() {
			err := h.eg.Wait()
			if err != nil {
				h.Debug(ctx, "Stop: error waiting: %+v", err)
			}
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (h *UIInboxLoader) getChatUI(ctx context.Context) (libkb.ChatUI, error) {
	if h.G().UIRouter == nil {
		return nil, errors.New("no UI router available")
	}
	ui, err := h.G().UIRouter.GetChatUI()
	if err != nil {
		return nil, err
	}
	if ui == nil {
		h.Debug(ctx, "getChatUI: no chat UI found")
		return nil, errors.New("no chat UI available")
	}
	return ui, nil
}

func (h *UIInboxLoader) presentUnverifiedInbox(ctx context.Context, convs []types.RemoteConversation,
	offline bool) (res chat1.UnverifiedInboxUIItems, err error) {
	for _, rawConv := range convs {
		if len(rawConv.Conv.MaxMsgSummaries) == 0 {
			h.Debug(ctx, "presentUnverifiedInbox: invalid convo, no max msg summaries, skipping: %s",
				rawConv.Conv.GetConvID())
			continue
		}
		res.Items = append(res.Items, utils.PresentRemoteConversation(ctx, h.G(), rawConv))
	}
	res.Offline = offline
	return res, err
}

type unverifiedResponse struct {
	Convs      []types.RemoteConversation
	Query      *chat1.GetInboxLocalQuery
	Pagination *chat1.Pagination
}

type conversationResponse struct {
	Conv chat1.ConversationLocal
}

type failedResponse struct {
	Conv chat1.ConversationLocal
}

func (h *UIInboxLoader) flushConvBatch() (err error) {
	if len(h.convTransmitBatch) == 0 {
		return nil
	}
	ctx := globals.ChatCtx(context.Background(), h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, func() error { return err }, "flushConvBatch")()
	var convs []chat1.ConversationLocal
	for _, conv := range h.convTransmitBatch {
		convs = append(convs, conv)
	}
	h.lastBatchFlush = h.clock.Now()
	h.convTransmitBatch = make(map[chat1.ConvIDStr]chat1.ConversationLocal) // clear batch always
	h.Debug(ctx, "flushConvBatch: transmitting %d convs", len(convs))
	defer func() {
		if err != nil {
			h.Debug(ctx, "flushConvBatch: failed to transmit, retrying convs: num: %d err: %s",
				len(convs), err)
			for _, conv := range convs {
				h.G().FetchRetrier.Failure(ctx, h.uid,
					NewConversationRetry(h.G(), conv.GetConvID(), &conv.Info.Triple.Tlfid, InboxLoad))
			}
		}
		if err = h.G().InboxSource.MergeLocalMetadata(ctx, h.uid, convs); err != nil {
			h.Debug(ctx, "flushConvBatch: unable to write inbox local metadata: %s", err)
		}
	}()
	start := time.Now()
	dat, err := json.Marshal(utils.PresentConversationLocals(ctx, h.G(), h.uid, convs,
		utils.PresentParticipantsModeInclude))
	if err != nil {
		return err
	}
	h.Debug(ctx, "flushConvBatch: present time: %v", time.Since(start))
	ui, err := h.getChatUI(ctx)
	if err != nil {
		return err
	}
	start = time.Now()
	err = ui.ChatInboxConversation(ctx, chat1.ChatInboxConversationArg{
		Convs: string(dat),
	})
	h.Debug(ctx, "flushConvBatch: transmit time: %v", time.Since(start))
	return err
}

func (h *UIInboxLoader) flushUnverified(r unverifiedResponse) (err error) {
	ctx := context.Background()
	defer func() {
		if err != nil {
			h.Debug(ctx, "flushUnverified: failed to transmit, retrying: %s", err)
			h.G().FetchRetrier.Failure(ctx, h.uid, NewFullInboxRetry(h.G(), r.Query))
		}
	}()
	start := time.Now()
	uires, err := h.presentUnverifiedInbox(ctx, r.Convs, h.G().InboxSource.IsOffline(ctx))
	if err != nil {
		h.Debug(ctx, "flushUnverified: failed to present untrusted inbox, failing: %s", err.Error())
		return err
	}
	jbody, err := json.Marshal(uires)
	if err != nil {
		h.Debug(ctx, "flushUnverified: failed to JSON up unverified inbox: %s", err.Error())
		return err
	}
	h.Debug(ctx, "flushUnverified: present time: %v", time.Since(start))
	ui, err := h.getChatUI(ctx)
	if err != nil {
		return err
	}
	start = time.Now()
	h.Debug(ctx, "flushUnverified: sending unverified inbox: num convs: %d bytes: %d", len(r.Convs),
		len(jbody))
	if err := ui.ChatInboxUnverified(ctx, chat1.ChatInboxUnverifiedArg{
		Inbox: string(jbody),
	}); err != nil {
		h.Debug(ctx, "flushUnverified: failed to send unverfified inbox: %s", err)
		return err
	}
	h.Debug(ctx, "flushUnverified: sent unverified inbox successfully: %v", time.Since(start))
	return nil
}

func (h *UIInboxLoader) flushFailed(r failedResponse) {
	ctx := context.Background()
	ui, err := h.getChatUI(ctx)
	h.Debug(ctx, "flushFailed: transmitting: %s", r.Conv.GetConvID())
	if err == nil {
		if err := ui.ChatInboxFailed(ctx, chat1.ChatInboxFailedArg{
			ConvID: r.Conv.GetConvID(),
			Error:  utils.PresentConversationErrorLocal(ctx, h.G(), *r.Conv.Error),
		}); err != nil {
			h.Debug(ctx, "flushFailed: failed to send failed conv: %s", err)
		}
	}
	// If we get a transient failure, add this to the retrier queue
	if r.Conv.Error.Typ == chat1.ConversationErrorType_TRANSIENT {
		h.G().FetchRetrier.Failure(ctx, h.uid,
			NewConversationRetry(h.G(), r.Conv.GetConvID(), &r.Conv.Info.Triple.Tlfid, InboxLoad))
	}
}

func (h *UIInboxLoader) transmitOnce(imsg interface{}) {
	switch msg := imsg.(type) {
	case unverifiedResponse:
		_ = h.flushConvBatch()
		_ = h.flushUnverified(msg)
	case failedResponse:
		_ = h.flushConvBatch()
		h.flushFailed(msg)
	case conversationResponse:
		h.convTransmitBatch[msg.Conv.GetConvID().ConvIDStr()] = msg.Conv
		if h.clock.Since(h.lastBatchFlush) > h.batchDelay {
			_ = h.flushConvBatch()
		}
	}
}

func (h *UIInboxLoader) transmitLoop(shutdownCh chan struct{}) error {
	for {
		select {
		case msg := <-h.transmitCh:
			h.transmitOnce(msg)
		case <-h.clock.After(h.batchDelay):
			_ = h.flushConvBatch()
		case <-shutdownCh:
			h.Debug(context.Background(), "transmitLoop: shutting down")
			return nil
		}
	}
}

func (h *UIInboxLoader) LoadNonblock(ctx context.Context, query *chat1.GetInboxLocalQuery,
	maxUnbox *int, skipUnverified bool) (err error) {
	defer h.Trace(ctx, func() error { return err }, "LoadNonblock")()
	uid := h.uid
	// Retry helpers
	retryInboxLoad := func() {
		h.G().FetchRetrier.Failure(ctx, uid, NewFullInboxRetry(h.G(), query))
	}
	retryConvLoad := func(convID chat1.ConversationID, tlfID *chat1.TLFID) {
		h.G().FetchRetrier.Failure(ctx, uid, NewConversationRetry(h.G(), convID, tlfID, InboxLoad))
	}
	defer func() {
		// handle errors on the main processing thread, any errors during localizaton are handled
		// in the goroutine for localization callbacks
		if err != nil {
			if query != nil && len(query.ConvIDs) > 0 {
				h.Debug(ctx, "LoadNonblock: failed to load convID query, retrying all convs")
				for _, convID := range query.ConvIDs {
					retryConvLoad(convID, nil)
				}
			} else {
				h.Debug(ctx, "LoadNonblock: failed to load general query, retrying")
				retryInboxLoad()
			}
		}
	}()

	// Invoke nonblocking inbox read and get remote inbox version to send back
	// as our result
	_, localizeCb, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerNonblocking,
		types.InboxSourceDataSourceAll, maxUnbox, query)
	if err != nil {
		return err
	}

	// Wait for inbox to get sent to us
	var lres types.AsyncInboxResult
	if skipUnverified {
		select {
		case lres = <-localizeCb:
			h.Debug(ctx, "LoadNonblock: received unverified inbox, skipping send")
		case <-time.After(time.Minute):
			return fmt.Errorf("timeout waiting for inbox result")
		case <-ctx.Done():
			h.Debug(ctx, "LoadNonblock: context canceled waiting for unverified (skip): %s")
			return ctx.Err()
		}
	} else {
		select {
		case lres = <-localizeCb:
			if lres.InboxRes == nil {
				return fmt.Errorf("invalid conversation localize callback received")
			}
			h.transmitCh <- unverifiedResponse{
				Convs: lres.InboxRes.ConvsUnverified,
				Query: query,
			}
		case <-time.After(time.Minute):
			return fmt.Errorf("timeout waiting for inbox result")
		case <-ctx.Done():
			h.Debug(ctx, "LoadNonblock: context canceled waiting for unverified")
			return ctx.Err()
		}
	}

	// Consume localize callbacks and send out to UI.
	for convRes := range localizeCb {
		go func(convRes types.AsyncInboxResult) {
			if convRes.ConvLocal.Error != nil {
				h.Debug(ctx, "LoadNonblock: *** error conv: id: %s err: %s",
					convRes.Conv.ConvIDStr, convRes.ConvLocal.Error.Message)
				h.transmitCh <- failedResponse{
					Conv: convRes.ConvLocal,
				}
			} else {
				h.Debug(ctx, "LoadNonblock: success: conv: %s", convRes.Conv.ConvIDStr)
				h.transmitCh <- conversationResponse{
					Conv: convRes.ConvLocal,
				}
			}
		}(convRes)
	}
	return nil
}

func (h *UIInboxLoader) Query() chat1.GetInboxLocalQuery {
	topicType := chat1.TopicType_CHAT
	vis := keybase1.TLFVisibility_PRIVATE
	return chat1.GetInboxLocalQuery{
		ComputeActiveList: true,
		TopicType:         &topicType,
		TlfVisibility:     &vis,
		Status: []chat1.ConversationStatus{
			chat1.ConversationStatus_UNFILED,
			chat1.ConversationStatus_FAVORITE,
			chat1.ConversationStatus_MUTED,
		},
		MemberStatus: []chat1.ConversationMemberStatus{
			chat1.ConversationMemberStatus_ACTIVE,
			chat1.ConversationMemberStatus_PREVIEW,
			chat1.ConversationMemberStatus_RESET,
		},
	}
}

type bigTeam struct {
	name  string
	id    chat1.TLFIDStr
	convs []types.RemoteConversation
}

func newBigTeam(name string, id chat1.TLFIDStr) *bigTeam {
	return &bigTeam{name: name, id: id}
}

func (b *bigTeam) sort() {
	sort.Slice(b.convs, func(i, j int) bool {
		return strings.Compare(strings.ToLower(b.convs[i].GetTopicName()),
			strings.ToLower(b.convs[j].GetTopicName())) < 0
	})
}

type bigTeamCollector struct {
	teams map[string]*bigTeam
}

func newBigTeamCollector() *bigTeamCollector {
	return &bigTeamCollector{
		teams: make(map[string]*bigTeam),
	}
}

func (c *bigTeamCollector) appendConv(conv types.RemoteConversation) {
	name := utils.GetRemoteConvTLFName(conv)
	bt, ok := c.teams[name]
	if !ok {
		bt = newBigTeam(name, conv.Conv.Metadata.IdTriple.Tlfid.TLFIDStr())
		c.teams[name] = bt
	}
	bt.convs = append(bt.convs, conv)
}

func (c *bigTeamCollector) finalize(ctx context.Context) (res []chat1.UIInboxBigTeamRow) {
	var bts []*bigTeam
	for _, bt := range c.teams {
		bt.sort()
		bts = append(bts, bt)
	}
	sort.Slice(bts, func(i, j int) bool {
		return strings.Compare(bts[i].name, bts[j].name) < 0
	})
	for _, bt := range bts {
		res = append(res, chat1.NewUIInboxBigTeamRowWithLabel(chat1.UIInboxBigTeamLabelRow{Name: bt.name, Id: bt.id}))
		for _, conv := range bt.convs {
			row := utils.PresentRemoteConversationAsBigTeamChannelRow(ctx, conv)
			res = append(res, chat1.NewUIInboxBigTeamRowWithChannel(row))
		}
	}
	return res
}

func (h *UIInboxLoader) buildLayout(ctx context.Context, inbox types.Inbox,
	reselectMode chat1.InboxLayoutReselectMode) (res chat1.UIInboxLayout) {
	var widgetList []chat1.UIInboxSmallTeamRow
	var btunboxes []chat1.ConversationID
	btcollector := newBigTeamCollector()
	selectedInLayout := false
	selectedConv := h.G().Syncer.GetSelectedConversation()
	username := h.G().Env.GetUsername().String()
	for _, conv := range inbox.ConvsUnverified {
		if conv.Conv.IsSelfFinalized(username) {
			h.Debug(ctx, "buildLayout: skipping self finalized conv: %s", conv.ConvIDStr)
			continue
		}
		if conv.GetConvID().Eq(selectedConv) {
			selectedInLayout = true
		}
		switch conv.GetTeamType() {
		case chat1.TeamType_COMPLEX:
			if conv.LocalMetadata == nil {
				btunboxes = append(btunboxes, conv.GetConvID())
			}
			btcollector.appendConv(conv)
		default:
			// filter empty convs we didn't create
			if utils.IsConvEmpty(conv.Conv) && conv.Conv.CreatorInfo != nil &&
				!conv.Conv.CreatorInfo.Uid.Eq(h.uid) {
				continue
			}
			res.SmallTeams = append(res.SmallTeams,
				utils.PresentRemoteConversationAsSmallTeamRow(ctx, conv,
					h.G().GetEnv().GetUsername().String(), len(res.SmallTeams) < 50))
		}
		widgetList = append(widgetList, utils.PresentRemoteConversationAsSmallTeamRow(ctx, conv,
			h.G().GetEnv().GetUsername().String(), true))
	}
	sort.Slice(res.SmallTeams, func(i, j int) bool {
		return res.SmallTeams[i].Time.After(res.SmallTeams[j].Time)
	})
	res.BigTeams = btcollector.finalize(ctx)
	res.TotalSmallTeams = len(res.SmallTeams)
	if res.TotalSmallTeams > h.smallTeamBound {
		res.SmallTeams = res.SmallTeams[:h.smallTeamBound]
	}
	if !selectedInLayout || reselectMode == chat1.InboxLayoutReselectMode_FORCE {
		// select a new conv for the UI
		var reselect chat1.UIInboxReselectInfo
		reselect.OldConvID = selectedConv.ConvIDStr()
		if len(res.SmallTeams) > 0 {
			reselect.NewConvID = &res.SmallTeams[0].ConvID
		}
		h.Debug(ctx, "buildLayout: adding reselect info: %s", reselect)
		res.ReselectInfo = &reselect
	}
	if !h.G().IsMobileAppType() {
		badgeState := h.G().Badger.State()
		sort.Slice(widgetList, func(i, j int) bool {
			ibadged := badgeState.ConversationBadgeStr(ctx, widgetList[i].ConvID) > 0
			jbadged := badgeState.ConversationBadgeStr(ctx, widgetList[j].ConvID) > 0
			if ibadged && !jbadged {
				return true
			} else if !ibadged && jbadged {
				return false
			} else {
				return widgetList[i].Time.After(widgetList[j].Time)
			}
		})
		// only set widget entries on desktop to the top 3 overall convs
		if len(widgetList) > 5 {
			res.WidgetList = widgetList[:5]
		} else {
			res.WidgetList = widgetList
		}
	}
	if len(btunboxes) > 0 {
		h.Debug(ctx, "buildLayout: big teams missing names, unboxing: %v", len(btunboxes))
		h.queueBigTeamUnbox(btunboxes)
	}
	return res
}

func (h *UIInboxLoader) getInboxFromQuery(ctx context.Context) (inbox types.Inbox, err error) {
	defer h.Trace(ctx, func() error { return err }, "getInboxFromQuery")()
	query := h.Query()
	rquery, _, err := h.G().InboxSource.GetInboxQueryLocalToRemote(ctx, &query)
	if err != nil {
		return inbox, err
	}
	return h.G().InboxSource.ReadUnverified(ctx, h.uid, types.InboxSourceDataSourceAll, rquery)
}

func (h *UIInboxLoader) flushLayout(reselectMode chat1.InboxLayoutReselectMode) (err error) {
	ctx := globals.ChatCtx(context.Background(), h.G(), keybase1.TLFIdentifyBehavior_GUI, nil, nil)
	defer h.Trace(ctx, func() error { return err }, "flushLayout")()
	defer func() {
		if err != nil {
			h.Debug(ctx, "flushLayout: failed to transmit, retrying: %s", err)
			q := h.Query()
			h.G().FetchRetrier.Failure(ctx, h.uid, NewFullInboxRetry(h.G(), &q))
		}
	}()
	ui, err := h.getChatUI(ctx)
	if err != nil {
		h.Debug(ctx, "flushLayout: no chat UI available, skipping send")
		return nil
	}
	inbox, err := h.getInboxFromQuery(ctx)
	if err != nil {
		return err
	}
	layout := h.buildLayout(ctx, inbox, reselectMode)
	dat, err := json.Marshal(layout)
	if err != nil {
		return err
	}
	if err := ui.ChatInboxLayout(ctx, string(dat)); err != nil {
		return err
	}
	h.setLastLayout(&layout)
	return nil
}

func (h *UIInboxLoader) queueBigTeamUnbox(convIDs []chat1.ConversationID) {
	select {
	case h.bigTeamUnboxCh <- convIDs:
	default:
		h.Debug(context.Background(), "queueBigTeamUnbox: failed to queue big team unbox, queue full")
	}
}

func (h *UIInboxLoader) bigTeamUnboxLoop(shutdownCh chan struct{}) error {
	ctx := globals.ChatCtx(context.Background(), h.G(), keybase1.TLFIdentifyBehavior_GUI, nil, nil)
	for {
		select {
		case convIDs := <-h.bigTeamUnboxCh:
			doneCh := make(chan struct{})
			ctx, cancel := context.WithCancel(ctx)
			go func(ctx context.Context) {
				defer close(doneCh)
				h.Debug(ctx, "bigTeamUnboxLoop: pulled %d convs to unbox", len(convIDs))
				if err := h.UpdateConvs(ctx, convIDs); err != nil {
					h.Debug(ctx, "bigTeamUnboxLoop: unbox convs error: %s", err)
				}
				// update layout again after we have done all this work to get everything in the right order
				h.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "big team unbox")
			}(ctx)
			select {
			case <-doneCh:
			case <-shutdownCh:
				h.Debug(ctx, "bigTeamUnboxLoop: shutdown during unboxing, going down")
			}
			cancel()
		case <-shutdownCh:
			h.Debug(ctx, "bigTeamUnboxLoop: shutting down")
			return nil
		}
	}
}

func (h *UIInboxLoader) layoutLoop(shutdownCh chan struct{}) error {
	var shouldFlush bool
	var lastReselectMode chat1.InboxLayoutReselectMode
	reset := func() {
		shouldFlush = false
		lastReselectMode = chat1.InboxLayoutReselectMode_DEFAULT
	}
	reset()
	for {
		select {
		case reselectMode := <-h.layoutCh:
			if reselectMode == chat1.InboxLayoutReselectMode_FORCE {
				lastReselectMode = reselectMode
			}
			if h.clock.Since(h.lastLayoutFlush) > h.batchDelay || h.testingLayoutForceMode {
				_ = h.flushLayout(lastReselectMode)
				reset()
			} else {
				shouldFlush = true
			}
		case <-h.clock.After(h.batchDelay):
			if shouldFlush {
				_ = h.flushLayout(lastReselectMode)
				reset()
			}
		case <-shutdownCh:
			h.Debug(context.Background(), "layoutLoop: shutting down")
			return nil
		}
	}
}

func (h *UIInboxLoader) isTopSmallTeamInLastLayout(convID chat1.ConversationID) bool {
	h.lastLayoutMu.Lock()
	defer h.lastLayoutMu.Unlock()
	if h.lastLayout == nil {
		return false
	}
	if len(h.lastLayout.SmallTeams) == 0 {
		return false
	}
	return h.lastLayout.SmallTeams[0].ConvID == convID.ConvIDStr()
}

func (h *UIInboxLoader) setLastLayout(l *chat1.UIInboxLayout) {
	h.lastLayoutMu.Lock()
	defer h.lastLayoutMu.Unlock()
	h.lastLayout = l
}

func (h *UIInboxLoader) UpdateLayout(ctx context.Context, reselectMode chat1.InboxLayoutReselectMode,
	reason string) {
	defer h.Trace(ctx, func() error { return nil }, "UpdateLayout: %s", reason)()
	select {
	case h.layoutCh <- reselectMode:
	default:
		h.Debug(ctx, "failed to queue layout update, queue full")
	}
}

func (h *UIInboxLoader) UpdateLayoutFromNewMessage(ctx context.Context, conv types.RemoteConversation) {
	defer h.Trace(ctx, func() error { return nil }, "UpdateLayoutFromNewMessage: %s", conv.ConvIDStr)()
	if h.isTopSmallTeamInLastLayout(conv.GetConvID()) {
		h.Debug(ctx, "UpdateLayoutFromNewMessage: skipping layout, conv top small team in last layout")
	} else if conv.GetTeamType() == chat1.TeamType_COMPLEX {
		h.Debug(ctx, "UpdateLayoutFromNewMessage: skipping layout, complex team conv")
	} else {
		h.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "new message")
	}
}

func (h *UIInboxLoader) UpdateLayoutFromSubteamRename(ctx context.Context, convs []types.RemoteConversation) {
	defer h.Trace(ctx, func() error { return nil }, "UpdateLayoutFromSubteamRename")()
	var bigTeamConvs []chat1.ConversationID
	for _, conv := range convs {
		if conv.GetTeamType() == chat1.TeamType_COMPLEX {
			bigTeamConvs = append(bigTeamConvs, conv.GetConvID())
		}
	}
	if len(bigTeamConvs) > 0 {
		h.queueBigTeamUnbox(bigTeamConvs)
	}
}

func (h *UIInboxLoader) UpdateConvs(ctx context.Context, convIDs []chat1.ConversationID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "UpdateConvs")()
	query := chat1.GetInboxLocalQuery{
		ComputeActiveList: true,
		ConvIDs:           convIDs,
	}
	return h.LoadNonblock(ctx, &query, nil, true)
}

func (h *UIInboxLoader) UpdateLayoutFromSmallIncrease(ctx context.Context) {
	defer h.Trace(ctx, func() error { return nil }, "UpdateLayoutFromSmallIncrease")()
	h.smallTeamBound += h.defaultSmallTeamBound
	h.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "small increase")
}

func (h *UIInboxLoader) UpdateLayoutFromSmallReset(ctx context.Context) {
	defer h.Trace(ctx, func() error { return nil }, "UpdateLayoutFromSmallReset")()
	h.smallTeamBound = h.defaultSmallTeamBound
	h.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "small reset")
}
