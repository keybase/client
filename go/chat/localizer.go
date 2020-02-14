package chat

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/bots"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/errgroup"
)

type conversationLocalizer interface {
	Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox, maxLocalize *int) ([]chat1.ConversationLocal, error)
	Name() string
}

type baseLocalizer struct {
	globals.Contextified
	utils.DebugLabeler
	pipeline *localizerPipeline
}

func newBaseLocalizer(g *globals.Context, pipeline *localizerPipeline) *baseLocalizer {
	return &baseLocalizer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "baseLocalizer", false),
		pipeline:     pipeline,
	}
}

func (b *baseLocalizer) filterSelfFinalized(ctx context.Context, inbox types.Inbox) (res types.Inbox) {
	username := b.G().Env.GetUsername().String()
	res = inbox
	res.ConvsUnverified = nil
	for _, conv := range inbox.ConvsUnverified {
		if conv.Conv.IsSelfFinalized(username) {
			b.Debug(ctx, "baseLocalizer: skipping own finalized convo: %s", conv.ConvIDStr)
			continue
		}
		res.ConvsUnverified = append(res.ConvsUnverified, conv)
	}
	return res
}

func (b *baseLocalizer) getConvs(inbox types.Inbox, maxLocalize *int) []types.RemoteConversation {
	convs := inbox.ConvsUnverified
	if maxLocalize == nil || *maxLocalize >= len(convs) {
		return convs
	}
	return convs[:*maxLocalize]
}

type blockingLocalizer struct {
	globals.Contextified
	utils.DebugLabeler
	*baseLocalizer

	localizeCb chan types.AsyncInboxResult
}

func newBlockingLocalizer(g *globals.Context, pipeline *localizerPipeline,
	localizeCb chan types.AsyncInboxResult) *blockingLocalizer {
	return &blockingLocalizer{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "blockingLocalizer", false),
		baseLocalizer: newBaseLocalizer(g, pipeline),
		localizeCb:    localizeCb,
	}
}

func (b *blockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox,
	maxLocalize *int) (res []chat1.ConversationLocal, err error) {
	defer b.Trace(ctx, func() error { return err }, "Localize")()
	inbox = b.filterSelfFinalized(ctx, inbox)
	convs := b.getConvs(inbox, maxLocalize)
	if err := b.baseLocalizer.pipeline.queue(ctx, uid, convs, b.localizeCb); err != nil {
		b.Debug(ctx, "Localize: failed to queue: %s", err)
		return res, err
	}

	res = make([]chat1.ConversationLocal, len(convs))
	indexMap := make(map[chat1.ConvIDStr]int)
	for index, c := range convs {
		indexMap[c.ConvIDStr] = index
	}
	for ar := range b.localizeCb {
		res[indexMap[ar.ConvLocal.GetConvID().ConvIDStr()]] = ar.ConvLocal
	}
	return res, nil
}

func (b *blockingLocalizer) Name() string {
	return "blocking"
}

type nonBlockingLocalizer struct {
	globals.Contextified
	utils.DebugLabeler
	*baseLocalizer

	localizeCb chan types.AsyncInboxResult
}

func newNonblockingLocalizer(g *globals.Context, pipeline *localizerPipeline,
	localizeCb chan types.AsyncInboxResult) *nonBlockingLocalizer {
	return &nonBlockingLocalizer{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "nonBlockingLocalizer", false),
		baseLocalizer: newBaseLocalizer(g, pipeline),
		localizeCb:    localizeCb,
	}
}

func (b *nonBlockingLocalizer) filterInboxRes(ctx context.Context, inbox types.Inbox, uid gregor1.UID) (types.Inbox, error) {
	defer b.Trace(ctx, func() error { return nil }, "filterInboxRes")()
	// Loop through and look for empty convs or known errors and skip them
	var res []types.RemoteConversation
	for _, conv := range inbox.ConvsUnverified {
		select {
		case <-ctx.Done():
			return types.Inbox{}, ctx.Err()
		default:
		}
		if utils.IsConvEmpty(conv.Conv) {
			b.Debug(ctx, "filterInboxRes: skipping because empty: convID: %s", conv.Conv.GetConvID())
			continue
		}
		res = append(res, conv)
	}
	return types.Inbox{
		Version:         inbox.Version,
		ConvsUnverified: res,
		Convs:           inbox.Convs,
	}, nil
}

func (b *nonBlockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox,
	maxLocalize *int) (res []chat1.ConversationLocal, err error) {
	defer b.Trace(ctx, func() error { return err }, "Localize")()
	// Run some easy filters for empty messages and known errors to optimize UI drawing behavior
	inbox = b.filterSelfFinalized(ctx, inbox)
	filteredInbox, err := b.filterInboxRes(ctx, inbox, uid)
	if err != nil {
		return res, err
	}
	// Send inbox over localize channel
	select {
	case <-ctx.Done():
		return res, ctx.Err()
	case b.localizeCb <- types.AsyncInboxResult{
		InboxRes: &filteredInbox,
	}:
	}
	// Spawn off localization into its own goroutine and use cb to communicate with outside world
	go func(ctx context.Context) {
		b.Debug(ctx, "Localize: starting background localization: convs: %d", len(inbox.ConvsUnverified))
		if err := b.baseLocalizer.pipeline.queue(ctx, uid, b.getConvs(inbox, maxLocalize), b.localizeCb); err != nil {
			b.Debug(ctx, "Localize: failed to queue: %s", err)
			close(b.localizeCb)
		}
	}(globals.BackgroundChatCtx(ctx, b.G()))
	return nil, nil
}

func (b *nonBlockingLocalizer) Name() string {
	return "nonblocking"
}

type localizerPipelineJob struct {
	sync.Mutex

	ctx       context.Context
	cancelFn  context.CancelFunc
	retCh     chan types.AsyncInboxResult
	uid       gregor1.UID
	completed int
	pending   []types.RemoteConversation

	// testing
	gateCh chan struct{}
}

func (l *localizerPipelineJob) retry(g *globals.Context) (res *localizerPipelineJob) {
	l.Lock()
	defer l.Unlock()
	res = new(localizerPipelineJob)
	res.ctx, res.cancelFn = context.WithCancel(globals.BackgroundChatCtx(l.ctx, g))
	res.retCh = l.retCh
	res.uid = l.uid
	res.completed = l.completed
	res.pending = make([]types.RemoteConversation, len(l.pending))
	res.gateCh = make(chan struct{})
	copy(res.pending, l.pending)
	return res
}

func (l *localizerPipelineJob) closeIfDone() bool {
	l.Lock()
	defer l.Unlock()
	if len(l.pending) == 0 {
		close(l.retCh)
		return true
	}
	return false
}

func (l *localizerPipelineJob) getPending() (res []types.RemoteConversation) {
	l.Lock()
	defer l.Unlock()
	res = make([]types.RemoteConversation, len(l.pending))
	copy(res, l.pending)
	return res
}

func (l *localizerPipelineJob) numPending() int {
	l.Lock()
	defer l.Unlock()
	return len(l.pending)
}

func (l *localizerPipelineJob) numCompleted() int {
	l.Lock()
	defer l.Unlock()
	return l.completed
}

func (l *localizerPipelineJob) complete(convID chat1.ConversationID) {
	l.Lock()
	defer l.Unlock()
	for index, j := range l.pending {
		if j.GetConvID().Eq(convID) {
			l.completed++
			l.pending = append(l.pending[:index], l.pending[index+1:]...)
			return
		}
	}
}

func newLocalizerPipelineJob(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convs []types.RemoteConversation, retCh chan types.AsyncInboxResult) *localizerPipelineJob {
	return &localizerPipelineJob{
		ctx:     globals.BackgroundChatCtx(ctx, g),
		retCh:   retCh,
		uid:     uid,
		pending: convs,
		gateCh:  make(chan struct{}),
	}
}

type localizerPipeline struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	offline bool

	started        bool
	stopCh         chan struct{}
	cancelChs      map[string]chan struct{}
	suspendCount   int
	suspendWaiters []chan struct{}
	jobQueue       chan *localizerPipelineJob

	// testing
	useGateCh   bool
	jobPulledCh chan *localizerPipelineJob
}

func newLocalizerPipeline(g *globals.Context) *localizerPipeline {
	return &localizerPipeline{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "localizerPipeline", false),
		stopCh:       make(chan struct{}),
		cancelChs:    make(map[string]chan struct{}),
	}
}

func (s *localizerPipeline) Connected() {
	s.Lock()
	defer s.Unlock()
	s.offline = false
}

func (s *localizerPipeline) Disconnected() {
	s.Lock()
	defer s.Unlock()
	s.offline = true
}

func (s *localizerPipeline) queue(ctx context.Context, uid gregor1.UID, convs []types.RemoteConversation,
	retCh chan types.AsyncInboxResult) error {
	defer s.Trace(ctx, func() error { return nil }, "queue")()
	s.Lock()
	defer s.Unlock()
	if !s.started {
		return errors.New("localizer not running")
	}
	job := newLocalizerPipelineJob(ctx, s.G(), uid, convs, retCh)
	job.ctx, job.cancelFn = context.WithCancel(globals.BackgroundChatCtx(ctx, s.G()))
	if globals.IsLocalizerCancelableCtx(job.ctx) {
		s.Debug(job.ctx, "queue: adding cancellable job")
	}
	s.jobQueue <- job
	return nil
}

func (s *localizerPipeline) clearQueue() {
	s.jobQueue = make(chan *localizerPipelineJob, 100)
}

func (s *localizerPipeline) start(ctx context.Context) {
	defer s.Trace(ctx, func() error { return nil }, "start")()
	s.Lock()
	defer s.Unlock()
	if s.started {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
	}
	s.clearQueue()
	s.started = true
	go s.localizeLoop()
}

func (s *localizerPipeline) stop(ctx context.Context) chan struct{} {
	defer s.Trace(ctx, func() error { return nil }, "stop")()
	s.Lock()
	defer s.Unlock()
	ch := make(chan struct{})
	if s.started {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
		s.started = false
	}
	close(ch)
	return ch
}

func (s *localizerPipeline) suspend(ctx context.Context) bool {
	defer s.Trace(ctx, func() error { return nil }, "suspend")()
	s.Lock()
	defer s.Unlock()
	if !s.started {
		return false
	}
	s.suspendCount++
	if len(s.cancelChs) == 0 {
		return false
	}
	for _, ch := range s.cancelChs {
		ch <- struct{}{}
	}
	s.cancelChs = make(map[string]chan struct{})
	return true
}

func (s *localizerPipeline) registerJobPull(ctx context.Context) (string, chan struct{}) {
	s.Lock()
	defer s.Unlock()
	id := libkb.RandStringB64(3)
	ch := make(chan struct{}, 1)
	if globals.IsLocalizerCancelableCtx(ctx) {
		s.cancelChs[id] = ch
	}
	return id, ch
}

func (s *localizerPipeline) finishJobPull(id string) {
	s.Lock()
	defer s.Unlock()
	delete(s.cancelChs, id)
}

func (s *localizerPipeline) resume(ctx context.Context) bool {
	defer s.Trace(ctx, func() error { return nil }, "resume")()
	s.Lock()
	defer s.Unlock()
	if s.suspendCount == 0 {
		s.Debug(ctx, "resume: spurious resume call without suspend")
		return false
	}
	s.suspendCount--
	if s.suspendCount == 0 {
		for _, cb := range s.suspendWaiters {
			close(cb)
		}
		s.suspendWaiters = nil
	}
	return false
}

func (s *localizerPipeline) registerWaiter() chan struct{} {
	s.Lock()
	defer s.Unlock()
	cb := make(chan struct{})
	if s.suspendCount == 0 {
		close(cb)
		return cb
	}
	s.suspendWaiters = append(s.suspendWaiters, cb)
	return cb
}

func (s *localizerPipeline) localizeJobPulled(job *localizerPipelineJob, stopCh chan struct{}) {
	id, cancelCh := s.registerJobPull(job.ctx)
	defer s.finishJobPull(id)
	s.Debug(job.ctx, "localizeJobPulled: pulling job: pending: %d completed: %d", job.numPending(),
		job.numCompleted())
	waitCh := make(chan struct{})
	if !globals.IsLocalizerCancelableCtx(job.ctx) {
		close(waitCh)
	} else {
		s.Debug(job.ctx, "localizeJobPulled: waiting for resume")
		go func() {
			<-s.registerWaiter()
			close(waitCh)
		}()
	}
	select {
	case <-waitCh:
		s.Debug(job.ctx, "localizeJobPulled: resume, proceeding")
	case <-stopCh:
		s.Debug(job.ctx, "localizeJobPulled: shutting down")
		return
	}
	s.jobPulled(job.ctx, job)
	doneCh := make(chan struct{})
	go func() {
		defer close(doneCh)
		if err := s.localizeConversations(job); err == context.Canceled {
			// just put this right back if we canceled it
			s.Debug(job.ctx, "localizeJobPulled: re-enqueuing canceled job")
			s.jobQueue <- job.retry(s.G())
		}
		if job.closeIfDone() {
			s.Debug(job.ctx, "localizeJobPulled: all job tasks complete")
		}
	}()
	select {
	case <-doneCh:
		job.cancelFn()
	case <-cancelCh:
		s.Debug(job.ctx, "localizeJobPulled: canceled a live job")
		job.cancelFn()
	case <-stopCh:
		s.Debug(job.ctx, "localizeJobPulled: shutting down")
		job.cancelFn()
		return
	}
	s.Debug(job.ctx, "localizeJobPulled: job pass complete")
}

func (s *localizerPipeline) localizeLoop() {
	ctx := context.Background()
	s.Debug(ctx, "localizeLoop: starting up")
	s.Lock()
	stopCh := s.stopCh
	s.Unlock()
	for {
		select {
		case job := <-s.jobQueue:
			go s.localizeJobPulled(job, stopCh)
		case <-stopCh:
			s.Debug(ctx, "localizeLoop: shutting down")
			return
		}
	}
}

func (s *localizerPipeline) gateCheck(ctx context.Context, ch chan struct{}, index int) {
	if s.useGateCh && ch != nil {
		select {
		case <-ch:
			s.Debug(ctx, "localizeConversations: gate check received: %d", index)
		case <-ctx.Done():
		}
	}
}

func (s *localizerPipeline) jobPulled(ctx context.Context, job *localizerPipelineJob) {
	if s.jobPulledCh != nil {
		s.jobPulledCh <- job
	}
}

func (s *localizerPipeline) localizeConversations(localizeJob *localizerPipelineJob) (err error) {
	ctx := localizeJob.ctx
	uid := localizeJob.uid
	defer s.Trace(ctx, func() error { return err }, "localizeConversations")()

	// Fetch conversation local information in parallel
	eg, ctx := errgroup.WithContext(ctx)
	ctx = libkb.WithLogTag(ctx, "CHTLOCS")
	pending := localizeJob.getPending()
	if len(pending) == 0 {
		return nil
	}
	s.Debug(ctx, "localizeConversations: pending: %d", len(pending))
	convCh := make(chan types.RemoteConversation, len(pending))
	retCh := make(chan chat1.ConversationID, len(pending))
	eg.Go(func() error {
		defer close(convCh)
		for _, conv := range pending {
			select {
			case <-ctx.Done():
				s.Debug(ctx, "localizeConversations: context is done, bailing (producer)")
				return ctx.Err()
			default:
			}
			convCh <- conv
		}
		return nil
	})
	nthreads := s.G().Env.GetChatInboxSourceLocalizeThreads()
	for i := 0; i < nthreads; i++ {
		index := i
		eg.Go(func() error {
			for conv := range convCh {
				s.gateCheck(ctx, localizeJob.gateCh, index)
				s.Debug(ctx, "localizeConversations: localizing: %d convID: %s", index, conv.ConvIDStr)
				convLocal := s.localizeConversation(ctx, uid, conv)
				select {
				case <-ctx.Done():
					s.Debug(ctx, "localizeConversations: context is done, bailing (consumer): %d", index)
					return ctx.Err()
				default:
				}
				retCh <- conv.GetConvID()
				if convLocal.Error != nil {
					s.Debug(ctx, "localizeConversations: error localizing: convID: %s err: %s",
						conv.ConvIDStr, convLocal.Error.Message)
				}
				localizeJob.retCh <- types.AsyncInboxResult{
					ConvLocal: convLocal,
					Conv:      conv,
				}
				s.Debug(ctx, "localizeConversations: localized: %d convID: %s", index, conv.ConvIDStr)
			}
			return nil
		})
	}
	go func() {
		_ = eg.Wait()
		close(retCh)
	}()
	complete := 0
	for convID := range retCh {
		complete++
		s.Debug(ctx, "localizeConversations: complete: %d remaining: %d", complete, len(pending)-complete)
		localizeJob.complete(convID)
	}
	return eg.Wait()
}

func (s *localizerPipeline) isErrPermanent(err error) bool {
	if uberr, ok := err.(types.UnboxingError); ok {
		return uberr.IsPermanent()
	}
	return false
}

func getUnverifiedTlfNameForErrors(conversationRemote chat1.Conversation) string {
	var tlfName string
	var latestMsgID chat1.MessageID
	for _, msg := range conversationRemote.MaxMsgSummaries {
		if msg.GetMessageID() > latestMsgID {
			latestMsgID = msg.GetMessageID()
			tlfName = msg.TLFNameExpanded(conversationRemote.Metadata.FinalizeInfo)
		}
	}
	return tlfName
}

func (s *localizerPipeline) getMinWriterRoleInfoLocal(ctx context.Context, uid gregor1.UID,
	conv chat1.Conversation) (*chat1.ConversationMinWriterRoleInfoLocal, error) {
	if conv.ConvSettings == nil || conv.ReaderInfo == nil {
		return nil, nil
	}
	info := conv.ConvSettings.MinWriterRoleInfo
	if info == nil {
		return nil, nil
	}

	// NOTE We use the UntrustedTeamRole here since MinWriterRole is based on
	// server trust. A nefarious server could stop our messages by rejecting
	// them or violate the MinWriterRole by allowing them; lying about our role
	// here doesn't help.
	role := conv.ReaderInfo.UntrustedTeamRole

	// get the changed by username
	name, err := s.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(info.Uid.String()))
	if err != nil {
		return nil, err
	}
	return &chat1.ConversationMinWriterRoleInfoLocal{
		Role:        info.Role,
		ChangedBy:   name.String(),
		CannotWrite: !role.IsOrAbove(info.Role),
	}, nil
}

func (s *localizerPipeline) getConvSettingsLocal(ctx context.Context, uid gregor1.UID,
	conv chat1.Conversation) (*chat1.ConversationSettingsLocal, error) {
	settings := conv.ConvSettings
	if settings == nil {
		return nil, nil
	}
	res := &chat1.ConversationSettingsLocal{}
	minWriterRoleInfo, err := s.getMinWriterRoleInfoLocal(ctx, uid, conv)
	if err != nil {
		return nil, err
	}
	res.MinWriterRoleInfo = minWriterRoleInfo
	return res, nil
}

// returns an incomplete list in case of error
func (s *localizerPipeline) getResetUsernamesMetadata(ctx context.Context, uidMapper libkb.UIDMapper,
	conv chat1.Conversation) (res []string) {
	if len(conv.Metadata.ResetList) == 0 {
		return res
	}

	var kuids []keybase1.UID
	for _, uid := range conv.Metadata.ResetList {
		kuids = append(kuids, keybase1.UID(uid.String()))
	}
	rows, err := uidMapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, 0, 0, false)
	if err != nil {
		s.Debug(ctx, "getResetUsernamesMetadata: failed to run uid mapper: %s", err)
		return res
	}
	for _, row := range rows {
		res = append(res, row.NormalizedUsername.String())
	}

	return res
}

// returns an incomplete list in case of error
func (s *localizerPipeline) getResetUsernamesPegboard(ctx context.Context, uidMapper libkb.UIDMapper,
	membersType chat1.ConversationMembersType, info types.NameInfo, public bool) (res []string, err error) {
	// NOTE: If this is too slow, it could be cached on local metadata.
	team, err := NewTeamLoader(s.G().ExternalG()).loadTeam(ctx, info.ID, info.CanonicalName,
		membersType, public, nil)
	if err != nil {
		return nil, err
	}
	var resetUIDs []keybase1.UID
	for _, uv := range team.AllUserVersions(ctx) {
		err = s.G().Pegboard.CheckUV(s.MetaContext(ctx), uv)
		if err != nil {
			// Turn peg failures into reset usernames.
			s.Debug(ctx, "pegboard rejected %v: %v", uv, err)
			resetUIDs = append(resetUIDs, uv.Uid)
		}
	}
	rows, err := uidMapper.MapUIDsToUsernamePackages(ctx, s.G(), resetUIDs, 0, 0, false)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		res = append(res, row.NormalizedUsername.String())
	}
	return res, nil
}

func (s *localizerPipeline) getPinnedMsg(ctx context.Context, uid gregor1.UID, conv chat1.Conversation,
	pinMessage chat1.MessageUnboxed) (pinnedMsg chat1.MessageUnboxed, pinnerUsername string, valid bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "getPinnedMsg: %v", pinMessage.GetMessageID())()
	if !pinMessage.IsValidFull() {
		s.Debug(ctx, "getPinnedMsg: not a valid pin message")
		return pinnedMsg, pinnerUsername, false, nil
	}
	if storage.NewPinIgnore(s.G(), uid).IsIgnored(ctx, conv.GetConvID(), pinMessage.GetMessageID()) {
		s.Debug(ctx, "getPinnedMsg: ignored pinned message")
		return pinnedMsg, pinnerUsername, false, nil
	}
	body := pinMessage.Valid().MessageBody
	pinnedMsgID := body.Pin().MsgID
	messages, err := s.G().ConvSource.GetMessages(ctx, conv, uid, []chat1.MessageID{pinnedMsgID}, nil)
	if err != nil {
		return pinnedMsg, pinnerUsername, false, nil
	}
	xformRes, err := s.G().ConvSource.TransformSupersedes(ctx, conv, uid, messages, &chat1.GetThreadQuery{
		EnableDeletePlaceholders: true,
	}, nil, nil)
	if err != nil {
		return pinnedMsg, pinnerUsername, false, nil
	}
	if len(xformRes) == 0 {
		s.Debug(ctx, "getPinnedMsg: no pin message after xform supersedes")
		return pinnedMsg, pinnerUsername, false, nil
	}
	pinnedMsg = xformRes[0]
	if !pinnedMsg.IsValidFull() {
		s.Debug(ctx, "getPinnedMsg: not a valid pinned message")
		return pinnedMsg, pinnerUsername, false, nil
	}
	return pinnedMsg, pinMessage.Valid().SenderUsername, true, nil
}

func (s *localizerPipeline) localizeConversation(ctx context.Context, uid gregor1.UID,
	rc types.RemoteConversation) (conversationLocal chat1.ConversationLocal) {
	ctx = libkb.WithLogTag(ctx, "CHTLOC")
	conversationRemote := rc.Conv
	unverifiedTLFName := getUnverifiedTlfNameForErrors(conversationRemote)
	defer s.Trace(ctx, func() error { return nil },
		"localizeConversation: TLF: %s convID: %s offline: %v vis: %v", unverifiedTLFName,
		conversationRemote.GetConvID(), s.offline, conversationRemote.Metadata.Visibility)()

	var err error
	umapper := s.G().UIDMapper
	conversationLocal.Info = chat1.ConversationInfoLocal{
		Id:            conversationRemote.Metadata.ConversationID,
		IsDefaultConv: conversationRemote.Metadata.IsDefaultConv,
		Visibility:    conversationRemote.Metadata.Visibility,
		Triple:        conversationRemote.Metadata.IdTriple,
		Status:        conversationRemote.Metadata.Status,
		MembersType:   conversationRemote.Metadata.MembersType,
		MemberStatus:  conversationRemote.ReaderInfo.Status,
		TeamType:      conversationRemote.Metadata.TeamType,
		Version:       conversationRemote.Metadata.Version,
		LocalVersion:  conversationRemote.Metadata.LocalVersion,
		FinalizeInfo:  conversationRemote.Metadata.FinalizeInfo,
		Draft:         rc.LocalDraft,
	}
	conversationLocal.BotAliases = make(map[string]string)
	conversationLocal.BotCommands = chat1.NewConversationCommandGroupsWithNone()
	conversationLocal.Supersedes = append(
		conversationLocal.Supersedes, conversationRemote.Metadata.Supersedes...)
	conversationLocal.SupersededBy = append(
		conversationLocal.SupersededBy, conversationRemote.Metadata.SupersededBy...)
	if conversationRemote.ReaderInfo == nil {
		errMsg := "empty ReaderInfo from server?"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}
	conversationLocal.ReaderInfo = *conversationRemote.ReaderInfo
	conversationLocal.Notifications = conversationRemote.Notifications
	if conversationRemote.CreatorInfo != nil {
		packages, err := umapper.MapUIDsToUsernamePackages(ctx, s.G(),
			[]keybase1.UID{keybase1.UID(conversationRemote.CreatorInfo.Uid.String())}, 0, 0, false)
		if err != nil || len(packages) == 0 {
			s.Debug(ctx, "localizeConversation: failed to load creator username: %s", err)
		} else {
			conversationLocal.CreatorInfo = &chat1.ConversationCreatorInfoLocal{
				Username: packages[0].NormalizedUsername.String(),
				Ctime:    conversationRemote.CreatorInfo.Ctime,
			}
		}
	}
	conversationLocal.Expunge = conversationRemote.Expunge
	conversationLocal.ConvRetention = conversationRemote.ConvRetention
	conversationLocal.TeamRetention = conversationRemote.TeamRetention
	convSettings, err := s.getConvSettingsLocal(ctx, uid, conversationRemote)
	if err != nil {
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			err.Error(), conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}
	conversationLocal.ConvSettings = convSettings

	if len(conversationRemote.MaxMsgSummaries) == 0 {
		errMsg := "conversation has an empty MaxMsgSummaries field"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}
	conversationLocal.MaxMessages = conversationRemote.MaxMsgSummaries

	conversationLocal.IsEmpty = utils.IsConvEmpty(conversationRemote)
	errTyp := chat1.ConversationErrorType_PERMANENT
	var maxMsgs []chat1.MessageUnboxed
	if len(conversationRemote.MaxMsgs) == 0 {
		// Fetch max messages unboxed, using either a custom function or through
		// the conversation source configured in the global context
		var summaries []chat1.MessageSummary
		snippetSummary, err := utils.PickLatestMessageSummary(conversationRemote,
			append(chat1.VisibleChatMessageTypes(), chat1.MessageType_DELETEHISTORY))
		if err == nil {
			summaries = append(summaries, snippetSummary)
		}
		topicNameSummary, err := conversationRemote.GetMaxMessage(chat1.MessageType_METADATA)
		if err == nil {
			summaries = append(summaries, topicNameSummary)
		}
		headlineSummary, err := conversationRemote.GetMaxMessage(chat1.MessageType_HEADLINE)
		if err == nil {
			summaries = append(summaries, headlineSummary)
		}
		pinSummary, err := conversationRemote.GetMaxMessage(chat1.MessageType_PIN)
		if err == nil {
			summaries = append(summaries, pinSummary)
		}
		if len(summaries) == 0 ||
			conversationRemote.GetMembersType() == chat1.ConversationMembersType_IMPTEAMUPGRADE ||
			conversationRemote.GetMembersType() == chat1.ConversationMembersType_KBFS {
			tlfSummary, err := conversationRemote.GetMaxMessage(chat1.MessageType_TLFNAME)
			if err == nil {
				summaries = append(summaries, tlfSummary)
			}
		}
		msgs, err := s.G().ConvSource.GetMessages(ctx, conversationRemote,
			uid, utils.PluckMessageIDs(summaries), nil)
		if !s.isErrPermanent(err) {
			errTyp = chat1.ConversationErrorType_TRANSIENT
		}
		if err != nil {
			convErr := s.checkRekeyError(ctx, err, conversationRemote, unverifiedTLFName)
			if convErr != nil {
				conversationLocal.Error = convErr
				return conversationLocal
			}
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				err.Error(), conversationRemote, unverifiedTLFName, errTyp, nil)
			return conversationLocal
		}
		maxMsgs = msgs
	} else {
		// Use the attached MaxMsgs
		msgs, err := s.G().ConvSource.GetMessagesWithRemotes(ctx,
			conversationRemote, uid, conversationRemote.MaxMsgs)
		if err != nil {
			convErr := s.checkRekeyError(ctx, err, conversationRemote, unverifiedTLFName)
			if convErr != nil {
				conversationLocal.Error = convErr
				return conversationLocal
			}
			if !s.isErrPermanent(err) {
				errTyp = chat1.ConversationErrorType_TRANSIENT
			}
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				err.Error(), conversationRemote, unverifiedTLFName, errTyp, nil)
			return conversationLocal
		}
		maxMsgs = msgs
	}

	var maxValidID chat1.MessageID
	s.Debug(ctx, "localizing %d max msgs", len(maxMsgs))
	for _, mm := range maxMsgs {
		if mm.IsValid() && (mm.IsVisible() || mm.GetMessageType() == chat1.MessageType_DELETEHISTORY) {
			if conversationLocal.Info.SnippetMsg == nil ||
				conversationLocal.Info.SnippetMsg.GetMessageID() < mm.GetMessageID() {
				conversationLocal.Info.SnippetMsg = new(chat1.MessageUnboxed)
				*conversationLocal.Info.SnippetMsg = mm
			}
		}
		if mm.IsValid() {
			body := mm.Valid().MessageBody
			typ, err := body.MessageType()
			if err != nil {
				s.Debug(ctx, "failed to get message type: convID: %s id: %d",
					conversationRemote.GetConvID(), mm.GetMessageID())
				continue
			}
			switch typ {
			case chat1.MessageType_METADATA:
				conversationLocal.Info.TopicName = body.Metadata().ConversationTitle
			case chat1.MessageType_HEADLINE:
				conversationLocal.Info.Headline = body.Headline().Headline
			case chat1.MessageType_PIN:
				pinnedMsg, pinnerUsername, valid, err := s.getPinnedMsg(ctx, uid, conversationRemote, mm)
				if err != nil {
					conversationLocal.Error = chat1.NewConversationErrorLocal(
						fmt.Sprintf("unable to get pinned message: %s", err),
						conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
					return conversationLocal
				}
				if valid {
					conversationLocal.Info.PinnedMsg = &chat1.ConversationPinnedMessage{
						Message:        pinnedMsg,
						PinnerUsername: pinnerUsername,
					}
				}
			}
			if mm.GetMessageID() >= maxValidID {
				conversationLocal.Info.Triple = mm.Valid().ClientHeader.Conv
				conversationLocal.Info.TlfName = mm.Valid().ClientHeader.TlfName
				maxValidID = mm.GetMessageID()
			}
		} else {
			_, err := mm.State()
			s.Debug(ctx, "skipping invalid max msg: state: %v", err)
		}
	}
	// see if we should override the snippet message with the latest outbox record
	obrs, err := storage.NewOutbox(s.G(), uid).PullForConversation(ctx, conversationRemote.GetConvID())
	if err != nil {
		s.Debug(ctx, "unable to get outbox records: %v", err)
	}
	for index := len(obrs) - 1; index >= 0; index-- {
		msg := chat1.NewMessageUnboxedWithOutbox(obrs[index])
		if msg.IsVisible() {
			conversationLocal.Info.SnippetMsg = &msg
			break
		}
	}

	// Resolve edits/deletes on snippet message
	if conversationLocal.Info.SnippetMsg != nil {
		superXform := newBasicSupersedesTransform(s.G(), basicSupersedesTransformOpts{})
		if newMsg, err := superXform.Run(ctx, conversationRemote, uid,
			[]chat1.MessageUnboxed{*conversationLocal.Info.SnippetMsg}); err != nil {
			s.Debug(ctx, "failed to transform message: id: %d err: %s",
				conversationLocal.Info.SnippetMsg.GetMessageID(), err)
		} else {
			if len(newMsg) > 0 {
				conversationLocal.Info.SnippetMsg = &newMsg[0]
			}
		}
	}

	// Verify ConversationID is derivable from ConversationIDTriple
	if !conversationLocal.Info.Triple.Derivable(conversationLocal.Info.Id) {
		errMsg := fmt.Sprintf("unexpected response from server: conversation ID is not derivable from conversation triple. triple: %#+v; Id: %x",
			conversationLocal.Info.Triple, conversationLocal.Info.Id)
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}

	// verify Conv matches ConversationIDTriple in MessageClientHeader
	if !conversationRemote.Metadata.IdTriple.Eq(conversationLocal.Info.Triple) {
		errMsg := "server header conversation triple does not match client header triple"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}

	membersType := conversationRemote.GetMembersType()
	infoSource := CreateNameInfoSource(ctx, s.G(), conversationLocal.GetMembersType())
	var info types.NameInfo
	var ierr error
	switch membersType {
	case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAMNATIVE,
		chat1.ConversationMembersType_IMPTEAMUPGRADE:
		tlfName := conversationLocal.Info.TlfName
		if tlfName == "" {
			tlfName = unverifiedTLFName
		}
		info, ierr = infoSource.LookupName(ctx,
			conversationLocal.Info.Triple.Tlfid,
			conversationLocal.Info.Visibility == keybase1.TLFVisibility_PUBLIC,
			tlfName,
		)
	default:
		if len(conversationLocal.Info.TlfName) == 0 {
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				"unable to get conversation name from message history", conversationRemote,
				unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
			return conversationLocal
		}
		info, ierr = infoSource.LookupID(ctx,
			conversationLocal.Info.TlfName,
			conversationLocal.Info.Visibility == keybase1.TLFVisibility_PUBLIC)
	}
	if ierr != nil {
		errMsg := ierr.Error()
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT,
			nil)
		return conversationLocal
	}
	conversationLocal.Info.TlfName = info.CanonicalName

	// Get conversation commands
	conversationLocal.Commands, err = s.G().CommandsSource.ListCommands(ctx, uid, conversationLocal)
	if err != nil {
		s.Debug(ctx, "localizeConversation: failed to list commands: %s", err)
	}
	botCommands, alias, err := s.G().BotCommandManager.ListCommands(ctx, conversationLocal.GetConvID())
	if err != nil {
		s.Debug(ctx, "localizeConversation: failed to list bot commands: %s", err)
		conversationLocal.BotAliases = make(map[string]string)
		conversationLocal.BotCommands = chat1.NewConversationCommandGroupsWithNone()
	} else {
		conversationLocal.BotAliases = alias
		if len(botCommands) > 0 {
			conversationLocal.BotCommands = bots.MakeConversationCommandGroups(botCommands)
		} else {
			conversationLocal.BotCommands = chat1.NewConversationCommandGroupsWithNone()
		}
	}

	// Form the writers name list, either from the active list + TLF name, or from the
	// channel information for a team chat
	switch membersType {
	case chat1.ConversationMembersType_TEAM:
		var kuids []keybase1.UID
		for _, uid := range conversationRemote.Metadata.AllList {
			kuids = append(kuids, keybase1.UID(uid.String()))
		}
		conversationLocal.Info.ResetNames = s.getResetUsernamesMetadata(ctx, umapper, conversationRemote)
		rows, err := umapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, time.Hour*24,
			10*time.Second, true)
		if err != nil {
			s.Debug(ctx, "localizeConversation: team UIDMapper returned an error: %s", err)
		}
		for _, row := range rows {
			conversationLocal.Info.Participants = append(conversationLocal.Info.Participants,
				utils.UsernamePackageToParticipant(row))
		}
		// Sort alphabetically
		sort.Slice(conversationLocal.Info.Participants, func(i, j int) bool {
			return conversationLocal.Info.Participants[i].Username <
				conversationLocal.Info.Participants[j].Username
		})
	case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_IMPTEAMUPGRADE:
		public := conversationLocal.Info.Visibility == keybase1.TLFVisibility_PUBLIC
		resetUsernamesPegboard, err := s.getResetUsernamesPegboard(ctx, umapper, membersType, info, public)
		if err != nil {
			s.Debug(ctx, "getResetUsernamesPegboard error: %v", err)
			resetUsernamesPegboard = nil
		}
		conversationLocal.Info.ResetNames = utils.DedupStringLists(
			s.getResetUsernamesMetadata(ctx, umapper, conversationRemote),
			resetUsernamesPegboard,
		)
		var kuids []keybase1.UID
		for _, uid := range info.VerifiedMembers {
			kuids = append(kuids, keybase1.UID(uid.String()))
		}
		rows, err := umapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, time.Hour*24, 10*time.Second, true)
		if err != nil {
			s.Debug(ctx, "localizeConversation: impteam UIDMapper returned an error: %s", err)
			errMsg := fmt.Sprintf("error getting usernames of participants: %s", err)
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
			return conversationLocal
		}
		var verifiedUsernames []string
		for _, row := range rows {
			verifiedUsernames = append(verifiedUsernames, row.NormalizedUsername.String())
		}
		conversationLocal.Info.Participants, err = utils.ReorderParticipants(
			s.G().MetaContext(ctx),
			s.G(),
			umapper,
			conversationLocal.Info.TlfName,
			verifiedUsernames,
			conversationRemote.Metadata.ActiveList)
		if err != nil {
			errMsg := fmt.Sprintf("error reordering participants: %s", err)
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
			return conversationLocal
		}
		utils.AttachContactNames(s.G().MetaContext(ctx), conversationLocal.Info.Participants)
	case chat1.ConversationMembersType_KBFS:
		conversationLocal.Info.Participants, err = utils.ReorderParticipantsKBFS(
			s.G().MetaContext(ctx),
			s.G(),
			umapper,
			conversationLocal.Info.TlfName,
			conversationRemote.Metadata.ActiveList)
		if err != nil {
			errMsg := fmt.Sprintf("error reordering participants: %s", err)
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
			return conversationLocal
		}
		utils.AttachContactNames(s.G().MetaContext(ctx), conversationLocal.Info.Participants)
	default:
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			"unknown members type", conversationRemote, unverifiedTLFName,
			chat1.ConversationErrorType_PERMANENT, nil)
		return conversationLocal
	}
	return conversationLocal
}

// Checks fromErr to see if it is a rekey error.
// Returns a ConversationErrorLocal if it is a rekey error.
// Returns nil otherwise.
func (s *localizerPipeline) checkRekeyError(ctx context.Context, fromErr error, conversationRemote chat1.Conversation, unverifiedTLFName string) *chat1.ConversationErrorLocal {
	if fromErr == nil {
		return nil
	}
	convErr, err2 := s.checkRekeyErrorInner(ctx, fromErr, conversationRemote, unverifiedTLFName)
	if err2 != nil {
		errMsg := fmt.Sprintf("failed to get rekey info: convID: %s: %s",
			conversationRemote.Metadata.ConversationID, err2.Error())
		return chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
	}
	if convErr != nil {
		return convErr
	}
	return nil
}

// Checks fromErr to see if it is a rekey error.
// Returns (ConversationErrorRekey, nil) if it is
// Returns (nil, nil) if it is a different kind of error
// Returns (nil, err) if there is an error building the ConversationErrorRekey
func (s *localizerPipeline) checkRekeyErrorInner(ctx context.Context, fromErr error, conversationRemote chat1.Conversation, unverifiedTLFName string) (*chat1.ConversationErrorLocal, error) {
	var rekeyInfo *chat1.ConversationErrorRekey
	var ok bool

	// check for rekey error type
	var convErrTyp chat1.ConversationErrorType
	if convErrTyp, ok = IsRekeyError(fromErr); !ok {
		return nil, nil
	}
	rekeyInfo = &chat1.ConversationErrorRekey{
		TlfName: unverifiedTLFName,
	}

	if len(conversationRemote.MaxMsgSummaries) == 0 {
		return nil, errors.New("can't determine isPrivate with no maxMsgs")
	}
	rekeyInfo.TlfPublic = conversationRemote.MaxMsgSummaries[0].TlfPublic

	// Fill readers and writers
	parts, err := utils.ReorderParticipantsKBFS(
		s.G().MetaContext(ctx),
		s.G(),
		s.G().UIDMapper,
		rekeyInfo.TlfName,
		conversationRemote.Metadata.ActiveList)
	if err != nil {
		return nil, err
	}
	var writerNames []string
	for _, p := range parts {
		writerNames = append(writerNames, p.Username)
	}
	rekeyInfo.WriterNames = writerNames

	// Fill rekeyers list
	myUsername := string(s.G().Env.GetUsername())
	rekeyExcludeSelf := (convErrTyp != chat1.ConversationErrorType_SELFREKEYNEEDED)
	for _, w := range writerNames {
		if rekeyExcludeSelf && w == myUsername {
			// Skip self if self can't rekey.
			continue
		}
		if strings.Contains(w, "@") {
			// Skip assertions. They can't rekey.
			continue
		}
		rekeyInfo.Rekeyers = append(rekeyInfo.Rekeyers, w)
	}

	convErrorLocal := chat1.NewConversationErrorLocal(
		fromErr.Error(), conversationRemote, unverifiedTLFName, convErrTyp, rekeyInfo)
	return convErrorLocal, nil
}
