package chat

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/search"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/unfurl"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teambot"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/client/go/teams/opensearch"
	"github.com/keybase/pipeliner"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
)

type UISource interface {
	GetChatUI(sessionID int) libkb.ChatUI
	GetStreamUICli() *keybase1.StreamUiClient
}

type Server struct {
	globals.Contextified
	utils.DebugLabeler

	serverConn    types.ServerConnection
	uiSource      UISource
	boxer         *Boxer
	identNotifier types.IdentifyNotifier

	searchMu            sync.Mutex
	searchInboxMu       sync.Mutex
	loadGalleryMu       sync.Mutex
	searchCancelFn      context.CancelFunc
	searchInboxCancelFn context.CancelFunc
	loadGalleryCancelFn context.CancelFunc

	fileAttachmentDownloadConfigurationMu sync.RWMutex
	fileAttachmentDownloadCacheDir        string
	fileAttachmentDownloadDownloadDir     string

	// Only for testing
	rc         chat1.RemoteInterface
	mockChatUI libkb.ChatUI
}

var _ chat1.LocalInterface = (*Server)(nil)

func NewServer(g *globals.Context, serverConn types.ServerConnection, uiSource UISource) *Server {
	return &Server{
		Contextified:                      globals.NewContextified(g),
		DebugLabeler:                      utils.NewDebugLabeler(g.ExternalG(), "Server", false),
		serverConn:                        serverConn,
		uiSource:                          uiSource,
		boxer:                             NewBoxer(g),
		identNotifier:                     NewCachingIdentifyNotifier(g),
		fileAttachmentDownloadCacheDir:    g.GetEnv().GetCacheDir(),
		fileAttachmentDownloadDownloadDir: g.GetEnv().GetDownloadsDir(),
	}
}

func (h *Server) getChatUI(sessionID int) libkb.ChatUI {
	if h.mockChatUI != nil {
		return h.mockChatUI
	}
	return h.uiSource.GetChatUI(sessionID)
}

func (h *Server) getStreamUICli() *keybase1.StreamUiClient {
	return h.uiSource.GetStreamUICli()
}

func (h *Server) shouldSquashError(err error) bool {
	// these are not offline errors, but we never want the JS to receive them and potentially
	// display a black bar
	switch terr := err.(type) {
	case storage.AbortedError:
		return true
	case TransientUnboxingError:
		return h.shouldSquashError(terr.Inner())
	}
	switch err {
	case utils.ErrConvLockTabDeadlock, context.Canceled:
		return true
	}
	return false
}

func (h *Server) squashSquashableErrors(err error) error {
	if h.shouldSquashError(err) {
		return nil
	}
	return err
}

func (h *Server) handleOfflineError(ctx context.Context, err error,
	res chat1.OfflinableResult) error {
	if err == nil {
		return nil
	}
	if h.shouldSquashError(err) {
		return nil
	}

	errKind := IsOfflineError(err)
	h.Debug(ctx, "handleOfflineError: errType: %T", err)
	if errKind != OfflineErrorKindOnline {
		h.Debug(ctx, "handleOfflineError: setting offline: err: %s", err)
		res.SetOffline()
		switch errKind {
		case OfflineErrorKindOfflineReconnect:
			// Reconnect Gregor if we think we are offline (and told to reconnect)
			h.Debug(ctx, "handleOfflineError: reconnecting to gregor")
			if _, err := h.serverConn.Reconnect(ctx); err != nil {
				h.Debug(ctx, "handleOfflineError: error reconnecting: %s", err)
			} else {
				h.Debug(ctx, "handleOfflineError: success reconnecting")
			}
		default:
			// Nothing to do for other errors.
		}
		return nil
	}
	return err
}

func (h *Server) setResultRateLimit(ctx context.Context, res types.RateLimitedResult) {
	res.SetRateLimits(globals.CtxRateLimits(ctx))
}

func (h *Server) suspendBgConvLoads(ctx context.Context) func() {
	return utils.SuspendComponents(ctx, h.G(), []types.Suspendable{
		h.G().ConvLoader,
		h.G().Indexer,
	})
}

func (h *Server) suspendInboxSource(ctx context.Context) func() {
	return utils.SuspendComponent(ctx, h.G(), h.G().InboxSource)
}

func (h *Server) RequestInboxLayout(ctx context.Context, reselectMode chat1.InboxLayoutReselectMode) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, &err, "RequestInboxLayout")()
	h.G().UIInboxLoader.UpdateLayout(ctx, reselectMode, "UI request")
	return nil
}

func (h *Server) RequestInboxUnbox(ctx context.Context, convIDs []chat1.ConversationID) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	ctx = globals.CtxAddLocalizerCancelable(ctx)
	defer h.Trace(ctx, &err, "RequestInboxUnbox")()
	defer h.PerfTrace(ctx, &err, "RequestInboxUnbox")()
	for _, convID := range convIDs {
		h.GetPerfLog().CDebugf(ctx, "RequestInboxUnbox: queuing unbox for: %s", convID)
		h.Debug(ctx, "RequestInboxUnbox: queuing unbox for: %s", convID)
	}
	if err := h.G().UIInboxLoader.UpdateConvs(ctx, convIDs); err != nil {
		h.Debug(ctx, "RequestInboxUnbox: failed to update convs: %s", err)
	}
	return nil
}

func (h *Server) RequestInboxSmallIncrease(ctx context.Context) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, &err, "RequestInboxSmallIncrease")()
	h.G().UIInboxLoader.UpdateLayoutFromSmallIncrease(ctx)
	return nil
}

func (h *Server) RequestInboxSmallReset(ctx context.Context) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, &err, "RequestInboxSmallReset")()
	h.G().UIInboxLoader.UpdateLayoutFromSmallReset(ctx)
	return nil
}

func (h *Server) GetInboxNonblockLocal(ctx context.Context, arg chat1.GetInboxNonblockLocalArg) (res chat1.NonblockFetchRes, err error) {
	var breaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &breaks, h.identNotifier)
	ctx = globals.CtxAddLocalizerCancelable(ctx)
	defer h.Trace(ctx, &err, "GetInboxNonblockLocal")()
	defer h.PerfTrace(ctx, &err, "GetInboxNonblockLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetInboxNonblockLocal: result obtained offline")
		}
	}()
	defer h.suspendBgConvLoads(ctx)()

	if err := h.G().UIInboxLoader.LoadNonblock(ctx, arg.Query, arg.MaxUnbox,
		arg.SkipUnverified); err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	res.IdentifyFailures = breaks
	return res, nil
}

func (h *Server) MarkAsReadLocal(ctx context.Context, arg chat1.MarkAsReadLocalArg) (res chat1.MarkAsReadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, &err,
		fmt.Sprintf("MarkAsReadLocal(%s, %v)", arg.ConversationID, arg.MsgID))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		h.Debug(ctx, "MarkAsRead: not logged in: %s", err)
		return chat1.MarkAsReadLocalRes{}, nil
	}
	// Don't send remote mark as read if we somehow get this in the background.
	if h.G().MobileAppState.State() != keybase1.MobileAppState_FOREGROUND {
		h.Debug(ctx, "MarkAsReadLocal: not marking as read, app state not foreground: %v",
			h.G().MobileAppState.State())
		return chat1.MarkAsReadLocalRes{
			Offline: h.G().InboxSource.IsOffline(ctx),
		}, nil
	}
	if err = h.G().InboxSource.MarkAsRead(ctx, arg.ConversationID, uid, arg.MsgID, arg.ForceUnread); err != nil {
		switch err {
		case utils.ErrGetUnverifiedConvNotFound, utils.ErrGetVerifiedConvNotFound:
			// if we couldn't find the conv, then just act like it worked
		default:
			return res, err
		}
	}
	return chat1.MarkAsReadLocalRes{
		Offline: h.G().InboxSource.IsOffline(ctx),
	}, nil
}

func (h *Server) MarkTLFAsReadLocal(ctx context.Context, arg chat1.MarkTLFAsReadLocalArg) (res chat1.MarkTLFAsReadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, nil)
	defer h.Trace(ctx, &err, "MarkTLFAsRead")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	convs, err := h.G().TeamChannelSource.GetChannelsFull(ctx, uid, arg.TlfID, chat1.TopicType_CHAT)
	if err != nil {
		return res, err
	}
	epick := libkb.FirstErrorPicker{}
	for _, conv := range convs {
		_, err = h.MarkAsReadLocal(ctx, chat1.MarkAsReadLocalArg{
			ConversationID: conv.GetConvID(),
			MsgID:          &conv.ReaderInfo.MaxMsgid,
		})
		epick.Push(err)
	}
	return chat1.MarkTLFAsReadLocalRes{
		Offline: h.G().InboxSource.IsOffline(ctx),
	}, epick.Error()
}

// GetInboxAndUnboxLocal implements keybase.chatLocal.getInboxAndUnboxLocal protocol.
func (h *Server) GetInboxAndUnboxLocal(ctx context.Context, arg chat1.GetInboxAndUnboxLocalArg) (res chat1.GetInboxAndUnboxLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	if arg.Query != nil && arg.Query.TopicType != nil && *arg.Query.TopicType != chat1.TopicType_CHAT {
		// make this cancelable for things like KBFS file edit convs
		ctx = globals.CtxAddLocalizerCancelable(ctx)
	}
	defer h.Trace(ctx, &err, "GetInboxAndUnboxLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	// Ignore these requests on mobile
	if h.G().IsMobileAppType() && arg.Query != nil && arg.Query.TopicType != nil &&
		*arg.Query.TopicType == chat1.TopicType_KBFSFILEEDIT {
		return chat1.GetInboxAndUnboxLocalRes{
			IdentifyFailures: identBreaks,
		}, nil
	}

	// Read inbox from the source
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, arg.Query)
	switch err.(type) {
	case nil:
	case UnknownTLFNameError:
		h.Debug(ctx, "GetInboxAndUnboxLocal: got unknown TLF name error, returning blank results")
		ib.Convs = nil
	default:
		return res, err
	}

	return chat1.GetInboxAndUnboxLocalRes{
		Conversations:    ib.Convs,
		Offline:          h.G().InboxSource.IsOffline(ctx),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetInboxAndUnboxUILocal(ctx context.Context, arg chat1.GetInboxAndUnboxUILocalArg) (res chat1.GetInboxAndUnboxUILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "GetInboxAndUnboxUILocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	// Read inbox from the source
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, arg.Query)
	switch err.(type) {
	case nil:
	case UnknownTLFNameError:
		h.Debug(ctx, "GetInboxAndUnboxUILocal: got unknown TLF name error, returning blank results")
		ib.Convs = nil
	default:
		return res, err
	}
	return chat1.GetInboxAndUnboxUILocalRes{
		Conversations: utils.PresentConversationLocals(ctx, h.G(), uid, ib.Convs,
			utils.PresentParticipantsModeInclude),
		IdentifyFailures: identBreaks,
	}, nil
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *Server) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (res chat1.GetThreadLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "GetThreadLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}
	thread, err := h.G().UIThreadLoader.Load(ctx, uid, arg.ConversationID, arg.Reason, nil, arg.Query,
		arg.Pagination)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}
	return chat1.GetThreadLocalRes{
		Thread:           thread,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetUnreadline(ctx context.Context, arg chat1.GetUnreadlineArg) (res chat1.UnreadlineRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err,
		fmt.Sprintf("GetUnreadline: convID: %v, readMsgID: %v", arg.ConvID, arg.ReadMsgID))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()

	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	res.UnreadlineID, err = h.G().ConvSource.GetUnreadline(ctx, arg.ConvID, uid, arg.ReadMsgID)
	if err != nil {
		h.Debug(ctx, "GetUnreadline: unable to run UnreadMsgID: %v", err)
		return res, err
	}
	return res, nil
}

func (h *Server) GetThreadNonblock(ctx context.Context, arg chat1.GetThreadNonblockArg) (res chat1.NonblockFetchRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err,
		fmt.Sprintf("GetThreadNonblock(%s,%v,%v)", arg.ConversationID, arg.CbMode, arg.Reason))()
	defer h.PerfTrace(ctx, &err,
		fmt.Sprintf("GetThreadNonblock(%s,%v,%v)", arg.ConversationID, arg.CbMode, arg.Reason))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer h.suspendBgConvLoads(ctx)()
	defer h.suspendInboxSource(ctx)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.NonblockFetchRes{}, err
	}
	chatUI := h.getChatUI(arg.SessionID)
	return res, h.G().UIThreadLoader.LoadNonblock(ctx, chatUI, uid, arg.ConversationID, arg.Reason,
		arg.Pgmode, arg.CbMode, arg.KnownRemotes, arg.Query, arg.Pagination)
}

func (h *Server) NewConversationsLocal(ctx context.Context, arg chat1.NewConversationsLocalArg) (res chat1.NewConversationsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("NewConversationsLocal(len=%d)", len(arg.NewConversationLocalArguments)))()
	defer func() { h.setResultRateLimit(ctx, &res) }()

	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.NewConversationsLocalRes{}, err
	}

	var errs []error
	for _, convArg := range arg.NewConversationLocalArguments {
		var result chat1.NewConversationsLocalResult
		newConvRes, err := h.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
			TlfName:          convArg.TlfName,
			TopicType:        convArg.TopicType,
			TlfVisibility:    convArg.TlfVisibility,
			TopicName:        convArg.TopicName,
			MembersType:      convArg.MembersType,
			IdentifyBehavior: arg.IdentifyBehavior,
		})
		if err != nil {
			e := err.Error()
			result.Err = &e
			errs = append(errs, err)
		} else {
			result.Result = new(chat1.NewConversationLocalRes)
			result.Result.Conv = newConvRes.Conv
			result.Result.UiConv = newConvRes.UiConv
		}
		res.Results = append(res.Results, result)
	}

	res.IdentifyFailures = identBreaks
	return res, libkb.CombineErrors(errs...)
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
// Create a new conversation. Or in the case of CHAT, create-or-get a conversation.
func (h *Server) NewConversationLocal(ctx context.Context, arg chat1.NewConversationLocalArg) (res chat1.NewConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err,
		fmt.Sprintf("NewConversationLocal(%s|%v)", arg.TlfName, arg.MembersType))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.NewConversationLocalRes{}, err
	}

	conv, created, err := NewConversation(ctx, h.G(), uid, arg.TlfName, arg.TopicName,
		arg.TopicType, arg.MembersType, arg.TlfVisibility, nil, h.remoteClient, NewConvFindExistingNormal)
	if err != nil {
		h.Debug(ctx, "NewConversationLocal: failed to make conv: %s", err)
		return res, err
	}

	res.Conv = conv
	res.UiConv = utils.PresentConversationLocal(ctx, h.G(), uid, conv, utils.PresentParticipantsModeInclude)
	res.IdentifyFailures = identBreaks

	// If we are making a new channel in a team, send a system message to
	// indicate this.
	if created && arg.MembersType == chat1.ConversationMembersType_TEAM &&
		arg.TopicType == chat1.TopicType_CHAT &&
		arg.TopicName != nil && *arg.TopicName != globals.DefaultTeamTopic {
		subBody := chat1.NewMessageSystemWithNewchannel(chat1.MessageSystemNewChannel{
			Creator:        h.G().Env.GetUsername().String(),
			NameAtCreation: *arg.TopicName,
			ConvID:         conv.GetConvID(),
		})
		body := chat1.NewMessageBodyWithSystem(subBody)
		err = h.G().ChatHelper.SendMsgByName(ctx, conv.Info.TlfName,
			&globals.DefaultTeamTopic, arg.MembersType, keybase1.TLFIdentifyBehavior_CHAT_CLI,
			body, chat1.MessageType_SYSTEM)
		if err != nil {
			h.Debug(ctx, "NewConversationLocal: unable to post new channel system message: %v", err)
		}
	}

	// If we have this conv hidden, then let's bring it back before returning
	if !utils.GetConversationStatusBehavior(conv.Info.Status).ShowInInbox {
		h.Debug(ctx, "NewConversationLocal: new conversation not shown, unhiding: %s", conv.GetConvID())
		if err := h.G().InboxSource.RemoteSetConversationStatus(ctx, uid, conv.GetConvID(),
			chat1.ConversationStatus_UNFILED); err != nil {
			h.Debug(ctx, "NewConversationLocal: unable to unhide conv: %s", err)
			return res, err
		}
	}

	return res, nil
}

func (h *Server) limitConvResults(ctx context.Context, uid gregor1.UID, allConvs []types.RemoteConversation,
	num int) ([]chat1.ConversationLocal, error) {
	var convs []types.RemoteConversation
	sort.Sort(utils.RemoteConvByMtime(allConvs))
	if len(allConvs) <= num {
		convs = allConvs
	} else {
		convs = allConvs[:num]
	}
	locals, _, err := h.G().InboxSource.Localize(ctx, uid, convs, types.ConversationLocalizerBlocking)
	if err != nil {
		return nil, err
	}
	return locals, nil
}

func (h *Server) GetInboxSummaryForCLILocal(ctx context.Context, arg chat1.GetInboxSummaryForCLILocalQuery) (res chat1.GetInboxSummaryForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, &err, "GetInboxSummaryForCLILocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.GetInboxSummaryForCLILocalRes{}, err
	}

	var after time.Time
	if len(arg.After) > 0 {
		after, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.After)
		if err != nil {
			return res, fmt.Errorf("parsing time or duration (%s) error: %s", arg.After, err)
		}
	}
	var before time.Time
	if len(arg.Before) > 0 {
		before, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), arg.Before)
		if err != nil {
			return res, fmt.Errorf("parsing time or duration (%s) error: %s", arg.Before, err)
		}
	}

	var queryBase chat1.GetInboxQuery
	queryBase.ComputeActiveList = true
	queryBase.OneChatTypePerTLF = new(bool)
	*queryBase.OneChatTypePerTLF = true
	if !after.IsZero() {
		gafter := gregor1.ToTime(after)
		queryBase.After = &gafter
	}
	if !before.IsZero() {
		gbefore := gregor1.ToTime(before)
		queryBase.Before = &gbefore
	}
	if arg.TopicType != chat1.TopicType_NONE {
		queryBase.TopicType = &arg.TopicType
	}
	if arg.Visibility != keybase1.TLFVisibility_ANY {
		queryBase.TlfVisibility = &arg.Visibility
	}
	queryBase.Status = arg.Status
	queryBase.ConvIDs = arg.ConvIDs

	var gires chat1.GetInboxAndUnboxLocalRes
	if arg.UnreadFirst {
		if arg.UnreadFirstLimit.AtMost <= 0 {
			arg.UnreadFirstLimit.AtMost = int(^uint(0) >> 1) // maximum int
		}
		if arg.UnreadFirstLimit.AtMost < arg.UnreadFirstLimit.AtLeast {
			arg.UnreadFirstLimit.AtMost = arg.UnreadFirstLimit.AtLeast
		}
		query := queryBase
		query.UnreadOnly, query.ReadOnly = true, false
		ib, err := h.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll, &query)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}
		res.Conversations, err = h.limitConvResults(ctx, uid, ib.ConvsUnverified,
			arg.UnreadFirstLimit.AtMost)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}

		more := utils.Collar(
			arg.UnreadFirstLimit.AtLeast-len(res.Conversations),
			arg.UnreadFirstLimit.NumRead,
			arg.UnreadFirstLimit.AtMost-len(res.Conversations),
		)
		if more > 0 {
			query := queryBase
			query.UnreadOnly, query.ReadOnly = false, true
			ib, err := h.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll, &query)
			if err != nil {
				return chat1.GetInboxSummaryForCLILocalRes{}, err
			}
			moreConvs, err := h.limitConvResults(ctx, uid, ib.ConvsUnverified, more)
			if err != nil {
				return chat1.GetInboxSummaryForCLILocalRes{}, err
			}
			res.Conversations = append(res.Conversations, moreConvs...)
		}
	} else {
		if arg.ActivitySortedLimit <= 0 {
			arg.ActivitySortedLimit = int(^uint(0) >> 1) // maximum int
		}
		query := queryBase
		query.UnreadOnly, query.ReadOnly = false, false
		ib, err := h.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll, &query)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}
		res.Conversations, err = h.limitConvResults(ctx, uid, ib.ConvsUnverified, arg.ActivitySortedLimit)
		if err != nil {
			return chat1.GetInboxSummaryForCLILocalRes{}, err
		}
	}
	res.Offline = gires.Offline
	return res, nil
}

func (h *Server) GetConversationForCLILocal(ctx context.Context, arg chat1.GetConversationForCLILocalQuery) (res chat1.GetConversationForCLILocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &identBreaks,
		h.identNotifier)
	defer h.Trace(ctx, &err, "GetConversationForCLILocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}

	if arg.Limit.AtMost <= 0 {
		arg.Limit.AtMost = int(^uint(0) >> 1) // maximum int
	}
	if arg.Limit.AtMost < arg.Limit.AtLeast {
		arg.Limit.AtMost = arg.Limit.AtLeast
	}

	convLocal := arg.Conv

	var since time.Time
	if arg.Since != nil {
		since, err = utils.ParseTimeFromRFC3339OrDurationFromPast(h.G(), *arg.Since)
		if err != nil {
			return res, fmt.Errorf("parsing time or duration (%s) error: %s", *arg.Since, since)
		}
	}

	query := chat1.GetThreadQuery{
		MarkAsRead:   arg.MarkAsRead,
		MessageTypes: arg.MessageTypes,
	}
	if !since.IsZero() {
		gsince := gregor1.ToTime(since)
		query.After = &gsince
	}

	tv, err := h.GetThreadLocal(ctx, chat1.GetThreadLocalArg{
		ConversationID:   convLocal.Info.Id,
		Query:            &query,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return chat1.GetConversationForCLILocalRes{}, err
	}

	// apply message count limits
	var messages []chat1.MessageUnboxed
	for _, m := range tv.Thread.Messages {
		messages = append(messages, m)

		arg.Limit.AtMost--
		arg.Limit.AtLeast--
		if m.GetMessageID() <= convLocal.ReaderInfo.ReadMsgid {
			arg.Limit.NumRead--
		}
		if arg.Limit.AtMost <= 0 ||
			(arg.Limit.NumRead <= 0 && arg.Limit.AtLeast <= 0) {
			break
		}
	}

	return chat1.GetConversationForCLILocalRes{
		Conversation: convLocal,
		Messages:     messages,
		Offline:      tv.Offline,
	}, nil
}

func (h *Server) GetMessagesLocal(ctx context.Context, arg chat1.GetMessagesLocalArg) (res chat1.GetMessagesLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "GetMessagesLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	reason := chat1.GetThreadReason_GENERAL
	messages, err := h.G().ChatHelper.GetMessages(ctx, uid, arg.ConversationID, arg.MessageIDs,
		!arg.DisableResolveSupersedes, &reason)
	if err != nil {
		return res, err
	}
	return chat1.GetMessagesLocalRes{
		Messages:         messages,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) GetNextAttachmentMessageLocal(ctx context.Context,
	arg chat1.GetNextAttachmentMessageLocalArg) (res chat1.GetNextAttachmentMessageLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "GetNextAttachmentMessageLocal(%s,%d,%v)",
		arg.ConvID, arg.MessageID, arg.BackInTime)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	gallery := attachments.NewGallery(h.G())
	unboxed, _, err := gallery.NextMessage(ctx, uid, arg.ConvID, arg.MessageID,
		attachments.NextMessageOptions{
			BackInTime: arg.BackInTime,
			AssetTypes: arg.AssetTypes,
		},
	)
	if err != nil {
		return res, err
	}
	var resMsg *chat1.UIMessage
	if unboxed != nil {
		resMsg = new(chat1.UIMessage)
		*resMsg = utils.PresentMessageUnboxed(ctx, h.G(), *unboxed, uid, arg.ConvID)
	}
	return chat1.GetNextAttachmentMessageLocalRes{
		Message:          resMsg,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) SetConversationStatusLocal(ctx context.Context, arg chat1.SetConversationStatusLocalArg) (res chat1.SetConversationStatusLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("SetConversationStatusLocal: %v", arg.Status))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	err = h.G().InboxSource.RemoteSetConversationStatus(ctx, uid, arg.ConversationID, arg.Status)
	return chat1.SetConversationStatusLocalRes{
		IdentifyFailures: identBreaks,
	}, err
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *Server) PostLocal(ctx context.Context, arg chat1.PostLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "PostLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Check for any slash command hits for an execute
	if handled, err := h.G().CommandsSource.AttemptBuiltinCommand(ctx, uid, arg.ConversationID,
		arg.Msg.ClientHeader.TlfName, arg.Msg.MessageBody, arg.ReplyTo); handled {
		h.Debug(ctx, "PostLocal: handled slash command with error: %s", err)
		return res, nil
	}

	// Run Stellar UI on any payments in the body
	if !arg.SkipInChatPayments {
		if arg.Msg.MessageBody, err = h.runStellarSendUI(ctx, arg.SessionID, uid, arg.ConversationID,
			arg.Msg.MessageBody, arg.ReplyTo); err != nil {
			return res, err
		}
	}

	var prepareOpts chat1.SenderPrepareOptions
	prepareOpts.ReplyTo = arg.ReplyTo
	sender := NewBlockingSender(h.G(), h.boxer, h.remoteClient)
	_, msgBoxed, err := sender.Send(ctx, arg.ConversationID, arg.Msg, 0, nil, nil, &prepareOpts)
	if err != nil {
		h.Debug(ctx, "PostLocal: unable to send message: %s", err.Error())
		return res, err
	}

	return chat1.PostLocalRes{
		MessageID:        msgBoxed.GetMessageID(),
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) PostDeleteNonblock(ctx context.Context, arg chat1.PostDeleteNonblockArg) (chat1.PostLocalNonblockRes, error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_DELETE
	parg.Msg.ClientHeader.Supersedes = arg.Supersedes
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostEditNonblock(ctx context.Context, arg chat1.PostEditNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "PostEditNonblock")()

	var parg chat1.PostLocalNonblockArg
	var supersedes chat1.MessageID
	if arg.Target.MessageID != nil && *arg.Target.MessageID > 0 {
		supersedes = *arg.Target.MessageID
	}
	if supersedes.IsNil() && arg.Target.OutboxID == nil {
		return res, errors.New("must specify a messageID or outboxID for edit")
	}
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_EDIT
	parg.Msg.ClientHeader.Supersedes = supersedes
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
		MessageID: supersedes,
		Body:      arg.Body,
	})
	if supersedes.IsNil() {
		h.Debug(ctx, "PostEditNonblock: setting supersedes outboxID: %s", arg.Target.OutboxID)
		parg.Msg.SupersedesOutboxID = arg.Target.OutboxID
	}
	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) runStellarSendUI(ctx context.Context, sessionID int, uid gregor1.UID,
	convID chat1.ConversationID, msgBody chat1.MessageBody, replyTo *chat1.MessageID) (res chat1.MessageBody, err error) {
	defer h.Trace(ctx, &err, "runStellarSendUI")()
	ui := h.getChatUI(sessionID)
	bodyTyp, err := msgBody.MessageType()
	if err != nil || bodyTyp != chat1.MessageType_TEXT {
		return msgBody, nil
	}
	body := msgBody.Text().Body
	parsedPayments := h.G().StellarSender.ParsePayments(ctx, uid, convID, body, replyTo)
	if len(parsedPayments) == 0 {
		h.Debug(ctx, "runStellarSendUI: no payments")
		return msgBody, nil
	}
	h.Debug(ctx, "runStellarSendUI: payments found, showing confirm screen")
	if err := ui.ChatStellarShowConfirm(ctx); err != nil {
		return res, err
	}
	defer func() {
		_ = ui.ChatStellarDone(ctx, err != nil)
	}()
	uiSummary, toSend, err := h.G().StellarSender.DescribePayments(ctx, uid, convID, parsedPayments)
	if err != nil {
		if err := libkb.ExportErrorAsStatus(h.G().GlobalContext, err); err != nil {
			_, _ = ui.ChatStellarDataError(ctx, *err)
		} else {
			h.Debug(ctx, "error exported to nothing") // should never happen
		}
		return res, err
	}
	h.Debug(ctx, "runStellarSendUI: payments described, telling UI")
	accepted, err := ui.ChatStellarDataConfirm(ctx, uiSummary)
	if err != nil {
		return res, err
	}
	if !accepted {
		return res, errors.New("Payment message declined")
	}
	h.Debug(ctx, "runStellarSendUI: message confirmed, sending payments")
	payments, err := h.G().StellarSender.SendPayments(ctx, convID, toSend)
	if err != nil {
		// Send regardless here
		h.Debug(ctx, "runStellarSendUI: failed to send payments, but continuing on: %s", err)
		return msgBody, nil
	}
	newBody := msgBody.Text().DeepCopy()
	newBody.Body = body
	newBody.Payments = payments
	return chat1.NewMessageBodyWithText(newBody), nil
}

var quickReactionPattern = regexp.MustCompile(`(?:^\+:)([^\s]+)(?::)$`)

func (h *Server) isQuickReaction(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	body string) (reaction string, msgID chat1.MessageID, ok bool) {
	body = strings.TrimSpace(body)
	if !(strings.HasPrefix(body, "+:") && strings.HasSuffix(body, ":")) {
		return "", 0, false
	}
	hits := quickReactionPattern.FindStringSubmatch(body)
	if len(hits) < 2 {
		return "", 0, false
	}
	tryStock := func() (string, bool) {
		if h.G().EmojiSource.IsStockEmoji(hits[1]) {
			return ":" + hits[1] + ":", true
		}
		return "", false
	}
	tryCustom := func() (string, bool) {
		emojis, err := h.G().EmojiSource.Harvest(ctx, body, uid, convID, types.EmojiHarvestModeFast)
		if err != nil {
			h.Debug(ctx, "isQuickReaction: failed to harvest: %s", err)
			return "", false
		}
		if len(emojis) != 1 {
			return "", false
		}
		return ":" + emojis[0].Alias + ":", true
	}
	var hit *string
	if reaction, ok = tryStock(); ok {
		hit = new(string)
		*hit = reaction
	}
	if hit == nil {
		if reaction, ok = tryCustom(); ok {
			hit = new(string)
			*hit = reaction
		}
	}
	if hit == nil {
		return "", 0, false
	}
	conv, err := utils.GetUnverifiedConv(ctx, h.G(), uid, convID, types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		h.Debug(ctx, "isQuickReaction: failed to get conv: %s", err)
		return "", 0, false
	}
	return *hit, conv.MaxVisibleMsgID(), true
}

func (h *Server) PostTextNonblock(ctx context.Context, arg chat1.PostTextNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "PostTextNonblock")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	reaction, msgID, ok := h.isQuickReaction(ctx, uid, arg.ConversationID, arg.Body)
	if ok {
		h.Debug(ctx, "PostTextNonblock: detected quick reaction")
		return h.PostReactionNonblock(ctx, chat1.PostReactionNonblockArg{
			ConversationID:   arg.ConversationID,
			TlfName:          arg.TlfName,
			TlfPublic:        arg.TlfPublic,
			Supersedes:       msgID,
			Body:             reaction,
			OutboxID:         arg.OutboxID,
			ClientPrev:       arg.ClientPrev,
			IdentifyBehavior: arg.IdentifyBehavior,
		})
	}

	var parg chat1.PostLocalNonblockArg
	parg.SessionID = arg.SessionID
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.ReplyTo = arg.ReplyTo
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_TEXT
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: arg.Body,
	})
	if arg.EphemeralLifetime != nil {
		parg.Msg.ClientHeader.EphemeralMetadata = &chat1.MsgEphemeralMetadata{
			Lifetime: *arg.EphemeralLifetime,
		}
	}
	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostReactionNonblock(ctx context.Context, arg chat1.PostReactionNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_REACTION
	parg.Msg.ClientHeader.Supersedes = arg.Supersedes
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithReaction(chat1.MessageReaction{
		MessageID: arg.Supersedes,
		Body:      arg.Body,
	})

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostHeadlineNonblock(ctx context.Context, arg chat1.PostHeadlineNonblockArg) (chat1.PostLocalNonblockRes, error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{
		Headline: arg.Headline,
	})

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostHeadline(ctx context.Context, arg chat1.PostHeadlineArg) (chat1.PostLocalRes, error) {
	var parg chat1.PostLocalArg
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{
		Headline: arg.Headline,
	})

	return h.PostLocal(ctx, parg)
}

func (h *Server) PostMetadataNonblock(ctx context.Context, arg chat1.PostMetadataNonblockArg) (chat1.PostLocalNonblockRes, error) {
	var parg chat1.PostLocalNonblockArg
	parg.ClientPrev = arg.ClientPrev
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.OutboxID = arg.OutboxID
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_METADATA
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
		ConversationTitle: arg.ChannelName,
	})

	return h.PostLocalNonblock(ctx, parg)
}

func (h *Server) PostMetadata(ctx context.Context, arg chat1.PostMetadataArg) (chat1.PostLocalRes, error) {
	var parg chat1.PostLocalArg
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_METADATA
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{
		ConversationTitle: arg.ChannelName,
	})

	return h.PostLocal(ctx, parg)
}

func (h *Server) PostDeleteHistoryUpto(ctx context.Context, arg chat1.PostDeleteHistoryUptoArg) (res chat1.PostLocalRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "PostDeleteHistoryUpto")()

	delh := chat1.MessageDeleteHistory{Upto: arg.Upto}

	var parg chat1.PostLocalArg
	parg.ConversationID = arg.ConversationID
	parg.IdentifyBehavior = arg.IdentifyBehavior
	parg.Msg.ClientHeader.MessageType = chat1.MessageType_DELETEHISTORY
	parg.Msg.ClientHeader.TlfName = arg.TlfName
	parg.Msg.ClientHeader.TlfPublic = arg.TlfPublic
	parg.Msg.ClientHeader.DeleteHistory = &delh
	parg.Msg.MessageBody = chat1.NewMessageBodyWithDeletehistory(delh)

	h.Debug(ctx, "PostDeleteHistoryUpto: deleting upto msgid:%v", delh.Upto)

	return h.PostLocal(ctx, parg)
}

func (h *Server) PostDeleteHistoryThrough(ctx context.Context, arg chat1.PostDeleteHistoryThroughArg) (res chat1.PostLocalRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "PostDeleteHistoryThrough")()
	return h.PostDeleteHistoryUpto(ctx, chat1.PostDeleteHistoryUptoArg{
		ConversationID:   arg.ConversationID,
		TlfName:          arg.TlfName,
		TlfPublic:        arg.TlfPublic,
		IdentifyBehavior: arg.IdentifyBehavior,
		Upto:             arg.Through + 1,
	})
}

func (h *Server) PostDeleteHistoryByAge(ctx context.Context, arg chat1.PostDeleteHistoryByAgeArg) (res chat1.PostLocalRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "PostDeleteHistoryByAge")()

	gmRes, err := h.remoteClient().GetMessageBefore(ctx, chat1.GetMessageBeforeArg{
		ConvID: arg.ConversationID,
		Age:    arg.Age,
	})
	if err != nil {
		return res, err
	}
	upto := gmRes.MsgID + 1
	h.Debug(ctx, "PostDeleteHistoryByAge: deleting upto msgid:%v (age:%v)", upto, arg.Age)
	return h.PostDeleteHistoryUpto(ctx, chat1.PostDeleteHistoryUptoArg{
		ConversationID:   arg.ConversationID,
		TlfName:          arg.TlfName,
		TlfPublic:        arg.TlfPublic,
		IdentifyBehavior: arg.IdentifyBehavior,
		Upto:             upto,
	})
}

func (h *Server) GenerateOutboxID(ctx context.Context) (res chat1.OutboxID, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GenerateOutboxID")()
	return storage.NewOutboxID()
}

func (h *Server) PostLocalNonblock(ctx context.Context, arg chat1.PostLocalNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "PostLocalNonblock")()
	defer h.suspendBgConvLoads(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Clear draft
	if err := h.G().InboxSource.Draft(ctx, uid, arg.ConversationID, nil); err != nil {
		h.Debug(ctx, "PostLocalNonblock: failed to clear draft: %s", err)
	}

	// Check for any slash command hits for an execute
	if handled, err := h.G().CommandsSource.AttemptBuiltinCommand(ctx, uid, arg.ConversationID,
		arg.Msg.ClientHeader.TlfName, arg.Msg.MessageBody, arg.ReplyTo); handled {
		h.Debug(ctx, "PostLocalNonblock: handled slash command with error: %s", err)
		return res, nil
	}

	if !arg.SkipInChatPayments {
		// Determine if the messages contains any Stellar payments, and execute
		// them if so
		if arg.Msg.MessageBody, err = h.runStellarSendUI(ctx, arg.SessionID, uid, arg.ConversationID,
			arg.Msg.MessageBody, arg.ReplyTo); err != nil {
			return res, err
		}
	}

	// Create non block sender
	var prepareOpts chat1.SenderPrepareOptions
	sender := NewBlockingSender(h.G(), h.boxer, h.remoteClient)
	nonblockSender := NewNonblockingSender(h.G(), sender)
	prepareOpts.ReplyTo = arg.ReplyTo
	if arg.Msg.ClientHeader.Conv.TopicType == chat1.TopicType_NONE {
		arg.Msg.ClientHeader.Conv.TopicType = chat1.TopicType_CHAT
	}
	obid, _, err := nonblockSender.Send(ctx, arg.ConversationID, arg.Msg, arg.ClientPrev, arg.OutboxID,
		nil, &prepareOpts)
	if err != nil {
		return res, fmt.Errorf("PostLocalNonblock: unable to send message: err: %s", err.Error())
	}
	h.Debug(ctx, "PostLocalNonblock: using outboxID: %s", obid)

	return chat1.PostLocalNonblockRes{
		OutboxID:         obid,
		IdentifyFailures: identBreaks,
	}, nil
}

// MakePreview implements chat1.LocalInterface.MakePreview.
func (h *Server) MakePreview(ctx context.Context, arg chat1.MakePreviewArg) (res chat1.MakePreviewRes, err error) {
	defer h.Trace(ctx, &err, "MakePreview")()
	return attachments.NewSender(h.G()).MakePreview(ctx, arg.Filename, arg.OutboxID)
}

func (h *Server) MakeAudioPreview(ctx context.Context, arg chat1.MakeAudioPreviewArg) (res chat1.MakePreviewRes, err error) {
	defer h.Trace(ctx, &err, "MakeAudioPreview")()
	return attachments.NewSender(h.G()).MakeAudioPreview(ctx, arg.Amps, arg.Duration)
}

func (h *Server) GetUploadTempFile(ctx context.Context, arg chat1.GetUploadTempFileArg) (res string, err error) {
	defer h.Trace(ctx, &err, "GetUploadTempFile")()
	return h.G().AttachmentUploader.GetUploadTempFile(ctx, arg.OutboxID, arg.Filename)
}

func (h *Server) MakeUploadTempFile(ctx context.Context, arg chat1.MakeUploadTempFileArg) (res string, err error) {
	defer h.Trace(ctx, &err, "MakeUploadTempFile")()
	if res, err = h.G().AttachmentUploader.GetUploadTempFile(ctx, arg.OutboxID, arg.Filename); err != nil {
		return res, err
	}
	return res, os.WriteFile(res, arg.Data, 0644)
}

func (h *Server) CancelUploadTempFile(ctx context.Context, outboxID chat1.OutboxID) (err error) {
	defer h.Trace(ctx, &err, "CancelUploadTempFile: %s", outboxID)()
	return h.G().AttachmentUploader.CancelUploadTempFile(ctx, outboxID)
}

func (h *Server) PostFileAttachmentLocalNonblock(ctx context.Context,
	arg chat1.PostFileAttachmentLocalNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.Arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "PostFileAttachmentLocalNonblock")()
	defer h.suspendBgConvLoads(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Create non block sender
	sender := NewNonblockingSender(h.G(), NewBlockingSender(h.G(), h.boxer, h.remoteClient))
	outboxID, _, err := attachments.NewSender(h.G()).PostFileAttachmentMessage(ctx, sender,
		arg.Arg.ConversationID, arg.Arg.TlfName, arg.Arg.Visibility, arg.Arg.OutboxID, arg.Arg.Filename,
		arg.Arg.Title, arg.Arg.Metadata, arg.ClientPrev, arg.Arg.EphemeralLifetime,
		arg.Arg.CallerPreview)
	if err != nil {
		return res, err
	}
	_, err = h.G().AttachmentUploader.Register(ctx, uid, arg.Arg.ConversationID, outboxID, arg.Arg.Title,
		arg.Arg.Filename, nil, arg.Arg.CallerPreview)
	if err != nil {
		return res, err
	}
	return chat1.PostLocalNonblockRes{
		OutboxID:         outboxID,
		IdentifyFailures: identBreaks,
	}, nil
}

// PostFileAttachmentLocal implements chat1.LocalInterface.PostFileAttachmentLocal.
func (h *Server) PostFileAttachmentLocal(ctx context.Context, arg chat1.PostFileAttachmentLocalArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.Arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "PostFileAttachmentLocal")()
	defer h.suspendBgConvLoads(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Get base of message we are going to send
	sender := NewBlockingSender(h.G(), h.boxer, h.remoteClient)
	_, msgID, err := attachments.NewSender(h.G()).PostFileAttachment(ctx, sender, uid, arg.Arg.ConversationID,
		arg.Arg.TlfName, arg.Arg.Visibility, arg.Arg.OutboxID, arg.Arg.Filename, arg.Arg.Title,
		arg.Arg.Metadata, 0, arg.Arg.EphemeralLifetime, arg.Arg.CallerPreview)
	if err != nil {
		return res, err
	}
	if msgID == nil {
		return res, errors.New("no message ID returned from post")
	}
	return chat1.PostLocalRes{
		MessageID:        *msgID,
		IdentifyFailures: identBreaks,
	}, nil
}

// DownloadAttachmentLocal implements chat1.LocalInterface.DownloadAttachmentLocal.
func (h *Server) DownloadAttachmentLocal(ctx context.Context, arg chat1.DownloadAttachmentLocalArg) (res chat1.DownloadAttachmentLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "DownloadAttachmentLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if arg.MessageID == 0 {
		return res, errors.New("invalid message ID provided")
	}
	darg := downloadAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		MessageID:        arg.MessageID,
		Preview:          arg.Preview,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	cli := h.getStreamUICli()
	darg.Sink = libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)

	return h.downloadAttachmentLocal(ctx, uid, darg)
}

func (h *Server) getFileAttachmentDownloadDirs() (cacheDir, downloadDir string) {
	h.fileAttachmentDownloadConfigurationMu.RLock()
	defer h.fileAttachmentDownloadConfigurationMu.RUnlock()
	return h.fileAttachmentDownloadCacheDir, h.fileAttachmentDownloadDownloadDir
}

func (h *Server) ConfigureFileAttachmentDownloadLocal(ctx context.Context, arg chat1.ConfigureFileAttachmentDownloadLocalArg) (err error) {
	h.fileAttachmentDownloadConfigurationMu.Lock()
	defer h.fileAttachmentDownloadConfigurationMu.Unlock()
	h.fileAttachmentDownloadCacheDir, h.fileAttachmentDownloadDownloadDir = arg.CacheDirOverride, arg.DownloadDirOverride
	return nil
}

// DownloadFileAttachmentLocal implements chat1.LocalInterface.DownloadFileAttachmentLocal.
func (h *Server) DownloadFileAttachmentLocal(ctx context.Context, arg chat1.DownloadFileAttachmentLocalArg) (res chat1.DownloadFileAttachmentLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "DownloadFileAttachmentLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if arg.MessageID == 0 {
		return res, errors.New("invalid message ID provided")
	}
	darg := downloadAttachmentArg{
		SessionID:        arg.SessionID,
		ConversationID:   arg.ConversationID,
		MessageID:        arg.MessageID,
		Preview:          arg.Preview,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	cacheDir, downloadDir := h.getFileAttachmentDownloadDirs()
	downloadParentdir, useArbitraryName := downloadDir, false
	if arg.DownloadToCache {
		downloadParentdir, useArbitraryName = cacheDir, true
	}
	filePath, sink, err := attachments.SinkFromFilename(ctx, h.G(), uid,
		arg.ConversationID, arg.MessageID, downloadParentdir, useArbitraryName)
	if err != nil {
		return res, err
	}
	defer func() {
		// In the event of any error delete the file if it's empty.
		if err != nil {
			h.Debug(ctx, "DownloadFileAttachmentLocal: deleteFileIfEmpty: %v", deleteFileIfEmpty(filePath))
		}
	}()
	if err := attachments.Quarantine(ctx, filePath); err != nil {
		h.Debug(ctx, "DownloadFileAttachmentLocal: failed to quarantine download: %s", err)
		return res, err
	}
	darg.Sink = sink
	ires, err := h.downloadAttachmentLocal(ctx, uid, darg)
	if err != nil {
		return res, err
	}
	return chat1.DownloadFileAttachmentLocalRes{
		FilePath:         filePath,
		IdentifyFailures: ires.IdentifyFailures,
	}, nil
}

func deleteFileIfEmpty(filename string) (err error) {
	f, err := os.Stat(filename)
	if err != nil {
		return err
	}
	if f.Size() == 0 {
		return os.Remove(filename)
	}
	return nil
}

type downloadAttachmentArg struct {
	SessionID        int
	ConversationID   chat1.ConversationID
	MessageID        chat1.MessageID
	Sink             io.WriteCloser
	Preview          bool
	IdentifyBehavior keybase1.TLFIdentifyBehavior
}

func (h *Server) downloadAttachmentLocal(ctx context.Context, uid gregor1.UID, arg downloadAttachmentArg) (res chat1.DownloadAttachmentLocalRes, err error) {

	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	progress := func(bytesComplete, bytesTotal int64) {
		h.G().NotifyRouter.HandleChatAttachmentDownloadProgress(ctx, keybase1.UID(uid.String()),
			arg.ConversationID, arg.MessageID, bytesComplete, bytesTotal)
	}

	h.Debug(ctx, "downloadAttachmentLocal: fetching asset from attachment message: convID: %s messageID: %d",
		arg.ConversationID, arg.MessageID)

	err = attachments.Download(ctx, h.G(), uid, arg.ConversationID,
		arg.MessageID, arg.Sink, arg.Preview, progress, h.remoteClient)
	if err != nil {
		return res, err
	}
	h.G().NotifyRouter.HandleChatAttachmentDownloadComplete(ctx, keybase1.UID(uid.String()),
		arg.ConversationID, arg.MessageID)

	return chat1.DownloadAttachmentLocalRes{
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) presentUIItem(ctx context.Context, uid gregor1.UID, conv *chat1.ConversationLocal,
	partMode utils.PresentParticipantsMode) (res *chat1.InboxUIItem) {
	if conv != nil {
		pc := utils.PresentConversationLocal(ctx, h.G(), uid, *conv, partMode)
		res = &pc
	}
	return res
}

func (h *Server) CancelPost(ctx context.Context, outboxID chat1.OutboxID) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "CancelPost(%s)", outboxID)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	outbox := storage.NewOutbox(h.G(), uid)
	obr, err := outbox.RemoveMessage(ctx, outboxID)
	if err != nil {
		return err
	}
	// Alert the attachment uploader as well, in case this outboxID corresponds to an attachment upload
	if err := h.G().AttachmentUploader.Cancel(ctx, outboxID); err != nil {
		return err
	}
	convLocal, err := h.G().InboxSource.IncrementLocalConvVersion(ctx, uid, obr.ConvID)
	if err != nil {
		h.Debug(ctx, "CancelPost: failed to get IncrementLocalConvVersion")
	}
	act := chat1.NewChatActivityWithFailedMessage(chat1.FailedMessageInfo{
		OutboxRecords: []chat1.OutboxRecord{obr},
		Conv:          h.presentUIItem(ctx, uid, convLocal, utils.PresentParticipantsModeSkip),
	})
	h.G().ActivityNotifier.Activity(context.Background(), uid, chat1.TopicType_NONE, &act,
		chat1.ChatActivitySource_LOCAL)
	return h.G().Badger.Send(ctx)
}

func (h *Server) RetryPost(ctx context.Context, arg chat1.RetryPostArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("RetryPost: obr: %v", arg.OutboxID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	// Mark as retry in the outbox
	outbox := storage.NewOutbox(h.G(), uid)
	obr, err := outbox.RetryMessage(ctx, arg.OutboxID, arg.IdentifyBehavior)
	if err != nil {
		return err
	} else if obr == nil {
		return nil
	}
	if obr.IsAttachment() {
		if _, err := h.G().AttachmentUploader.Retry(ctx, obr.OutboxID); err != nil {
			h.Debug(ctx, "RetryPost: failed to retry attachment upload: %s", err)
		}
	}

	// Force the send loop to try again
	h.G().MessageDeliverer.ForceDeliverLoop(ctx)

	return nil
}

// remoteClient returns a client connection to gregord.
func (h *Server) remoteClient() chat1.RemoteInterface {
	if h.rc != nil {
		return h.rc
	}
	return h.serverConn.GetClient()
}

func (h *Server) setTestRemoteClient(ri chat1.RemoteInterface) {
	h.rc = ri
}

func (h *Server) FindGeneralConvFromTeamID(ctx context.Context, teamID keybase1.TeamID) (res chat1.InboxUIItem, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, &err, "FindGeneralConvFromTeamID")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	tlfID, err := chat1.TeamIDToTLFID(teamID)
	if err != nil {
		return res, err
	}
	vis := keybase1.TLFVisibility_PRIVATE
	topicName := globals.DefaultTeamTopic
	topicType := chat1.TopicType_CHAT
	query := &chat1.GetInboxLocalQuery{
		Name: &chat1.NameQuery{
			TlfID:       &tlfID,
			MembersType: chat1.ConversationMembersType_TEAM,
		},
		TlfVisibility: &vis,
		TopicName:     &topicName,
		TopicType:     &topicType,
	}
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, query)
	if err != nil {
		return res, err
	}
	if len(ib.Convs) != 1 {
		return res, libkb.NotFoundError{}
	}
	return utils.PresentConversationLocal(ctx, h.G(), uid, ib.Convs[0], utils.PresentParticipantsModeSkip),
		nil
}

func (h *Server) FindConversationsLocal(ctx context.Context,
	arg chat1.FindConversationsLocalArg) (res chat1.FindConversationsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "FindConversationsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	res.Conversations, err = FindConversations(ctx, h.G(), h.DebugLabeler,
		types.InboxSourceDataSourceAll, h.remoteClient,
		uid, arg.TlfName, arg.TopicType, arg.MembersType, arg.Visibility, arg.TopicName, arg.OneChatPerTLF)
	if err != nil {
		return res, err
	}
	res.UiConversations = utils.PresentConversationLocals(ctx, h.G(), uid, res.Conversations,
		utils.PresentParticipantsModeInclude)
	return res, nil
}

func (h *Server) UpdateUnsentText(ctx context.Context, arg chat1.UpdateUnsentTextArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err,
		fmt.Sprintf("UpdateUnsentText convID: %s", arg.ConversationID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		h.Debug(ctx, "UpdateUnsentText: not logged in: %s", err)
		return nil
	}

	// Save draft
	var draftText *string
	if len(arg.Text) > 0 {
		draftText = &arg.Text
	}
	if err := h.G().InboxSource.Draft(ctx, uid, arg.ConversationID, draftText); err != nil {
		h.Debug(ctx, "UpdateUnsentText: failed to save draft: %s", err)
	}

	// Attempt to prefetch any unfurls in the background that are in the message text
	go h.G().Unfurler.Prefetch(globals.BackgroundChatCtx(ctx, h.G()), uid, arg.ConversationID, arg.Text)

	// Preview any slash commands in the text
	go h.G().CommandsSource.PreviewBuiltinCommand(globals.BackgroundChatCtx(ctx, h.G()), uid,
		arg.ConversationID, arg.TlfName, arg.Text)

	return nil
}

func (h *Server) UpdateTyping(ctx context.Context, arg chat1.UpdateTypingArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err,
		fmt.Sprintf("UpdateTyping convID: %s", arg.ConversationID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		h.Debug(ctx, "UpdateTyping: not logged in: %s", err)
		return nil
	}
	// Just bail out if we are offline
	if !h.G().Syncer.IsConnected(ctx) {
		return nil
	}
	deviceID := make([]byte, libkb.DeviceIDLen)
	if err := h.G().Env.GetDeviceID().ToBytes(deviceID); err != nil {
		h.Debug(ctx, "UpdateTyping: failed to get device: %s", err)
		return nil
	}
	if err := h.remoteClient().UpdateTypingRemote(ctx, chat1.UpdateTypingRemoteArg{
		Uid:      uid,
		DeviceID: deviceID,
		ConvID:   arg.ConversationID,
		Typing:   arg.Typing,
	}); err != nil {
		h.Debug(ctx, "UpdateTyping: failed to hit the server: %s", err.Error())
	}
	return nil
}

func (h *Server) JoinConversationByIDLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("JoinConversationByIDLocal: convID: %s", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "JoinConversationByIDLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	err = JoinConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) JoinConversationLocal(ctx context.Context, arg chat1.JoinConversationLocalArg) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("JoinConversation(%s)",
		arg.TopicName))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "JoinConversationLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if err = JoinConversationByName(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, arg.TlfName,
		arg.TopicName, arg.TopicType, arg.Visibility); err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) LeaveConversationLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.JoinLeaveConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("LeaveConversation(%s)", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "LeaveConversationLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	err = LeaveConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) PreviewConversationByIDLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.PreviewConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("PreviewConversationByIDLocal: convID: %s", convID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "PreviewConversationByIDLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	conv, err := PreviewConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, uid, convID)
	if err != nil {
		return res, err
	}
	res.Conv = utils.PresentConversationLocal(ctx, h.G(), uid, conv, utils.PresentParticipantsModeInclude)
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) DeleteConversationLocal(ctx context.Context, arg chat1.DeleteConversationLocalArg) (res chat1.DeleteConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("DeleteConversation(%s)", arg.ConvID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "DeleteConversationLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	ui := h.getChatUI(arg.SessionID)
	confirmed := arg.Confirmed
	if !confirmed {
		confirmed, err = ui.ChatConfirmChannelDelete(ctx, chat1.ChatConfirmChannelDeleteArg{
			SessionID: arg.SessionID,
			Channel:   arg.ChannelName,
		})
		if err != nil {
			return res, err
		}
	}
	if !confirmed {
		return res, errors.New("channel delete unconfirmed")
	}
	if err := h.G().InboxSource.RemoteDeleteConversation(ctx, uid, arg.ConvID); err != nil {
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) RemoveFromConversationLocal(ctx context.Context, arg chat1.RemoveFromConversationLocalArg) (res chat1.RemoveFromConversationLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("RemoveFromConversation(%s)", arg.ConvID))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}
	err = RemoveFromConversation(ctx, h.G(), h.DebugLabeler, h.remoteClient, arg.ConvID, arg.Usernames)
	if err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) GetTLFConversationsLocal(ctx context.Context, arg chat1.GetTLFConversationsLocalArg) (res chat1.GetTLFConversationsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("GetTLFConversationsLocal(%s)",
		arg.TlfName))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetTLFConversationsLocal: result obtained offline")
		}
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	// Fetch the TLF ID from specified name
	nameInfo, err := CreateNameInfoSource(ctx, h.G(), arg.MembersType).LookupID(ctx, arg.TlfName, false)
	if err != nil {
		h.Debug(ctx, "GetTLFConversationsLocal: failed to get TLFID from name: %v", err)
		return res, err
	}

	var convs []chat1.ConversationLocal
	convs, err = h.G().TeamChannelSource.GetChannelsFull(ctx, uid, nameInfo.ID, arg.TopicType)
	if err != nil {
		return res, err
	}
	res.Convs = utils.PresentConversationLocals(ctx, h.G(), uid, convs, utils.PresentParticipantsModeInclude)
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) GetChannelMembershipsLocal(ctx context.Context, arg chat1.GetChannelMembershipsLocalArg) (res chat1.GetChannelMembershipsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "GetTLFConversationsLocal: result obtained offline")
		}
	}()
	myUID, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return chat1.GetChannelMembershipsLocalRes{}, err
	}

	chatTopicType := chat1.TopicType_CHAT
	tlfID := chat1.TLFID(arg.TeamID.ToBytes())

	// fetch all conversations in the supplied team
	inbox, err := h.G().InboxSource.ReadUnverified(ctx, myUID, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQuery{
			TlfID:        &tlfID,
			MembersTypes: []chat1.ConversationMembersType{chat1.ConversationMembersType_TEAM},
			TopicType:    &chatTopicType,
		})
	if err != nil {
		return res, err
	}

	// find a list of conversations that the provided uid is a member of
	var memberConvs []types.RemoteConversation
	for _, conv := range inbox.ConvsUnverified {
		uids, err := h.G().ParticipantsSource.Get(ctx, myUID, conv.GetConvID(),
			types.InboxSourceDataSourceAll)
		if err != nil {
			return res, err
		}
		for _, uid := range uids {
			if bytes.Equal(uid, arg.Uid) {
				memberConvs = append(memberConvs, conv)
				break
			}
		}
	}

	// localize those conversations so we can get the topic name
	convsLocal, _, err := h.G().InboxSource.Localize(ctx, myUID, memberConvs,
		types.ConversationLocalizerBlocking)
	for _, conv := range convsLocal {
		res.Channels = append(res.Channels, chat1.ChannelNameMention{
			ConvID:    conv.GetConvID(),
			TopicName: conv.GetTopicName(),
		})
	}
	return res, nil
}

func (h *Server) SetAppNotificationSettingsLocal(ctx context.Context,
	arg chat1.SetAppNotificationSettingsLocalArg) (res chat1.SetAppNotificationSettingsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("SetAppNotificationSettings(%s)",
		arg.ConvID))()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		if res.Offline {
			h.Debug(ctx, "SetAppNotificationSettingsLocal: result obtained offline")
		}
	}()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}

	var nsettings chat1.ConversationNotificationInfo
	nsettings.ChannelWide = arg.ChannelWide
	nsettings.Settings = make(map[keybase1.DeviceType]map[chat1.NotificationKind]bool)
	nsettings.Settings[keybase1.DeviceType_MOBILE] = make(map[chat1.NotificationKind]bool)
	nsettings.Settings[keybase1.DeviceType_DESKTOP] = make(map[chat1.NotificationKind]bool)
	for _, setting := range arg.Settings {
		nsettings.Settings[setting.DeviceType][setting.Kind] = setting.Enabled
	}
	_, err = h.remoteClient().SetAppNotificationSettings(ctx, chat1.SetAppNotificationSettingsArg{
		ConvID:   arg.ConvID,
		Settings: nsettings,
	})
	if err != nil {
		h.Debug(ctx, "SetAppNotificationSettings: failed to post to remote: %s", err.Error())
		return res, err
	}
	res.Offline = h.G().InboxSource.IsOffline(ctx)
	return res, nil
}

func (h *Server) UnboxMobilePushNotification(ctx context.Context, arg chat1.UnboxMobilePushNotificationArg) (res string, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("UnboxMobilePushNotification(%s)",
		arg.ConvID))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return "", err
	}
	bConvID, err := hex.DecodeString(arg.ConvID)
	if err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: invalid convID: %s msg: %s", arg.ConvID, err.Error())
		return "", err
	}
	convID := chat1.ConversationID(bConvID)
	mp := NewMobilePush(h.G())
	msg, err := mp.UnboxPushNotification(ctx, uid, convID, arg.MembersType, arg.Payload)
	if err != nil {
		return "", err
	}
	if _, err := utils.GetVerifiedConv(ctx, h.G(), uid, convID, types.InboxSourceDataSourceAll); err != nil {
		return "", err
	}
	if arg.ShouldAck {
		mp.AckNotificationSuccess(ctx, arg.PushIDs)
	}

	if msg.IsValid() {
		body := msg.Valid().MessageBody
		bodyTyp, err := body.MessageType()
		if err != nil {
			return "", err
		}
		if bodyTyp == chat1.MessageType_TEXT {
			return body.Text().Body, nil
		}
	}
	return res, nil
}

func (h *Server) SetGlobalAppNotificationSettingsLocal(ctx context.Context,
	strSettings map[string]bool) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "SetGlobalAppNotificationSettings")()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return err
	}
	return setGlobalAppNotificationSettings(ctx, h.G(), h.remoteClient, strSettings)
}

func (h *Server) GetGlobalAppNotificationSettingsLocal(ctx context.Context) (res chat1.GlobalAppNotificationSettings, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetGlobalAppNotificationSettings")()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}
	return getGlobalAppNotificationSettings(ctx, h.G(), h.remoteClient)
}

func (h *Server) AddTeamMemberAfterReset(ctx context.Context,
	arg chat1.AddTeamMemberAfterResetArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "AddTeamMemberAfterReset")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	// Lookup conversation to get team ID
	iboxRes, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{arg.ConvID},
		})
	if err != nil {
		return err
	}
	if len(iboxRes.Convs) != 1 {
		return errors.New("failed to find conversation to add reset user back into")
	}
	var teamID keybase1.TeamID
	conv := iboxRes.Convs[0]
	switch conv.Info.MembersType {
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		team, err := NewTeamLoader(h.G().ExternalG()).loadTeam(ctx, conv.Info.Triple.Tlfid, conv.Info.TlfName,
			conv.Info.MembersType, conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC, nil)
		if err != nil {
			return err
		}
		teamID = team.ID
	case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_TEAM:
		teamID = keybase1.TeamID(conv.Info.Triple.Tlfid.String())
	default:
		return fmt.Errorf("unable to add member back to non team conversation: %v",
			conv.Info.MembersType)
	}
	return teams.ReAddMemberAfterReset(ctx, h.G().ExternalG(), teamID, arg.Username)
}

func (h *Server) GetAllResetConvMembers(ctx context.Context) (res chat1.GetAllResetConvMembersRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetAllResetConvMembers")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	if _, err := utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}
	resetConvs, err := h.remoteClient().GetResetConversations(ctx)
	if err != nil {
		return res, err
	}
	for _, resetMember := range resetConvs.ResetConvs {
		username, err := h.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(resetMember.Uid.String()))
		if err != nil {
			return res, err
		}
		res.Members = append(res.Members, chat1.ResetConvMember{
			Uid:      resetMember.Uid,
			Conv:     resetMember.ConvID,
			Username: username.String(),
		})
	}
	return res, nil
}

func (h *Server) SetConvRetentionLocal(ctx context.Context, arg chat1.SetConvRetentionLocalArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "SetConvRetentionLocal(%v, %v)", arg.ConvID,
		arg.Policy.Summary())()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	// short circuit if the policy is unchanged.
	policy := arg.Policy
	conv, err := utils.GetVerifiedConv(ctx, h.G(), uid, arg.ConvID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	if convRetention := conv.ConvRetention; convRetention != nil && policy.Eq(*convRetention) {
		h.Debug(ctx, "retention policy unchanged, skipping update")
		return nil
	}

	if _, err = h.remoteClient().SetConvRetention(ctx, chat1.SetConvRetentionArg{
		ConvID: arg.ConvID,
		Policy: policy,
	}); err != nil {
		return err
	}

	// Post a SYSTEM message to conversation about the change. If we're
	// inheriting the team policy, fetch that for the message.
	isInherit := false
	typ, err := policy.Typ()
	if err != nil {
		return err
	}
	switch typ {
	case chat1.RetentionPolicyType_INHERIT:
		isInherit = true
	default:
		// Nothing to do for other policy types.
	}

	if isInherit {
		teamRetention := conv.TeamRetention
		if teamRetention == nil {
			policy = chat1.RetentionPolicy{}
		} else {
			policy = *teamRetention
		}
	}
	username := h.G().Env.GetUsername()
	subBody := chat1.NewMessageSystemWithChangeretention(chat1.MessageSystemChangeRetention{
		User:        username.String(),
		IsTeam:      false,
		IsInherit:   isInherit,
		MembersType: conv.GetMembersType(),
		Policy:      policy,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)
	return h.G().ChatHelper.SendMsgByID(ctx, arg.ConvID, conv.Info.TlfName, body, chat1.MessageType_SYSTEM,
		conv.Info.Visibility)
}

func (h *Server) SetTeamRetentionLocal(ctx context.Context, arg chat1.SetTeamRetentionLocalArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "SetTeamRetentionLocal(%v, %v)", arg.TeamID, arg.Policy.Summary())()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return err
	}
	teamRetention, err := h.GetTeamRetentionLocal(ctx, arg.TeamID)
	if err != nil {
		return err
	}
	policy := arg.Policy
	if teamRetention != nil && policy.Eq(*teamRetention) {
		h.Debug(ctx, "retention policy unchanged, skipping update")
		return nil
	}

	if _, err = h.remoteClient().SetTeamRetention(ctx, chat1.SetTeamRetentionArg{
		TeamID: arg.TeamID,
		Policy: policy,
	}); err != nil {
		return err
	}

	// Post a SYSTEM message to the #general channel about the change.
	tlfID, err := chat1.MakeTLFID(arg.TeamID.String())
	if err != nil {
		return err
	}
	username := h.G().Env.GetUsername()
	subBody := chat1.NewMessageSystemWithChangeretention(chat1.MessageSystemChangeRetention{
		User:        username.String(),
		IsTeam:      true,
		IsInherit:   false,
		MembersType: chat1.ConversationMembersType_TEAM,
		Policy:      arg.Policy,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)
	info, err := CreateNameInfoSource(ctx, h.G(), chat1.ConversationMembersType_TEAM).LookupName(ctx, tlfID,
		false, "")
	if err != nil {
		return err
	}
	return h.G().ChatHelper.SendMsgByName(ctx, info.CanonicalName, &globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM)
}

func (h *Server) GetTeamRetentionLocal(ctx context.Context, teamID keybase1.TeamID) (res *chat1.RetentionPolicy, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetTeamRetentionLocal(%s)", teamID)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	tlfID, err := chat1.MakeTLFID(teamID.String())
	if err != nil {
		return res, err
	}
	ib, err := h.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQuery{
			TlfID: &tlfID,
		})
	if err != nil {
		return res, err
	}
	if len(ib.ConvsUnverified) == 0 {
		return res, errors.New("no conversations found")
	}
	return ib.ConvsUnverified[0].Conv.TeamRetention, nil
}

func (h *Server) SetConvMinWriterRoleLocal(ctx context.Context, arg chat1.SetConvMinWriterRoleLocalArg) (err error) {
	defer h.Trace(ctx, &err, "SetConvMinWriterRole(%v, %v)", arg.ConvID, arg.Role)()
	_, err = h.remoteClient().SetConvMinWriterRole(ctx, chat1.SetConvMinWriterRoleArg(arg))
	return err
}

func (h *Server) UpgradeKBFSConversationToImpteam(ctx context.Context, convID chat1.ConversationID) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "UpgradeKBFSConversationToImpteam(%s)", convID)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	ibox, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		})
	if err != nil {
		return err
	}
	if len(ibox.Convs) == 0 {
		return errors.New("no conversation found")
	}
	conv := ibox.Convs[0]
	if conv.GetMembersType() != chat1.ConversationMembersType_KBFS {
		return fmt.Errorf("cannot upgrade %v conversation", conv.GetMembersType())
	}
	tlfID := conv.Info.Triple.Tlfid
	tlfName := conv.Info.TlfName
	public := conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC
	return h.G().ChatHelper.UpgradeKBFSToImpteam(ctx, tlfName, tlfID, public)
}

func (h *Server) cancelActiveSearchLocked() {
	if h.searchCancelFn != nil {
		h.searchCancelFn()
		h.searchCancelFn = nil
	}
}

func (h *Server) getSearchContext(ctx context.Context) context.Context {
	// enforce a single search happening at a time
	h.searchMu.Lock()
	h.cancelActiveSearchLocked()
	ctx, h.searchCancelFn = context.WithCancel(ctx)
	h.searchMu.Unlock()
	return ctx
}

func (h *Server) CancelActiveSearch(ctx context.Context) (err error) {
	defer h.Trace(ctx, &err, "CancelActiveSearch")()
	h.searchMu.Lock()
	h.cancelActiveSearchLocked()
	h.searchMu.Unlock()
	return nil
}

func (h *Server) getSearchRegexp(query string, opts chat1.SearchOpts) (re *regexp.Regexp, err error) {
	if opts.IsRegex {
		re, err = regexp.Compile(query)
	} else {
		// String queries are set case insensitive
		re, err = utils.GetQueryRe(query)
	}
	if err != nil {
		return nil, err
	}
	return re, nil
}

func (h *Server) SearchRegexp(ctx context.Context, arg chat1.SearchRegexpArg) (res chat1.SearchRegexpRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "SearchRegexp")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	ctx = h.getSearchContext(ctx)

	query, opts := search.UpgradeSearchOptsFromQuery(arg.Query, arg.Opts,
		h.G().GetEnv().GetUsername().String())
	re, err := h.getSearchRegexp(query, opts)
	if err != nil {
		return res, err
	}

	chatUI := h.getChatUI(arg.SessionID)
	uiCh := make(chan chat1.ChatSearchHit, 10)
	ch := make(chan struct{})
	go func() {
		for searchHit := range uiCh {
			select {
			case <-ctx.Done():
				return
			default:
				_ = chatUI.ChatSearchHit(ctx, chat1.ChatSearchHitArg{
					SearchHit: searchHit,
				})
			}
		}
		close(ch)
	}()
	hits, _, err := h.G().RegexpSearcher.Search(ctx, uid, arg.ConvID, re, uiCh, opts)
	if err != nil {
		return res, err
	}

	<-ch
	_ = chatUI.ChatSearchDone(ctx, chat1.ChatSearchDoneArg{
		NumHits: len(hits),
	})
	return chat1.SearchRegexpRes{
		Hits:             hits,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) cancelActiveInboxSearchLocked() {
	if h.searchInboxCancelFn != nil {
		h.searchInboxCancelFn()
		h.searchInboxCancelFn = nil
	}
}

func (h *Server) getInboxSearchContext(ctx context.Context) context.Context {
	// enforce a single search happening at a time
	h.searchInboxMu.Lock()
	h.cancelActiveInboxSearchLocked()
	ctx, h.searchInboxCancelFn = context.WithCancel(ctx)
	h.searchInboxMu.Unlock()
	return ctx
}

func (h *Server) CancelActiveInboxSearch(ctx context.Context) (err error) {
	defer h.Trace(ctx, &err, "CancelActiveInboxSearch")()
	h.searchInboxMu.Lock()
	h.cancelActiveInboxSearchLocked()
	h.searchInboxMu.Unlock()
	return nil
}

func (h *Server) delegateInboxSearch(ctx context.Context, uid gregor1.UID, query, origQuery string,
	opts chat1.SearchOpts, ui libkb.ChatUI) (res chat1.ChatSearchInboxResults, err error) {
	defer h.Trace(ctx, &err, "delegateInboxSearch")()
	convs, err := h.G().Indexer.SearchableConvs(ctx, opts.ConvID)
	if err != nil {
		return res, err
	}
	re, err := h.getSearchRegexp(query, opts)
	if err != nil {
		return res, err
	}
	select {
	case <-ctx.Done():
		return res, ctx.Err()
	default:
		_ = ui.ChatSearchConvHits(ctx, chat1.UIChatSearchConvHits{})
	}
	var numHits, numConvs int
	for index, conv := range convs {
		uiCh := make(chan chat1.ChatSearchHit, 10)
		ch := make(chan struct{})
		go func() {
			for searchHit := range uiCh {
				select {
				case <-ctx.Done():
					return
				default:
					_ = ui.ChatSearchHit(ctx, chat1.ChatSearchHitArg{
						SearchHit: searchHit,
					})
				}
			}
			close(ch)
		}()
		hits, _, err := h.G().RegexpSearcher.Search(ctx, uid, conv.GetConvID(), re, uiCh, opts)
		if err != nil {
			h.Debug(ctx, "delegateInboxSearch: failed to search conv: %s", err)
			continue
		}
		<-ch
		if len(hits) == 0 {
			continue
		}
		numHits += len(hits)
		numConvs++
		inboxHit := chat1.ChatSearchInboxHit{
			ConvID:   conv.GetConvID(),
			TeamType: conv.GetTeamType(),
			ConvName: utils.GetRemoteConvDisplayName(conv),
			Query:    origQuery,
			Time:     hits[0].HitMessage.Valid().Ctime,
			Hits:     hits,
		}
		select {
		case <-ctx.Done():
			return res, ctx.Err()
		default:
			_ = ui.ChatSearchInboxHit(ctx, chat1.ChatSearchInboxHitArg{
				SearchHit: inboxHit,
			})
		}
		res.Hits = append(res.Hits, inboxHit)
		if opts.MaxConvsHit > 0 && len(res.Hits) > opts.MaxConvsHit {
			break
		}
		if opts.MaxConvsSearched > 0 && index > opts.MaxConvsSearched {
			break
		}
	}

	select {
	case <-ctx.Done():
		return res, ctx.Err()
	default:
		_ = ui.ChatSearchInboxDone(ctx, chat1.ChatSearchInboxDoneArg{
			Res: chat1.ChatSearchInboxDone{
				NumHits:   numHits,
				NumConvs:  numConvs,
				Delegated: true,
			},
		})
	}
	return res, nil
}

func (h *Server) SearchInbox(ctx context.Context, arg chat1.SearchInboxArg) (res chat1.SearchInboxRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "SearchInbox")()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer h.suspendBgConvLoads(ctx)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	chatUI := h.getChatUI(arg.SessionID)
	select {
	case <-ctx.Done():
		return res, ctx.Err()
	default:
		_ = chatUI.ChatSearchInboxStart(ctx)
	}

	username := h.G().GetEnv().GetUsernameForUID(keybase1.UID(uid.String())).String()
	query, opts := search.UpgradeSearchOptsFromQuery(arg.Query, arg.Opts, username)
	doSearch := !arg.NamesOnly && len(query) > 0
	forceDelegate := false
	if arg.Opts.ConvID != nil {
		fullyIndexed, err := h.G().Indexer.FullyIndexed(ctx, *arg.Opts.ConvID)
		if err != nil {
			h.Debug(ctx, "SearchInbox: failed to check fully indexed, delegating... err: %s", err)
			forceDelegate = true
		} else {
			forceDelegate = !fullyIndexed
		}
		if len(query) < search.MinTokenLength {
			forceDelegate = true
		}
		if forceDelegate {
			h.Debug(ctx, "SearchInbox: force delegating since not indexed")
		}
		ctx = h.getSearchContext(ctx)
	} else {
		ctx = h.getInboxSearchContext(ctx)
	}

	if doSearch && (opts.IsRegex || forceDelegate) {
		inboxRes, err := h.delegateInboxSearch(ctx, uid, query, arg.Query, opts, chatUI)
		if err != nil {
			return res, err
		}
		res.Res = &inboxRes
		res.IdentifyFailures = identBreaks
		return res, nil
	}
	eg := errgroup.Group{}

	// stream hits back to client UI
	hitUICh := make(chan chat1.ChatSearchInboxHit, 10)
	var numHits int
	eg.Go(func() error {
		if !doSearch {
			return nil
		}
		for searchHit := range hitUICh {
			numHits += len(searchHit.Hits)
			select {
			case <-ctx.Done():
				return nil
			default:
				_ = chatUI.ChatSearchInboxHit(ctx, chat1.ChatSearchInboxHitArg{
					SearchHit: searchHit,
				})
			}
		}
		return nil
	})

	// stream index status back to client UI
	indexUICh := make(chan chat1.ChatSearchIndexStatus, 10)
	eg.Go(func() error {
		if !doSearch {
			return nil
		}
		for status := range indexUICh {
			select {
			case <-ctx.Done():
				return nil
			default:
				_ = chatUI.ChatSearchIndexStatus(ctx, chat1.ChatSearchIndexStatusArg{
					Status: status,
				})
			}
		}
		return nil
	})

	// send up conversation name matches
	eg.Go(func() error {
		if opts.MaxNameConvs == 0 {
			return nil
		}
		convHits, err := h.G().InboxSource.Search(ctx, uid, query, opts.MaxNameConvs,
			types.InboxSourceSearchEmptyModeUnread)
		if err != nil {
			h.Debug(ctx, "SearchInbox: failed to get conv hits: %s", err)
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			_ = chatUI.ChatSearchConvHits(ctx, chat1.UIChatSearchConvHits{
				Hits:          utils.PresentRemoteConversationsAsSearchHits(convHits, username),
				UnreadMatches: len(query) == 0,
			})
		}
		return nil
	})

	// send up team name matches
	g := h.G().ExternalG()
	mctx := libkb.NewMetaContext(ctx, g)
	eg.Go(func() error {
		if opts.MaxTeams == 0 {
			return nil
		}
		hits, err := opensearch.Local(mctx, query,
			opts.MaxTeams)
		if err != nil {
			h.Debug(ctx, "SearchInbox: failed to get team hits: %s", err)
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		default:
			_ = chatUI.ChatSearchTeamHits(ctx, chat1.UIChatSearchTeamHits{
				Hits:             hits,
				SuggestedMatches: len(query) == 0,
			})
		}
		return nil
	})

	eg.Go(func() error {
		hits, err := teambot.NewFeaturedBotLoader(g).SearchLocal(
			mctx, keybase1.SearchLocalArg{
				Query:     query,
				Limit:     opts.MaxBots,
				SkipCache: opts.SkipBotCache,
			})
		if err != nil {
			h.Debug(ctx, "SearchInbox: failed to get bot hits: %s", err)
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		default:
			_ = chatUI.ChatSearchBotHits(ctx, chat1.UIChatSearchBotHits{
				Hits:             hits.Bots,
				SuggestedMatches: len(query) == 0,
			})
		}
		return nil
	})

	var searchRes *chat1.ChatSearchInboxResults
	if doSearch {
		select {
		case <-time.After(50 * time.Millisecond):
		case <-ctx.Done():
			return
		}
		if searchRes, err = h.G().Indexer.Search(ctx, query, arg.Query, opts, hitUICh, indexUICh); err != nil {
			return res, err
		}
	}

	if err := eg.Wait(); err != nil {
		h.Debug(ctx, "unable to wait for search: %v")
	}

	var doneRes chat1.ChatSearchInboxDone
	if searchRes != nil {
		doneRes = chat1.ChatSearchInboxDone{
			NumHits:        numHits,
			NumConvs:       len(searchRes.Hits),
			PercentIndexed: searchRes.PercentIndexed,
		}
	}
	select {
	case <-ctx.Done():
		return res, ctx.Err()
	default:
		_ = chatUI.ChatSearchInboxDone(ctx, chat1.ChatSearchInboxDoneArg{
			Res: doneRes,
		})
	}
	return chat1.SearchInboxRes{
		Res:              searchRes,
		IdentifyFailures: identBreaks,
	}, nil
}

func (h *Server) ProfileChatSearch(ctx context.Context, identifyBehavior keybase1.TLFIdentifyBehavior) (
	res map[chat1.ConvIDStr]chat1.ProfileSearchConvStats, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), identifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "ProfileChatSearch")()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return nil, err
	}

	res, err = h.G().Indexer.IndexInbox(ctx)
	if err != nil {
		return nil, err
	}
	b, err := json.Marshal(res)
	if err != nil {
		return nil, err
	}
	h.Debug(ctx, "%s\n", string(b))
	return res, err
}

func (h *Server) GetStaticConfig(ctx context.Context) (res chat1.StaticConfig, err error) {
	defer h.Trace(ctx, &err, "GetStaticConfig")()
	return chat1.StaticConfig{
		DeletableByDeleteHistory: chat1.DeletableMessageTypesByDeleteHistory(),
		BuiltinCommands:          h.G().CommandsSource.GetBuiltins(ctx),
	}, nil
}

func (h *Server) ResolveUnfurlPrompt(ctx context.Context, arg chat1.ResolveUnfurlPromptArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	defer func() {
		// squash all errors coming out of here
		err = nil
	}()
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "ResolveUnfurlPrompt")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	fetchAndUnfurl := func() error {
		msgs, err := h.G().ConvSource.GetMessages(ctx, arg.ConvID, uid, []chat1.MessageID{arg.MsgID},
			nil, nil, true)
		if err != nil {
			return err
		}
		if len(msgs) != 1 {
			return errors.New("message not found")
		}
		h.G().Unfurler.UnfurlAndSend(ctx, uid, arg.ConvID, msgs[0])
		return nil
	}
	atyp, err := arg.Result.ActionType()
	if err != nil {
		return err
	}
	switch atyp {
	case chat1.UnfurlPromptAction_NOTNOW:
		// do nothing
	case chat1.UnfurlPromptAction_ACCEPT:
		if err = h.G().Unfurler.WhitelistAdd(ctx, uid, arg.Result.Accept()); err != nil {
			return fmt.Errorf("failed to add to whitelist, doing nothing: %s", err)
		}
		if err = fetchAndUnfurl(); err != nil {
			return fmt.Errorf("failed to fetch and unfurl: %s", err)
		}
	case chat1.UnfurlPromptAction_ONETIME:
		h.G().Unfurler.WhitelistAddExemption(ctx, uid,
			unfurl.NewSingleMessageWhitelistExemption(arg.ConvID, arg.MsgID, arg.Result.Onetime()))
		if err = fetchAndUnfurl(); err != nil {
			return fmt.Errorf("failed to fetch and unfurl: %s", err)
		}
	case chat1.UnfurlPromptAction_NEVER:
		if err = h.G().Unfurler.SetMode(ctx, uid, chat1.UnfurlMode_NEVER); err != nil {
			return fmt.Errorf("failed to set mode to never: %s", err)
		}
	case chat1.UnfurlPromptAction_ALWAYS:
		if err = h.G().Unfurler.SetMode(ctx, uid, chat1.UnfurlMode_ALWAYS); err != nil {
			return fmt.Errorf("failed to set mode to always: %s", err)
		}
		if err = fetchAndUnfurl(); err != nil {
			return fmt.Errorf("failed to fetch and unfurl: %s", err)
		}
	}
	return nil
}

func (h *Server) GetUnfurlSettings(ctx context.Context) (res chat1.UnfurlSettingsDisplay, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetUnfurlSettings")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	settings, err := h.G().Unfurler.GetSettings(ctx, uid)
	if err != nil {
		return res, err
	}
	res.Mode = settings.Mode
	for w := range settings.Whitelist {
		res.Whitelist = append(res.Whitelist, w)
	}
	sort.Slice(res.Whitelist, func(i, j int) bool {
		return res.Whitelist[i] < res.Whitelist[j]
	})
	return res, nil
}

func (h *Server) SaveUnfurlSettings(ctx context.Context, arg chat1.SaveUnfurlSettingsArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "SaveUnfurlSettings")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	wm := make(map[string]bool)
	for _, w := range arg.Whitelist {
		wm[w] = true
	}
	return h.G().Unfurler.SetSettings(ctx, uid, chat1.UnfurlSettings{
		Mode:      arg.Mode,
		Whitelist: wm,
	})
}

func (h *Server) ToggleMessageCollapse(ctx context.Context, arg chat1.ToggleMessageCollapseArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "ToggleMessageCollapse convID=%s msgID=%d collapsed=%v",
		arg.ConvID, arg.MsgID, arg.Collapse)()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	if err := utils.NewCollapses(h.G()).ToggleSingle(ctx, uid, arg.ConvID, arg.MsgID, arg.Collapse); err != nil {
		return err
	}
	msg, err := h.G().ConvSource.GetMessage(ctx, arg.ConvID, uid, arg.MsgID, nil, nil, true)
	if err != nil {
		h.Debug(ctx, "ToggleMessageCollapse: failed to get message: %s", err)
		return nil
	}
	if !msg.IsValid() {
		h.Debug(ctx, "ToggleMessageCollapse: invalid message")
		return nil
	}
	if msg.Valid().MessageBody.IsType(chat1.MessageType_UNFURL) {
		unfurledMsg, err := h.G().ConvSource.GetMessage(ctx, arg.ConvID, uid,
			msg.Valid().MessageBody.Unfurl().MessageID, nil, nil, true)
		if err != nil {
			h.Debug(ctx, "ToggleMessageCollapse: failed to get unfurl base message: %s", err)
			return nil
		}
		// give a notification about the unfurled message
		notif := chat1.MessagesUpdated{
			ConvID:  arg.ConvID,
			Updates: []chat1.UIMessage{utils.PresentMessageUnboxed(ctx, h.G(), unfurledMsg, uid, arg.ConvID)},
		}
		act := chat1.NewChatActivityWithMessagesUpdated(notif)
		h.G().ActivityNotifier.Activity(ctx, uid, chat1.TopicType_CHAT,
			&act, chat1.ChatActivitySource_LOCAL)
	} else if msg.Valid().MessageBody.IsType(chat1.MessageType_ATTACHMENT) {
		notif := chat1.MessagesUpdated{
			ConvID:  arg.ConvID,
			Updates: []chat1.UIMessage{utils.PresentMessageUnboxed(ctx, h.G(), msg, uid, arg.ConvID)},
		}
		act := chat1.NewChatActivityWithMessagesUpdated(notif)
		h.G().ActivityNotifier.Activity(ctx, uid, chat1.TopicType_CHAT,
			&act, chat1.ChatActivitySource_LOCAL)
	}
	return nil
}

func (h *Server) BulkAddToConv(ctx context.Context, arg chat1.BulkAddToConvArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "BulkAddToConv: convID: %v, numUsers: %v", arg.ConvID, len(arg.Usernames))()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	return h.G().ChatHelper.BulkAddToConv(ctx, uid, arg.ConvID, arg.Usernames)
}

func (h *Server) BulkAddToManyConvs(ctx context.Context, arg chat1.BulkAddToManyConvsArg) (err error) {
	for _, convID := range arg.Conversations {
		if err = h.BulkAddToConv(ctx, chat1.BulkAddToConvArg{
			ConvID:    convID,
			Usernames: arg.Usernames,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (h *Server) PutReacjiSkinTone(ctx context.Context, skinTone keybase1.ReacjiSkinTone) (res keybase1.UserReacjis, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "PutReacjiSkinTone")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	store := storage.NewReacjiStore(h.G())
	err = store.PutSkinTone(ctx, uid, skinTone)
	if err != nil {
		return res, err
	}
	res = store.UserReacjis(ctx, uid)
	return res, nil
}

func (h *Server) ResolveMaybeMention(ctx context.Context, mention chat1.MaybeMention) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "ResolveMaybeMention")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	// Try to load as user
	if mention.Channel == "" {
		nn := libkb.NewNormalizedUsername(mention.Name)
		if _, err = h.G().GetUPAKLoader().LookupUID(ctx, nn); err != nil {
			h.Debug(ctx, "ResolveMaybeMention: not a user")
		} else {
			_ = h.getChatUI(0).ChatMaybeMentionUpdate(ctx, mention.Name, mention.Channel,
				chat1.NewUIMaybeMentionInfoWithUser())
			return nil
		}
	}
	// Try to load as team
	return h.G().TeamMentionLoader.LoadTeamMention(ctx, uid, mention, nil, true)
}

func (h *Server) getLoadGalleryContext(ctx context.Context) context.Context {
	// enforce a single search happening at a time
	h.loadGalleryMu.Lock()
	if h.loadGalleryCancelFn != nil {
		h.loadGalleryCancelFn()
		h.loadGalleryCancelFn = nil
	}
	ctx, h.loadGalleryCancelFn = context.WithCancel(ctx)
	h.loadGalleryMu.Unlock()
	return ctx
}

func (h *Server) LoadGallery(ctx context.Context, arg chat1.LoadGalleryArg) (res chat1.LoadGalleryRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "LoadGallery")()
	defer func() { err = h.squashSquashableErrors(err) }()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer h.suspendBgConvLoads(ctx)()

	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	ctx = h.getLoadGalleryContext(ctx)
	chatUI := h.getChatUI(arg.SessionID)
	convID := arg.ConvID
	var opts attachments.NextMessageOptions
	opts.BackInTime = true
	switch arg.Typ {
	case chat1.GalleryItemTyp_MEDIA:
		opts.MessageType = chat1.MessageType_ATTACHMENT
		opts.AssetTypes = []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE,
			chat1.AssetMetadataType_VIDEO}
	case chat1.GalleryItemTyp_LINK:
		opts.MessageType = chat1.MessageType_TEXT
		opts.FilterLinks = true
	case chat1.GalleryItemTyp_DOC:
		opts.MessageType = chat1.MessageType_ATTACHMENT
		opts.AssetTypes = []chat1.AssetMetadataType{chat1.AssetMetadataType_NONE}
	default:
		return res, errors.New("invalid gallery type")
	}
	var msgID chat1.MessageID
	if arg.FromMsgID != nil {
		msgID = *arg.FromMsgID
	} else {
		conv, err := utils.GetUnverifiedConv(ctx, h.G(), uid, convID, types.InboxSourceDataSourceAll)
		if err != nil {
			return res, err
		}
		msgID = conv.Conv.ReaderInfo.MaxMsgid + 1
	}

	hitCh := make(chan chat1.UIMessage)
	go func(ctx context.Context) {
		for msg := range hitCh {
			_ = chatUI.ChatLoadGalleryHit(ctx, msg)
		}
	}(ctx)
	gallery := attachments.NewGallery(h.G())
	msgs, last, err := gallery.NextMessages(ctx, uid, convID, msgID, arg.Num, opts, hitCh)
	if err != nil {
		return res, err
	}
	return chat1.LoadGalleryRes{
		Last:     last,
		Messages: utils.PresentMessagesUnboxed(ctx, h.G(), msgs, uid, convID),
	}, nil
}

func (h *Server) LoadFlip(ctx context.Context, arg chat1.LoadFlipArg) (res chat1.LoadFlipRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "LoadFlip")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	statusCh, errCh := h.G().CoinFlipManager.LoadFlip(ctx, uid, arg.HostConvID, arg.HostMsgID,
		arg.FlipConvID, arg.GameID)
	select {
	case status := <-statusCh:
		res.Status = status
	case err = <-errCh:
		return res, err
	}
	res.IdentifyFailures = identBreaks
	return res, nil
}

func (h *Server) LocationUpdate(ctx context.Context, coord chat1.Coordinate) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "LocationUpdate")()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	h.G().LiveLocationTracker.LocationUpdate(ctx, coord)
	return nil
}

func (h *Server) AdvertiseBotCommandsLocal(ctx context.Context, arg chat1.AdvertiseBotCommandsLocalArg) (res chat1.AdvertiseBotCommandsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "AdvertiseBotCommandsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if err := h.G().BotCommandManager.Advertise(ctx, arg.Alias, arg.Advertisements); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) ClearBotCommandsLocal(ctx context.Context, filter *chat1.ClearBotCommandsFilter) (res chat1.ClearBotCommandsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "ClearBotCommandsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if err := h.G().BotCommandManager.Clear(ctx, filter); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) ListPublicBotCommandsLocal(ctx context.Context, username string) (res chat1.ListBotCommandsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "ListPublicBotCommandsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	convID, err := h.G().BotCommandManager.PublicCommandsConv(ctx, username)
	if err != nil {
		if _, ok := err.(UnknownTLFNameError); ok {
			h.Debug(ctx, "ListPublicBotCommandsLocal: unknown conv name")
			return res, nil
		}
		return res, err
	}
	if convID == nil {
		return res, nil
	}
	return h.ListBotCommandsLocal(ctx, *convID)
}

func (h *Server) ListBotCommandsLocal(ctx context.Context, convID chat1.ConversationID) (res chat1.ListBotCommandsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "ListBotCommandsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	completeCh, err := h.G().BotCommandManager.UpdateCommands(ctx, convID, nil)
	if err != nil {
		return res, err
	}
	if err := <-completeCh; err != nil {
		h.Debug(ctx, "ListBotCommandsLocal: failed to update commands, list might be stale: %s", err)
	}
	lres, _, err := h.G().BotCommandManager.ListCommands(ctx, convID)
	if err != nil {
		return res, err
	}
	res.Commands = lres
	return res, nil
}

func (h *Server) GetMutualTeamsLocal(ctx context.Context, usernames []string) (res chat1.GetMutualTeamsLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "GetMutualTeamsLocal")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() { err = h.handleOfflineError(ctx, err, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	providedUIDs := make([]keybase1.UID, 0, len(usernames))
	for _, username := range usernames {
		providedUIDs = append(providedUIDs, libkb.GetUIDByUsername(h.G().GlobalContext, username))
	}

	// get all the default channels for all the teams you're in
	chatTopic := chat1.TopicType_CHAT
	inbox, err := h.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceLocalOnly,
		&chat1.GetInboxQuery{
			MembersTypes:     []chat1.ConversationMembersType{chat1.ConversationMembersType_TEAM},
			TopicName:        &globals.DefaultTeamTopic,
			TopicType:        &chatTopic,
			AllowUnseenQuery: true,
		})
	if err != nil {
		return res, err
	}

	// loop through convs
	var resLock sync.Mutex
	pipeliner := pipeliner.NewPipeliner(4)
	for _, conv := range inbox.ConvsUnverified {
		if conv.GetMembersType() != chat1.ConversationMembersType_TEAM {
			continue
		}
		if err := pipeliner.WaitForRoom(ctx); err != nil {
			return res, err
		}
		go func(conv types.RemoteConversation) {
			var err error
			userPresent := make(map[keybase1.UID]bool)
			for _, uid := range providedUIDs {
				userPresent[keybase1.UID(uid.String())] = false
			}
			members, err := h.G().ParticipantsSource.Get(ctx, uid, conv.GetConvID(),
				types.InboxSourceDataSourceAll)
			if err != nil {
				pipeliner.CompleteOne(err)
				return
			}
			for _, uid := range members {
				if _, exists := userPresent[keybase1.UID(uid.String())]; exists {
					// if we see a user in a team that we're looking for, mark that in the userPresent map
					userPresent[keybase1.UID(uid.String())] = true
				}
			}
			allOK := true
			for _, inTeam := range userPresent {
				if !inTeam {
					allOK = false
					break
				}
			}
			if allOK {
				resLock.Lock()
				res.TeamIDs = append(res.TeamIDs,
					keybase1.TeamID(conv.Conv.Metadata.IdTriple.Tlfid.String()))
				resLock.Unlock()
			}
			pipeliner.CompleteOne(nil)
		}(conv)
	}
	err = pipeliner.Flush(ctx)
	return res, err
}

func (h *Server) PinMessage(ctx context.Context, arg chat1.PinMessageArg) (res chat1.PinMessageRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "PinMessage")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	msg, err := h.G().ConvSource.GetMessage(ctx, arg.ConvID, uid, arg.MsgID, nil, nil, true)
	if err != nil {
		return res, err
	}
	if !msg.IsValid() {
		return res, fmt.Errorf("unable to pin message, message invalid")
	}
	bod := msg.Valid().MessageBody
	typ, err := bod.MessageType()
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.MessageType_TEXT,
		chat1.MessageType_ATTACHMENT:
	default:
		return res, fmt.Errorf("Unable to pin messageof type %v, expected %v or %v",
			typ, chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT)
	}
	if _, err := h.PostLocalNonblock(ctx, chat1.PostLocalNonblockArg{
		ConversationID: arg.ConvID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				MessageType: chat1.MessageType_PIN,
			},
			MessageBody: chat1.NewMessageBodyWithPin(chat1.MessagePin{
				MsgID: arg.MsgID,
			}),
		},
	}); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) UnpinMessage(ctx context.Context, convID chat1.ConversationID) (res chat1.PinMessageRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "UnpinMessage")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	conv, err := utils.GetVerifiedConv(ctx, h.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return res, err
	}
	pin, err := conv.GetMaxMessage(chat1.MessageType_PIN)
	if err != nil {
		return res, err
	}
	if _, err := h.PostLocal(ctx, chat1.PostLocalArg{
		ConversationID: convID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				MessageType: chat1.MessageType_DELETE,
				Supersedes:  pin.GetMessageID(),
			},
		},
	}); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) IgnorePinnedMessage(ctx context.Context, convID chat1.ConversationID) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "IgnorePinnedMessage")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	conv, err := utils.GetVerifiedConv(ctx, h.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	pin, err := conv.GetMaxMessage(chat1.MessageType_PIN)
	if err != nil {
		return err
	}
	if err := storage.NewPinIgnore(h.G(), uid).Ignore(ctx, convID, pin.GetMessageID()); err != nil {
		return err
	}
	h.G().InboxSource.NotifyUpdate(ctx, uid, convID)
	return nil
}

func (h *Server) validateBotRole(ctx context.Context, role keybase1.TeamRole) error {
	switch role {
	case keybase1.TeamRole_BOT,
		keybase1.TeamRole_RESTRICTEDBOT:
		return nil
	default:
		return fmt.Errorf("Only %v and %v are valid roles. Found %v",
			keybase1.TeamRole_BOT, keybase1.TeamRole_RESTRICTEDBOT, role)
	}
}

func (h *Server) teamIDFromTLFName(ctx context.Context, membersType chat1.ConversationMembersType,
	tlfName string, isPublic bool) (res keybase1.TeamID, err error) {

	switch membersType {
	case chat1.ConversationMembersType_KBFS:
		return res, errors.New("unable to find a team for KBFS conv")
	case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAMNATIVE,
		chat1.ConversationMembersType_IMPTEAMUPGRADE:
		nameInfo, err := CreateNameInfoSource(ctx, h.G(), membersType).LookupID(ctx, tlfName, isPublic)
		if err != nil {
			return "", err
		}
		if membersType == chat1.ConversationMembersType_IMPTEAMUPGRADE {
			team, err := NewTeamLoader(h.G().ExternalG()).loadTeam(ctx, nameInfo.ID, tlfName,
				membersType, isPublic, nil)
			if err != nil {
				return res, err
			}
			return team.ID, nil
		}
		return keybase1.TeamIDFromString(nameInfo.ID.String())
	}
	return res, fmt.Errorf("unknown members type: %v", membersType)
}

func (h *Server) fixupTeamErrorWithTLFName(ctx context.Context, username, tlfName string, err error) error {
	switch err.(type) {
	case nil:
		return nil
	case libkb.ExistsError:
		h.Debug(ctx, "fixupTeamErrorWithTLFName: %v", err)
		return libkb.ExistsError{Msg: fmt.Sprintf(
			"user %q is already a member of team %q", username, tlfName)}
	case libkb.NotFoundError:
		h.Debug(ctx, "fixupTeamErrorWithTLFName: %v", err)
		return libkb.NotFoundError{Msg: fmt.Sprintf(
			"user %q is not a member of team %q", username, tlfName)}
	default:
		return err
	}
}

func (h *Server) teamIDFromConvID(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (id keybase1.TeamID, conv chat1.ConversationLocal, err error) {
	if conv, err = utils.GetVerifiedConv(ctx, h.G(), uid, convID, types.InboxSourceDataSourceAll); err != nil {
		return id, conv, err
	}
	team, err := NewTeamLoader(h.G().ExternalG()).loadTeam(ctx, conv.Info.Triple.Tlfid,
		conv.Info.TlfName, conv.GetMembersType(), conv.IsPublic(), nil)
	if err != nil {
		return id, conv, err
	}
	return team.ID, conv, nil
}

func (h *Server) AddBotMember(ctx context.Context, arg chat1.AddBotMemberArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "AddBotMember")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}

	if err := h.validateBotRole(ctx, arg.Role); err != nil {
		return err
	}
	teamID, conv, err := h.teamIDFromConvID(ctx, uid, arg.ConvID)
	if err != nil {
		return err
	}
	defer func() { err = h.fixupTeamErrorWithTLFName(ctx, arg.Username, conv.Info.TlfName, err) }()
	_, err = teams.AddMemberByID(ctx, h.G().ExternalG(), teamID, arg.Username, arg.Role, arg.BotSettings, nil /* emailInviteMsg */)
	if err != nil {
		return err
	}
	err = teams.SendTeamChatWelcomeMessage(ctx, h.G().ExternalG(), teamID, conv.Info.TlfName,
		arg.Username, conv.GetMembersType(), arg.Role)
	if err != nil {
		return err
	}
	return nil
}

func (h *Server) EditBotMember(ctx context.Context, arg chat1.EditBotMemberArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "EditBotMember")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	if err := h.validateBotRole(ctx, arg.Role); err != nil {
		return err
	}
	teamID, _, err := h.teamIDFromConvID(ctx, uid, arg.ConvID)
	if err != nil {
		return err
	}
	return teams.EditMemberByID(ctx, h.G().ExternalG(), teamID, arg.Username, arg.Role, arg.BotSettings)
}

func (h *Server) RemoveBotMember(ctx context.Context, arg chat1.RemoveBotMemberArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "RemoveBotMember")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	teamID, conv, err := h.teamIDFromConvID(ctx, uid, arg.ConvID)
	if err != nil {
		return err
	}
	defer func() { err = h.fixupTeamErrorWithTLFName(ctx, arg.Username, conv.Info.TlfName, err) }()
	return teams.RemoveMemberByID(ctx, h.G().ExternalG(), teamID, arg.Username)
}

func (h *Server) SetBotMemberSettings(ctx context.Context, arg chat1.SetBotMemberSettingsArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "SetBotMemberSettings")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	teamID, conv, err := h.teamIDFromConvID(ctx, uid, arg.ConvID)
	if err != nil {
		return err
	}
	defer func() { err = h.fixupTeamErrorWithTLFName(ctx, arg.Username, conv.Info.TlfName, err) }()
	return teams.SetBotSettingsByID(ctx, h.G().ExternalG(), teamID, arg.Username, arg.BotSettings)
}

func (h *Server) GetBotMemberSettings(ctx context.Context, arg chat1.GetBotMemberSettingsArg) (res keybase1.TeamBotSettings, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "GetBotMemberSettings")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	teamID, conv, err := h.teamIDFromConvID(ctx, uid, arg.ConvID)
	if err != nil {
		return res, err
	}
	defer func() { err = h.fixupTeamErrorWithTLFName(ctx, arg.Username, conv.Info.TlfName, err) }()
	return teams.GetBotSettingsByID(ctx, h.G().ExternalG(), teamID, arg.Username)
}

func (h *Server) GetTeamRoleInConversation(ctx context.Context, arg chat1.GetTeamRoleInConversationArg) (res keybase1.TeamRole, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, &err, "GetTeamRoleInConversation")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	teamID, _, err := h.teamIDFromConvID(ctx, uid, arg.ConvID)
	if err != nil {
		return res, err
	}
	return teams.MemberRoleFromID(ctx, h.G().ExternalG(), teamID, arg.Username)
}

func (h *Server) SimpleSearchInboxConvNames(ctx context.Context, query string) (res []chat1.SimpleSearchInboxConvNamesHit, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, &err, "SimpleSearchInboxConvNames")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	username := h.G().GetEnv().GetUsername().String()
	allConvs, err := h.G().InboxSource.Search(ctx, uid, query,
		100, types.InboxSourceSearchEmptyModeAllBySendCtime)
	if err != nil {
		return res, err
	}
	for _, conv := range allConvs {
		switch conv.GetTeamType() {
		case chat1.TeamType_NONE:
			searchable := utils.SearchableRemoteConversationName(conv, username)
			res = append(res, chat1.SimpleSearchInboxConvNamesHit{
				Name:    searchable,
				ConvID:  conv.GetConvID(),
				Parts:   strings.Split(searchable, ","),
				TlfName: utils.GetRemoteConvTLFName(conv),
			})
		case chat1.TeamType_SIMPLE, chat1.TeamType_COMPLEX:
			res = append(res, chat1.SimpleSearchInboxConvNamesHit{
				Name:    utils.SearchableRemoteConversationName(conv, username),
				ConvID:  conv.GetConvID(),
				IsTeam:  true,
				TlfName: utils.GetRemoteConvTLFName(conv),
			})
		}
	}
	return res, nil
}

func (h *Server) AddBotConvSearch(ctx context.Context, term string) (res []chat1.ConvSearchHit, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, &err, "AddBotConvSearch")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	username := h.G().GetEnv().GetUsername().String()
	allConvs, err := h.G().InboxSource.Search(ctx, uid, term, 100, types.InboxSourceSearchEmptyModeAll)
	if err != nil {
		return res, err
	}
	res = make([]chat1.ConvSearchHit, 0, len(allConvs))
	for _, conv := range allConvs {
		switch conv.GetTeamType() {
		case chat1.TeamType_NONE:
			searchable := utils.SearchableRemoteConversationName(conv, username)
			res = append(res, chat1.ConvSearchHit{
				Name:   searchable,
				ConvID: conv.GetConvID(),
				Parts:  strings.Split(searchable, ","),
			})
		case chat1.TeamType_SIMPLE:
			res = append(res, chat1.ConvSearchHit{
				Name:   utils.SearchableRemoteConversationName(conv, username),
				ConvID: conv.GetConvID(),
				IsTeam: true,
			})
		case chat1.TeamType_COMPLEX:
			if conv.Conv.Metadata.IsDefaultConv {
				res = append(res, chat1.ConvSearchHit{
					Name:   utils.GetRemoteConvTLFName(conv),
					ConvID: conv.GetConvID(),
					IsTeam: true,
				})
			}
		}
	}
	return res, nil
}

func (h *Server) TeamIDFromTLFName(ctx context.Context, arg chat1.TeamIDFromTLFNameArg) (res keybase1.TeamID, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "TeamIDFromTLFName")()
	if _, err = utils.AssertLoggedInUID(ctx, h.G()); err != nil {
		return res, err
	}

	return h.teamIDFromTLFName(ctx, arg.MembersType, arg.TlfName, arg.TlfPublic)
}

func (h *Server) DismissJourneycard(ctx context.Context, arg chat1.DismissJourneycardArg) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "DismissJourneycard")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	inbox, err := h.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceLocalOnly,
		&chat1.GetInboxQuery{
			ConvID:           &arg.ConvID,
			SkipBgLoads:      true,
			AllowUnseenQuery: true,
		})
	if err != nil {
		return err
	}
	switch len(inbox.ConvsUnverified) {
	case 0:
		return fmt.Errorf("could not find conversation")
	case 1:
		if inbox.ConvsUnverified[0].LocalMetadata == nil {
			return fmt.Errorf("no local metadata")
		}
		teamID, err := keybase1.TeamIDFromString(inbox.ConvsUnverified[0].Conv.Metadata.IdTriple.Tlfid.String())
		if err != nil {
			return err
		}
		h.G().JourneyCardManager.Dismiss(ctx, uid, teamID, arg.ConvID, arg.CardType)
		return nil
	default:
		return fmt.Errorf("got %v conversations but expected 1", len(inbox.ConvsUnverified))
	}
}

const welcomeMessageName = "__welcome_message"

// welcomeMessageMaxLen is duplicated at
// shared/teams/edit-welcome-message/index.tsx:welcomeMessageMaxLen; keep the
// values in sync!
const welcomeMessageMaxLen = 400

func getWelcomeMessageConv(ctx context.Context, g *globals.Context, uid gregor1.UID, teamID keybase1.TeamID) (res types.RemoteConversation, err error) {
	onePerTlf := true
	tlfID := chat1.TLFID(teamID.ToBytes())
	topicType := chat1.TopicType_CHAT
	inbox, err := g.InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceLocalOnly,
		&chat1.GetInboxQuery{
			MembersTypes:      []chat1.ConversationMembersType{chat1.ConversationMembersType_TEAM},
			TlfID:             &tlfID,
			TopicType:         &topicType,
			AllowUnseenQuery:  true,
			OneChatTypePerTLF: &onePerTlf,
		})
	if err != nil {
		return res, err
	}
	if len(inbox.ConvsUnverified) == 0 {
		return res, libkb.NotFoundError{}
	}
	return inbox.ConvsUnverified[0], nil
}

func getWelcomeMessage(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface, uid gregor1.UID, teamID keybase1.TeamID) (message chat1.WelcomeMessageDisplay, err error) {
	conv, err := getWelcomeMessageConv(ctx, g, uid, teamID)
	if err != nil {
		return message, err
	}
	message = chat1.WelcomeMessageDisplay{Set: false}
	s := NewConvDevConversationBackedStorage(g, chat1.TopicType_DEV, true /* adminOnly */, ri)
	found, _, err := s.Get(ctx, uid, conv.GetConvID(), welcomeMessageName, &message, false)
	if !found {
		return message, nil
	}
	switch err.(type) {
	case nil:
	case *DevStorageAdminOnlyError:
		return message, nil
	default:
		return message, err
	}
	if len(message.Raw) > welcomeMessageMaxLen {
		return message, nil
	}
	message.Display = utils.PresentDecoratedTextNoMentions(ctx, message.Raw)
	return message, nil
}

func setWelcomeMessage(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface, uid gregor1.UID, teamID keybase1.TeamID, message chat1.WelcomeMessage) (err error) {
	if len(message.Raw) > welcomeMessageMaxLen {
		return fmt.Errorf("welcome message must be at most %d characters; was %d", welcomeMessageMaxLen, len(message.Raw))
	}
	conv, err := getWelcomeMessageConv(ctx, g, uid, teamID)
	if err != nil {
		return err
	}
	s := NewConvDevConversationBackedStorage(g, chat1.TopicType_DEV, true /* adminOnly */, ri)
	return s.Put(ctx, uid, conv.GetConvID(), welcomeMessageName, message)
}

func (h *Server) SetWelcomeMessage(ctx context.Context, arg chat1.SetWelcomeMessageArg) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "SetWelcomeMessage")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	return setWelcomeMessage(ctx, h.G(), h.remoteClient, uid, arg.TeamID, arg.Message)
}

func (h *Server) GetWelcomeMessage(ctx context.Context, teamID keybase1.TeamID) (res chat1.WelcomeMessageDisplay, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "GetWelcomeMessage")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	return getWelcomeMessage(ctx, h.G(), h.remoteClient, uid, teamID)
}

func (h *Server) GetDefaultTeamChannelsLocal(ctx context.Context, teamID keybase1.TeamID) (res chat1.GetDefaultTeamChannelsLocalRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("GetDefaultTeamChannelsLocal %v", teamID))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	resp, err := h.remoteClient().GetDefaultTeamChannels(ctx, teamID)
	if err != nil {
		return res, err
	}
	if len(resp.Convs) == 0 {
		return res, nil
	}
	topicType := chat1.TopicType_CHAT
	query := &chat1.GetInboxLocalQuery{
		ConvIDs:   resp.Convs,
		TopicType: &topicType,
	}
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, query)
	if err != nil {
		return res, err
	}
	res.Convs = utils.PresentConversationLocals(ctx, h.G(), uid, ib.Convs,
		utils.PresentParticipantsModeSkip)
	return res, nil
}

func (h *Server) SetDefaultTeamChannelsLocal(ctx context.Context, arg chat1.SetDefaultTeamChannelsLocalArg) (res chat1.SetDefaultTeamChannelsLocalRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, fmt.Sprintf("SetDefaultTeamChannelsLocal: %v", arg.TeamID))()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}

	convs := make([]chat1.ConversationID, 0, len(arg.Convs))
	for _, conv := range arg.Convs {
		convID, err := chat1.MakeConvID(conv.String())
		if err != nil {
			return res, err
		}
		convs = append(convs, convID)
	}
	_, err = h.remoteClient().SetDefaultTeamChannels(ctx, chat1.SetDefaultTeamChannelsArg{
		TeamID: arg.TeamID,
		Convs:  convs,
	})
	return res, err
}

func (h *Server) GetLastActiveForTLF(ctx context.Context, tlfIDStr chat1.TLFIDStr) (res chat1.LastActiveStatus, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetLastActiveForTLF")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	tlfID, err := chat1.MakeTLFID(tlfIDStr.String())
	if err != nil {
		return res, err
	}
	mtime, err := h.G().TeamChannelSource.GetLastActiveForTLF(ctx, uid, tlfID, chat1.TopicType_CHAT)
	if err != nil {
		return res, err
	}
	return utils.ToLastActiveStatus(mtime), nil
}

func (h *Server) GetLastActiveForTeams(ctx context.Context) (res chat1.LastActiveStatusAll, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetLastActiveForTeams")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	activity, err := h.G().TeamChannelSource.GetLastActiveForTeams(ctx, uid, chat1.TopicType_CHAT)
	if err != nil {
		return res, err
	}
	res.Teams = make(map[chat1.TLFIDStr]chat1.LastActiveStatus)
	res.Channels = make(map[chat1.ConvIDStr]chat1.LastActiveStatus)
	for tlfID, mtime := range activity.Teams {
		res.Teams[tlfID] = utils.ToLastActiveStatus(mtime)
	}
	for convID, mtime := range activity.Channels {
		res.Channels[convID] = utils.ToLastActiveStatus(mtime)
	}
	return res, nil
}

func (h *Server) GetRecentJoinsLocal(ctx context.Context, convID chat1.ConversationID) (numJoins int, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetRecentJoinsLocal")()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return 0, err
	}
	return h.G().TeamChannelSource.GetRecentJoins(ctx, convID, h.remoteClient())
}

func (h *Server) RefreshParticipants(ctx context.Context, convID chat1.ConversationID) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "RefreshParticipants")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	h.G().ParticipantsSource.GetWithNotifyNonblock(ctx, uid, convID, types.InboxSourceDataSourceAll)
	return nil
}

func (h *Server) GetParticipants(ctx context.Context, convID chat1.ConversationID) (participants []chat1.ConversationLocalParticipant, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetParticipants")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return nil, err
	}
	uids, err := h.G().ParticipantsSource.Get(ctx, uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return nil, err
	}
	participants, err = h.G().ParticipantsSource.GetParticipantsFromUids(ctx, uids)
	if err != nil {
		return nil, err
	}
	return participants, nil
}

func (h *Server) GetLastActiveAtLocal(ctx context.Context, arg chat1.GetLastActiveAtLocalArg) (lastActiveAt gregor1.Time, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetLastActiveAtLocal")()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return 0, err
	}
	uid := gregor1.UID(libkb.UsernameToUID(arg.Username).ToBytes())
	return h.G().TeamChannelSource.GetLastActiveAt(ctx, arg.TeamID, uid, h.remoteClient())
}

func (h *Server) GetLastActiveAtMultiLocal(ctx context.Context, arg chat1.GetLastActiveAtMultiLocalArg) (res map[keybase1.TeamID]gregor1.Time, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "GetLastActiveAtMultiLocal")()
	_, err = utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return nil, err
	}
	uid := gregor1.UID(libkb.UsernameToUID(arg.Username).ToBytes())

	res = map[keybase1.TeamID]gregor1.Time{}
	resMu := sync.Mutex{}
	sem := semaphore.NewWeighted(10)
	eg, subctx := errgroup.WithContext(ctx)
	for _, teamID := range arg.TeamIDs {
		if err := sem.Acquire(subctx, 1); err != nil {
			return nil, err
		}

		teamID := teamID
		eg.Go(func() error {
			defer sem.Release(1)

			lastActive, err := h.G().TeamChannelSource.GetLastActiveAt(subctx, teamID, uid, h.remoteClient())
			if err != nil {
				return err
			}
			resMu.Lock()
			res[teamID] = lastActive
			resMu.Unlock()
			return nil
		})
	}
	if err := eg.Wait(); err != nil {
		return nil, err
	}

	return res, nil
}

func (h *Server) getEmojiError(err error) *chat1.EmojiError {
	if err == nil {
		return nil
	}
	if verr, ok := err.(*EmojiValidationError); ok {
		return verr.Export()
	}
	return &chat1.EmojiError{
		Clidisplay: err.Error(),
		Uidisplay:  "unknown error",
	}
}

func (h *Server) AddEmoji(ctx context.Context, arg chat1.AddEmojiArg) (res chat1.AddEmojiRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "AddEmoji")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		res.Error = h.getEmojiError(err)
		err = nil
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if _, err := h.G().EmojiSource.Add(ctx, uid, arg.ConvID, arg.Alias, arg.Filename, arg.AllowOverwrite); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) AddEmojis(ctx context.Context, arg chat1.AddEmojisArg) (res chat1.AddEmojisRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "AddEmojis")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if len(arg.Aliases) != len(arg.Filenames) {
		return chat1.AddEmojisRes{}, errors.New("aliases and filenames have different length")
	}
	res.FailedFilenames = make(map[string]chat1.EmojiError)
	res.SuccessFilenames = make([]string, 0, len(arg.Aliases))
	for i := range arg.Aliases {
		_, err := h.G().EmojiSource.Add(ctx, uid, arg.ConvID, arg.Aliases[i], arg.Filenames[i], arg.AllowOverwrite[i])
		if err != nil {
			res.FailedFilenames[arg.Filenames[i]] = *h.getEmojiError(err)
		} else {
			res.SuccessFilenames = append(res.SuccessFilenames, arg.Filenames[i])
		}
	}
	return res, nil
}

func (h *Server) AddEmojiAlias(ctx context.Context, arg chat1.AddEmojiAliasArg) (res chat1.AddEmojiAliasRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "AddEmojiAlias")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	defer func() {
		res.Error = h.getEmojiError(err)
		err = nil
	}()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if _, err := h.G().EmojiSource.AddAlias(ctx, uid, arg.ConvID, arg.NewAlias, arg.ExistingAlias); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) RemoveEmoji(ctx context.Context, arg chat1.RemoveEmojiArg) (res chat1.RemoveEmojiRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "RemoveEmoji")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	if err := h.G().EmojiSource.Remove(ctx, uid, arg.ConvID, arg.Alias); err != nil {
		return res, err
	}
	return res, nil
}

func (h *Server) UserEmojis(ctx context.Context, arg chat1.UserEmojisArg) (res chat1.UserEmojiRes, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "UserEmojis")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	res.Emojis, err = h.G().EmojiSource.Get(ctx, uid, arg.ConvID, arg.Opts)
	return res, err
}

func (h *Server) ToggleEmojiAnimations(ctx context.Context, enabled bool) (err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, h.identNotifier)
	defer h.Trace(ctx, &err, "ToggleEmojiAnimations")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return err
	}
	return h.G().EmojiSource.ToggleAnimations(ctx, uid, enabled)
}

func (h *Server) ForwardMessage(ctx context.Context, arg chat1.ForwardMessageArg) (res chat1.PostLocalRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "ForwardMessage")()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	reason := chat1.GetThreadReason_FORWARDMSG
	msg, err := h.G().ConvSource.GetMessage(ctx, arg.SrcConvID, uid, arg.MsgID, &reason, nil, true)
	if err != nil {
		return res, err
	} else if !msg.IsValid() {
		return res, fmt.Errorf("unable to foward message, source is invalid")
	}
	dstConv, err := utils.GetVerifiedConv(ctx, h.G(), uid, arg.DstConvID, types.InboxSourceDataSourceAll)
	if err != nil {
		return res, err
	}
	mvalid := msg.Valid()
	switch mvalid.ClientHeader.MessageType {
	case chat1.MessageType_ATTACHMENT:
		// download from the original source
		mbod := msg.Valid().MessageBody.Attachment()
		sink, _, err := h.G().AttachmentUploader.GetUploadTempSink(ctx, mbod.Object.Filename)
		if err != nil {
			return res, err
		}
		_, err = h.downloadAttachmentLocal(ctx, uid, downloadAttachmentArg{
			SessionID:        arg.SessionID,
			ConversationID:   arg.SrcConvID,
			MessageID:        arg.MsgID,
			IdentifyBehavior: arg.IdentifyBehavior,
			Sink:             sink,
		})
		if err != nil {
			return res, err
		}
		var ephemeralLifetime *gregor1.DurationSec
		if md := mvalid.EphemeralMetadata(); md != nil {
			ephemeralLifetime = &md.Lifetime
		}
		return h.PostFileAttachmentLocal(ctx, chat1.PostFileAttachmentLocalArg{
			SessionID: arg.SessionID,
			Arg: chat1.PostFileAttachmentArg{
				ConversationID:    arg.DstConvID,
				TlfName:           dstConv.Info.TlfName,
				Visibility:        dstConv.Info.Visibility,
				Filename:          sink.Name(),
				Title:             arg.Title,
				Metadata:          mbod.Metadata,
				IdentifyBehavior:  arg.IdentifyBehavior,
				EphemeralLifetime: ephemeralLifetime,
			},
		})
	default:
		return h.PostLocal(ctx, chat1.PostLocalArg{
			SessionID:      arg.SessionID,
			ConversationID: arg.DstConvID,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:              dstConv.Info.Triple,
					TlfName:           dstConv.Info.TlfName,
					TlfPublic:         dstConv.Info.Visibility == keybase1.TLFVisibility_PUBLIC,
					MessageType:       mvalid.ClientHeader.MessageType,
					EphemeralMetadata: mvalid.EphemeralMetadata(),
				},
				MessageBody: mvalid.MessageBody.DeepCopy(),
			},
			IdentifyBehavior:   arg.IdentifyBehavior,
			SkipInChatPayments: true,
		})
	}
}

func (h *Server) ForwardMessageNonblock(ctx context.Context, arg chat1.ForwardMessageNonblockArg) (res chat1.PostLocalNonblockRes, err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, h.G(), arg.IdentifyBehavior, &identBreaks, h.identNotifier)
	defer h.Trace(ctx, &err, "ForwardMessageNonblock")()
	defer h.suspendBgConvLoads(ctx)()
	defer func() { h.setResultRateLimit(ctx, &res) }()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	reason := chat1.GetThreadReason_FORWARDMSG
	msg, err := h.G().ConvSource.GetMessage(ctx, arg.SrcConvID, uid, arg.MsgID, &reason, nil, true)
	if err != nil {
		return res, err
	} else if !msg.IsValid() {
		return res, fmt.Errorf("unable to forward message, source is invalid")
	}
	dstConv, err := utils.GetVerifiedConv(ctx, h.G(), uid, arg.DstConvID, types.InboxSourceDataSourceAll)
	if err != nil {
		return res, err
	}
	mvalid := msg.Valid()
	switch mvalid.ClientHeader.MessageType {
	case chat1.MessageType_ATTACHMENT:
		mbod := msg.Valid().MessageBody.Attachment()
		sink, _, err := h.G().AttachmentUploader.GetUploadTempSink(ctx, mbod.Object.Filename)
		if err != nil {
			return res, err
		}
		_, err = h.downloadAttachmentLocal(ctx, uid, downloadAttachmentArg{
			SessionID:        arg.SessionID,
			ConversationID:   arg.SrcConvID,
			MessageID:        arg.MsgID,
			IdentifyBehavior: arg.IdentifyBehavior,
			Sink:             sink,
		})
		if err != nil {
			return res, err
		}
		var ephemeralLifetime *gregor1.DurationSec
		if md := mvalid.EphemeralMetadata(); md != nil {
			ephemeralLifetime = &md.Lifetime
		}
		return h.PostFileAttachmentLocalNonblock(ctx, chat1.PostFileAttachmentLocalNonblockArg{
			SessionID: arg.SessionID,
			Arg: chat1.PostFileAttachmentArg{
				ConversationID:    arg.DstConvID,
				TlfName:           dstConv.Info.TlfName,
				Visibility:        dstConv.Info.Visibility,
				Filename:          sink.Name(),
				Title:             arg.Title,
				Metadata:          mbod.Metadata,
				IdentifyBehavior:  arg.IdentifyBehavior,
				EphemeralLifetime: ephemeralLifetime,
			},
		})
	default:
		return h.PostLocalNonblock(ctx, chat1.PostLocalNonblockArg{
			SessionID:      arg.SessionID,
			ConversationID: arg.DstConvID,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:              dstConv.Info.Triple,
					TlfName:           dstConv.Info.TlfName,
					TlfPublic:         dstConv.Info.Visibility == keybase1.TLFVisibility_PUBLIC,
					MessageType:       mvalid.ClientHeader.MessageType,
					EphemeralMetadata: mvalid.EphemeralMetadata(),
				},
				MessageBody: mvalid.MessageBody.DeepCopy(),
			},
			IdentifyBehavior:   arg.IdentifyBehavior,
			SkipInChatPayments: true,
		})
	}
}

func (h *Server) ForwardMessageConvSearch(ctx context.Context, term string) (res []chat1.ConvSearchHit, err error) {
	ctx = globals.ChatCtx(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer h.Trace(ctx, &err, "ForwardMessageConvSearch")()
	uid, err := utils.AssertLoggedInUID(ctx, h.G())
	if err != nil {
		return res, err
	}
	username := h.G().GetEnv().GetUsername().String()
	allConvs, err := h.G().InboxSource.Search(ctx, uid, term, 100, types.InboxSourceSearchEmptyModeAllBySendCtime)
	if err != nil {
		return res, err
	}
	res = make([]chat1.ConvSearchHit, 0, len(allConvs))
	for _, conv := range allConvs {
		if conv.CannotWrite() {
			continue
		}
		switch conv.GetTeamType() {
		case chat1.TeamType_NONE:
			searchable := utils.SearchableRemoteConversationName(conv, username)
			res = append(res, chat1.ConvSearchHit{
				Name:   searchable,
				ConvID: conv.GetConvID(),
				Parts:  strings.Split(searchable, ","),
			})
		case chat1.TeamType_SIMPLE,
			chat1.TeamType_COMPLEX:
			res = append(res, chat1.ConvSearchHit{
				Name:   utils.SearchableRemoteConversationName(conv, username),
				ConvID: conv.GetConvID(),
				IsTeam: true,
			})
		}
	}
	return res, nil
}
