package chat

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
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
)

type UIThreadLoader struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	clock          clockwork.Clock
	convPageStatus map[string]chat1.Pagination
	validatedDelay time.Duration

	// testing
	cachedThreadDelay  *time.Duration
	remoteThreadDelay  *time.Duration
	resolveThreadDelay *time.Duration
}

func NewUIThreadLoader(g *globals.Context) *UIThreadLoader {
	cacheDelay := 30 * time.Millisecond
	return &UIThreadLoader{
		Contextified:      globals.NewContextified(g),
		DebugLabeler:      utils.NewDebugLabeler(g.GetLog(), "UIThreadLoader", false),
		convPageStatus:    make(map[string]chat1.Pagination),
		clock:             clockwork.NewRealClock(),
		validatedDelay:    100 * time.Millisecond,
		cachedThreadDelay: &cacheDelay,
	}
}

func (t *UIThreadLoader) groupGeneric(ctx context.Context, uid gregor1.UID, msgs []chat1.MessageUnboxed,
	typs []chat1.MessageType, makeCombined func([]chat1.MessageUnboxed) chat1.MessageUnboxed) (res []chat1.MessageUnboxed) {
	var grouped []chat1.MessageUnboxed
	typMap := make(map[chat1.MessageType]bool)
	for _, t := range typs {
		typMap[t] = true
	}
	addGrouped := func() {
		if len(grouped) == 0 {
			return
		}
		res = append(res, makeCombined(grouped))
		grouped = nil
	}
	for _, msg := range msgs {
		if msg.IsValid() {
			body := msg.Valid().MessageBody
			mtyp, err := body.MessageType()
			if err == nil && typMap[mtyp] && !msg.Valid().ClientHeader.Sender.Eq(uid) {
				grouped = append(grouped, msg)
			} else {
				addGrouped()
				res = append(res, msg)
			}
		} else {
			addGrouped()
			res = append(res, msg)
		}
	}
	addGrouped()
	return res
}

func (t *UIThreadLoader) groupThreadView(ctx context.Context, uid gregor1.UID, tv chat1.ThreadView) chat1.ThreadView {
	newMsgs := t.groupGeneric(ctx, uid, tv.Messages,
		[]chat1.MessageType{chat1.MessageType_JOIN, chat1.MessageType_LEAVE},
		func(grouped []chat1.MessageUnboxed) chat1.MessageUnboxed {
			mvalid := grouped[0].Valid()
			var joiners, leavers []string
			for _, j := range grouped {
				if j.Valid().MessageBody.IsType(chat1.MessageType_JOIN) {
					joiners = append(joiners, j.Valid().SenderUsername)
				} else {
					leavers = append(leavers, j.Valid().SenderUsername)
				}
			}
			mvalid.ClientHeader.MessageType = chat1.MessageType_JOIN
			mvalid.MessageBody = chat1.NewMessageBodyWithJoin(chat1.MessageJoin{
				Joiners: joiners,
				Leavers: leavers,
			})
			return chat1.NewMessageUnboxedWithValid(mvalid)
		})
	tv.Messages = newMsgs
	return tv
}

func (t *UIThreadLoader) applyPagerModeIncoming(ctx context.Context, convID chat1.ConversationID,
	pagination *chat1.Pagination, pgmode chat1.GetThreadNonblockPgMode) (res *chat1.Pagination) {
	defer func() {
		t.Debug(ctx, "applyPagerModeIncoming: mode: %v convID: %s xform: %s -> %s", pgmode, convID,
			pagination, res)
	}()
	switch pgmode {
	case chat1.GetThreadNonblockPgMode_SERVER:
		if pagination == nil {
			return nil
		}
		oldStored := t.convPageStatus[convID.String()]
		if len(pagination.Next) > 0 {
			return &chat1.Pagination{
				Num:  pagination.Num,
				Next: oldStored.Next,
				Last: oldStored.Last,
			}
		} else if len(pagination.Previous) > 0 {
			return &chat1.Pagination{
				Num:      pagination.Num,
				Previous: oldStored.Previous,
			}
		}
	}
	return pagination
}

func (t *UIThreadLoader) applyPagerModeOutgoing(ctx context.Context, convID chat1.ConversationID,
	pagination *chat1.Pagination, incoming *chat1.Pagination, pgmode chat1.GetThreadNonblockPgMode) {
	switch pgmode {
	case chat1.GetThreadNonblockPgMode_SERVER:
		if pagination == nil {
			return
		}
		if incoming.FirstPage() {
			t.Debug(ctx, "applyPagerModeOutgoing: resetting pagination: convID: %s p: %s", convID, pagination)
			t.convPageStatus[convID.String()] = *pagination
		} else {
			oldStored := t.convPageStatus[convID.String()]
			if len(incoming.Next) > 0 {
				oldStored.Next = pagination.Next
				t.Debug(ctx, "applyPagerModeOutgoing: setting next pagination: convID: %s p: %s", convID,
					pagination)
			} else if len(incoming.Previous) > 0 {
				t.Debug(ctx, "applyPagerModeOutgoing: setting prev pagination: convID: %s p: %s", convID,
					pagination)
				oldStored.Previous = pagination.Previous
			}
			oldStored.Last = pagination.Last
			t.convPageStatus[convID.String()] = oldStored
		}
	}
}

func (t *UIThreadLoader) messageIDControlToPagination(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgIDControl chat1.MessageIDControl) *chat1.Pagination {
	var mcconv *types.RemoteConversation
	conv, err := utils.GetUnverifiedConv(ctx, t.G(), uid, convID, types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		t.Debug(ctx, "messageIDControlToPagination: failed to get conversation: %s", err)
	} else {
		mcconv = &conv
	}
	return utils.MessageIDControlToPagination(ctx, t.DebugLabeler, &msgIDControl, mcconv)
}

func (t *UIThreadLoader) isConsolidateMsg(msg chat1.MessageUnboxed) bool {
	if !msg.IsValid() {
		return false
	}
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return false
	}
	switch typ {
	case chat1.MessageType_JOIN, chat1.MessageType_LEAVE:
		return true
	default:
		return false
	}
}

func (t *UIThreadLoader) mergeLocalRemoteThread(ctx context.Context, remoteThread,
	localThread *chat1.ThreadView, mode chat1.GetThreadNonblockCbMode) (res chat1.ThreadView, err error) {
	defer func() {
		if err != nil || localThread == nil {
			return
		}
		rm := make(map[chat1.MessageID]bool)
		for _, m := range res.Messages {
			rm[m.GetMessageID()] = true
		}
		// Check for any stray placeholders in the local thread we sent, and set them to some
		// undisplayable type
		for _, m := range localThread.Messages {
			state, err := m.State()
			if err != nil {
				continue
			}
			if (state == chat1.MessageUnboxedState_PLACEHOLDER || t.isConsolidateMsg(m)) &&
				!rm[m.GetMessageID()] {
				t.Debug(ctx, "mergeLocalRemoteThread: subbing in dead placeholder: msgID: %d",
					m.GetMessageID())
				res.Messages = append(res.Messages, utils.CreateHiddenPlaceholder(m.GetMessageID()))
			}
		}
		sort.Sort(utils.ByMsgUnboxedMsgID(res.Messages))
	}()

	shouldAppend := func(newMsg chat1.MessageUnboxed, oldMsgs map[chat1.MessageID]chat1.MessageUnboxed) bool {
		oldMsg, ok := oldMsgs[newMsg.GetMessageID()]
		if !ok {
			return true
		}
		// If either message is not valid, return the new one, something weird might be going on
		if !oldMsg.IsValid() || !newMsg.IsValid() {
			return true
		}
		// If this is a join message (or any other message that can get consolidated, then always
		// transmit
		if t.isConsolidateMsg(newMsg) {
			return true
		}
		// If newMsg is now superseded by something different than what we sent, then let's include it
		if newMsg.Valid().ServerHeader.SupersededBy != oldMsg.Valid().ServerHeader.SupersededBy {
			t.Debug(ctx, "mergeLocalRemoteThread: including supersededBy change: msgID: %d",
				newMsg.GetMessageID())
			return true
		}
		// If replyTo is different, then let's also transmit this up
		if newMsg.Valid().ReplyTo != oldMsg.Valid().ReplyTo {
			return true
		}
		return false
	}
	switch mode {
	case chat1.GetThreadNonblockCbMode_FULL:
		return *remoteThread, nil
	case chat1.GetThreadNonblockCbMode_INCREMENTAL:
		if localThread != nil {
			lm := make(map[chat1.MessageID]chat1.MessageUnboxed)
			for _, m := range localThread.Messages {
				lm[m.GetMessageID()] = m
			}
			res.Pagination = remoteThread.Pagination
			for _, m := range remoteThread.Messages {
				if shouldAppend(m, lm) {
					res.Messages = append(res.Messages, m)
				}
			}
			t.Debug(ctx, "mergeLocalRemoteThread: incremental cb mode: orig: %d post: %d",
				len(remoteThread.Messages), len(res.Messages))
			return res, nil
		}
		return *remoteThread, nil
	}
	return res, errors.New("unknown get thread cb mode")
}

func (t *UIThreadLoader) dispatchOldPagesJob(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, pagination *chat1.Pagination, resultPagination *chat1.Pagination) {
	// Fire off pageback background jobs if we fetched the first page
	if pagination.FirstPage() && resultPagination != nil && !resultPagination.Last {
		p := &chat1.Pagination{
			Num:  50,
			Next: resultPagination.Next,
		}
		t.Debug(ctx, "dispatchOldPagesJob: queuing %s because of first page fetch: p: %s", convID, p)
		if err := t.G().ConvLoader.Queue(ctx, types.NewConvLoaderJob(convID, nil /* query */, p,
			types.ConvLoaderPriorityLow, newConvLoaderPagebackHook(t.G(), 0, 3))); err != nil {
			t.Debug(ctx, "dispatchOldPagesJob: failed to queue conversation load: %s", err)
		}
	}
}

func (t *UIThreadLoader) setUIStatus(ctx context.Context, chatUI libkb.ChatUI,
	status chat1.UIChatThreadStatus, delay time.Duration) (cancelStatusFn func() bool) {
	resCh := make(chan bool, 1)
	ctx, cancelFn := context.WithCancel(ctx)
	t.Debug(ctx, "setUIStatus: delaying: %v", delay)
	go func(ctx context.Context) {
		displayed := false
		select {
		case <-t.clock.After(delay):
			select {
			case <-ctx.Done():
				t.Debug(ctx, "setUIStatus: context canceled")
			default:
				if err := chatUI.ChatThreadStatus(ctx, status); err != nil {
					t.Debug(ctx, "setUIStatus: failed to send: %s", err)
				}
				displayed = true
			}
		case <-ctx.Done():
			t.Debug(ctx, "setUIStatus: context canceled")
		}
		if displayed {
			typ, _ := status.Typ()
			t.Debug(ctx, "setUIStatus: displaying: %v", typ)
		}
		resCh <- displayed
	}(ctx)
	cancelStatusFn = func() bool {
		cancelFn()
		return <-resCh
	}
	return cancelStatusFn
}

func (t *UIThreadLoader) LoadNonblock(ctx context.Context, chatUI libkb.ChatUI, uid gregor1.UID,
	convID chat1.ConversationID, reason chat1.GetThreadReason, pgmode chat1.GetThreadNonblockPgMode,
	cbmode chat1.GetThreadNonblockCbMode, query *chat1.GetThreadQuery, uipagination *chat1.UIPagination) (err error) {
	var pagination, resultPagination *chat1.Pagination
	var fullErr error
	defer t.Trace(ctx, func() error { return err }, "LoadNonblock")()
	defer func() {
		// Detect any problem loading the thread, and queue it up in the retrier if there is a problem.
		// Otherwise, send notice that we successfully loaded the conversation.
		if fullErr != nil {
			t.Debug(ctx, "LoadNonblock: queueing retry because of: %s", fullErr)
			t.G().FetchRetrier.Failure(ctx, uid,
				NewConversationRetry(t.G(), convID, nil, ThreadLoad))
		} else {
			t.G().FetchRetrier.Success(ctx, uid,
				NewConversationRetry(t.G(), convID, nil, ThreadLoad))
			// Load old pages of this conversation on success
			t.dispatchOldPagesJob(ctx, uid, convID, pagination, resultPagination)
		}
	}()
	// Lock conversation while this is running
	if err := t.G().ConvSource.AcquireConversationLock(ctx, uid, convID); err != nil {
		return err
	}
	defer t.G().ConvSource.ReleaseConversationLock(ctx, uid, convID)
	t.Debug(ctx, "LoadNonblock: conversation lock obtained")

	// If this is from a push or foreground, set us into the foreground
	switch reason {
	case chat1.GetThreadReason_PUSH, chat1.GetThreadReason_FOREGROUND:
		// Also if we get here and we claim to not be in the foreground yet, then hit disconnect
		// to reset any delay checks or timers
		switch t.G().MobileAppState.State() {
		case keybase1.MobileAppState_FOREGROUND, keybase1.MobileAppState_BACKGROUNDACTIVE:
		default:
			t.G().Syncer.Disconnected(ctx)
		}
		t.G().MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	}

	// Set last select conversation on syncer
	t.G().Syncer.SelectConversation(ctx, convID)

	// Decode presentation form pagination
	if pagination, err = utils.DecodePagination(uipagination); err != nil {
		return err
	}

	// Enable delete placeholders for supersede transform
	if query == nil {
		query = new(chat1.GetThreadQuery)
	}
	query.EnableDeletePlaceholders = true

	// Parse out options
	if query.MessageIDControl != nil {
		// Pager control into pagination if given
		t.Debug(ctx, "LoadNonblock: using message ID control for pagination: %v", *query.MessageIDControl)
		pagination = t.messageIDControlToPagination(ctx, uid, convID, *query.MessageIDControl)
	} else {
		// Apply any pager mode transformations
		pagination = t.applyPagerModeIncoming(ctx, convID, pagination, pgmode)
	}
	if pagination != nil && pagination.Last {
		return nil
	}

	// Race the full operation versus the local one, so we don't lose anytime grabbing the local
	// version if they are roughly as fast. However, the full operation has preference, so if it does
	// win the race we don't send anything up from the local operation.
	var localSentThread *chat1.ThreadView
	var uilock sync.Mutex
	var wg sync.WaitGroup

	// Handle tracking status bar
	displayedStatus := false
	var uiStatusLock sync.Mutex
	setDisplayedStatus := func(cancelUIStatus func() bool) {
		status := cancelUIStatus()
		uiStatusLock.Lock()
		displayedStatus = displayedStatus || status
		uiStatusLock.Unlock()
	}
	getDisplayedStatus := func() bool {
		uiStatusLock.Lock()
		defer uiStatusLock.Unlock()
		return displayedStatus
	}

	localCtx, cancel := context.WithCancel(ctx)
	wg.Add(1)
	go func(ctx context.Context) {
		defer wg.Done()
		// Get local copy of the thread, abort the call if we have sent the full copy
		var resThread *chat1.ThreadView
		var localThread chat1.ThreadView
		ch := make(chan error, 1)
		go func() {
			var err error
			if t.cachedThreadDelay != nil {
				select {
				case <-t.clock.After(*t.cachedThreadDelay):
				case <-ctx.Done():
					ch <- ctx.Err()
					return
				}
			}
			localThread, err = t.G().ConvSource.PullLocalOnly(ctx, convID,
				uid, query, pagination, 10)
			ch <- err
		}()
		select {
		case err := <-ch:
			if err != nil {
				t.Debug(ctx, "LoadNonblock: error running PullLocalOnly (sending miss): %s", err)
			} else {
				resThread = &localThread
			}
		case <-ctx.Done():
			t.Debug(ctx, "LoadNonblock: context canceled before PullLocalOnly returned")
			return
		}
		uilock.Lock()
		defer uilock.Unlock()
		// Check this again, since we might have waited on the lock while full sent
		select {
		case <-ctx.Done():
			resThread = nil
			t.Debug(ctx, "LoadNonblock: context canceled before local copy sent")
			return
		default:
		}
		var pthread *string
		if resThread != nil {
			*resThread = t.groupThreadView(ctx, uid, *resThread)
			t.Debug(ctx, "LoadNonblock: sending cached response: messages: %d pager: %s",
				len(resThread.Messages), resThread.Pagination)
			localSentThread = resThread
			pt := utils.PresentThreadView(ctx, t.G(), uid, *resThread, convID)
			jsonPt, err := json.Marshal(pt)
			if err != nil {
				t.Debug(ctx, "LoadNonblock: failed to JSON cached response: %v", err)
				return
			}
			sJSONPt := string(jsonPt)
			pthread = &sJSONPt
			t.applyPagerModeOutgoing(ctx, convID, resThread.Pagination, pagination, pgmode)
		} else {
			t.Debug(ctx, "LoadNonblock: sending nil cached response")
		}
		start := time.Now()
		if err := chatUI.ChatThreadCached(ctx, pthread); err != nil {
			t.Debug(ctx, "LoadNonblock: failed to send cached thread: %s", err)
		}
		t.Debug(ctx, "LoadNonblock: cached response send time: %v", time.Since(start))
	}(localCtx)

	startTime := t.clock.Now()
	baseDelay := 3 * time.Second
	getDelay := func() time.Duration {
		return baseDelay - (t.clock.Now().Sub(startTime))
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		// Run the full Pull operation, and redo pagination
		ctx = globals.CtxModifyUnboxMode(ctx, types.UnboxModeQuick)
		cancelUIStatus := t.setUIStatus(ctx, chatUI, chat1.NewUIChatThreadStatusWithServer(), getDelay())
		var remoteThread chat1.ThreadView
		if t.remoteThreadDelay != nil {
			t.clock.Sleep(*t.remoteThreadDelay)
		}
		remoteThread, fullErr = t.G().ConvSource.Pull(ctx, convID, uid, reason, query, pagination)
		setDisplayedStatus(cancelUIStatus)
		if fullErr != nil {
			t.Debug(ctx, "LoadNonblock: error running Pull, returning error: %s", fullErr)
			return
		}

		// Acquire lock and send up actual response
		uilock.Lock()
		defer uilock.Unlock()
		var rthread chat1.ThreadView
		remoteThread = t.groupThreadView(ctx, uid, remoteThread)
		if rthread, fullErr =
			t.mergeLocalRemoteThread(ctx, &remoteThread, localSentThread, cbmode); fullErr != nil {
			return
		}
		t.Debug(ctx, "LoadNonblock: sending full response: messages: %d pager: %s",
			len(rthread.Messages), rthread.Pagination)
		uires := utils.PresentThreadView(ctx, t.G(), uid, rthread, convID)
		var jsonUIRes []byte
		if jsonUIRes, fullErr = json.Marshal(uires); fullErr != nil {
			t.Debug(ctx, "LoadNonblock: failed to JSON full result: %s", fullErr)
			return
		}
		resultPagination = rthread.Pagination
		t.applyPagerModeOutgoing(ctx, convID, rthread.Pagination, pagination, pgmode)
		start := time.Now()
		if fullErr = chatUI.ChatThreadFull(ctx, string(jsonUIRes)); err != nil {
			t.Debug(ctx, "LoadNonblock: failed to send full result to UI: %s", err)
			return
		}
		t.Debug(ctx, "LoadNonblock: full response send time: %v", time.Since(start))

		// This means we transmitted with success, so cancel local thread
		cancel()
	}()
	wg.Wait()

	t.Debug(ctx, "LoadNonblock: thread payloads transferred, checking for resolve")
	// Resolve any messages we didn't cache and get full information about
	if fullErr == nil {
		fullErr = func() error {
			skips := globals.CtxMessageCacheSkips(ctx)
			cancelUIStatus := t.setUIStatus(ctx, chatUI, chat1.NewUIChatThreadStatusWithValidating(0),
				getDelay())
			if t.resolveThreadDelay != nil {
				t.clock.Sleep(*t.resolveThreadDelay)
			}
			for _, skip := range skips {
				messages := skip.Msgs
				if len(messages) == 0 {
					continue
				}
				ctx = globals.CtxModifyUnboxMode(ctx, types.UnboxModeFull)
				t.Debug(ctx, "LoadNonblock: resolving message skips: convID: %s num: %d",
					skip.ConvID, len(messages))
				resolved, modifiedMap, err := NewBoxer(t.G()).ResolveSkippedUnboxeds(ctx, messages)
				if err != nil {
					return err
				}
				if err := t.G().ConvSource.PushUnboxed(ctx, skip.ConvID, uid, resolved); err != nil {
					return err
				}
				if !skip.ConvID.Eq(convID) {
					// only deliver these updates for the current conv
					continue
				}
				// filter resolved to only update changed messges
				var changed []chat1.MessageUnboxed
				for _, rmsg := range resolved {
					if modifiedMap[rmsg.GetMessageID()] {
						changed = append(changed, rmsg)
					}
				}
				if len(changed) == 0 {
					continue
				}
				conv, ierr := utils.GetUnverifiedConv(ctx, t.G(), uid, convID, types.InboxSourceDataSourceAll)
				if ierr != nil {
					return ierr
				}
				if changed, ierr = t.G().ConvSource.TransformSupersedes(ctx, conv.Conv, uid, changed,
					query, nil, nil); ierr != nil {
					return ierr
				}
				notif := chat1.MessagesUpdated{
					ConvID: convID,
				}
				for _, msg := range changed {
					if t.isConsolidateMsg(msg) {
						// we don't want to update these, it just messes up consolidation
						continue
					}
					notif.Updates = append(notif.Updates, utils.PresentMessageUnboxed(ctx, t.G(), msg, uid,
						convID))
				}
				act := chat1.NewChatActivityWithMessagesUpdated(notif)
				t.G().ActivityNotifier.Activity(ctx, uid, chat1.TopicType_CHAT,
					&act, chat1.ChatActivitySource_LOCAL)
			}
			setDisplayedStatus(cancelUIStatus)
			return nil
		}()
	}

	// Clean up context and set final loading status
	if getDisplayedStatus() {
		t.Debug(ctx, "LoadNonblock: status displayed, clearing")
		t.clock.Sleep(t.validatedDelay)
		if fullErr == nil {
			if err := chatUI.ChatThreadStatus(ctx, chat1.NewUIChatThreadStatusWithValidated()); err != nil {
				t.Debug(ctx, "LoadNonblock: failed to set status: %s", err)
			}
		} else {
			if err := chatUI.ChatThreadStatus(ctx, chat1.NewUIChatThreadStatusWithNone()); err != nil {
				t.Debug(ctx, "LoadNonblock: failed to set status: %s", err)
			}
		}
	}
	cancel()
	return fullErr
}

func (t *UIThreadLoader) Load(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	reason chat1.GetThreadReason, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (res chat1.ThreadView, err error) {
	defer t.Trace(ctx, func() error { return err }, "Load")()
	// Xlate pager control into pagination if given
	if query != nil && query.MessageIDControl != nil {
		pagination = t.messageIDControlToPagination(ctx, uid, convID,
			*query.MessageIDControl)
	}
	// Get messages from the source
	return t.G().ConvSource.Pull(ctx, convID, uid, reason, query, pagination)
}
