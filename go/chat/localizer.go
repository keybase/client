package chat

import (
	"context"
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
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/client/go/uidmap"
	"golang.org/x/sync/errgroup"
)

type conversationLocalizer interface {
	Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox, maxLocalize *int) ([]chat1.ConversationLocal, error)
	Name() string
}

type localizerCancelableKeyTyp int

var localizerCancelableKey localizerCancelableKeyTyp

func makeLocalizerCancelableContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, localizerCancelableKey, true)
}

func isLocalizerCancelableContext(ctx context.Context) bool {
	val := ctx.Value(localizerCancelableKey)
	if _, ok := val.(bool); ok {
		return true
	}
	return false
}

type baseLocalizer struct {
	globals.Contextified
	utils.DebugLabeler
	pipeline *localizerPipeline
}

func newBaseLocalizer(g *globals.Context, pipeline *localizerPipeline) *baseLocalizer {
	return &baseLocalizer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "baseLocalizer", false),
		pipeline:     pipeline,
	}
}

func (b *baseLocalizer) filterSelfFinalized(ctx context.Context, inbox types.Inbox) (res types.Inbox) {
	username := b.G().Env.GetUsername().String()
	res = inbox
	res.ConvsUnverified = nil
	for _, conv := range inbox.ConvsUnverified {
		if conv.Conv.IsSelfFinalized(username) {
			b.Debug(ctx, "baseLocalizer: skipping own finalized convo: %s name: %s", conv.GetConvID())
			continue
		}
		res.ConvsUnverified = append(res.ConvsUnverified, conv)
	}
	return res
}

func (b *baseLocalizer) getConvs(inbox types.Inbox, maxLocalize *int) []chat1.Conversation {
	convs := utils.PluckConvs(inbox.ConvsUnverified)
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
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "blockingLocalizer", false),
		baseLocalizer: newBaseLocalizer(g, pipeline),
		localizeCb:    localizeCb,
	}
}

func (b *blockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox,
	maxLocalize *int) (res []chat1.ConversationLocal, err error) {
	defer b.Trace(ctx, func() error { return err }, "Localize")()
	inbox = b.filterSelfFinalized(ctx, inbox)
	convs := b.getConvs(inbox, maxLocalize)
	b.baseLocalizer.pipeline.queue(ctx, uid, convs, b.localizeCb)

	res = make([]chat1.ConversationLocal, len(convs))
	indexMap := make(map[string]int)
	for index, c := range convs {
		indexMap[c.GetConvID().String()] = index
	}
	for ar := range b.localizeCb {
		res[indexMap[ar.ConvLocal.GetConvID().String()]] = ar.ConvLocal
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
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "nonBlockingLocalizer", false),
		baseLocalizer: newBaseLocalizer(g, pipeline),
		localizeCb:    localizeCb,
	}
}

func (b *nonBlockingLocalizer) filterInboxRes(ctx context.Context, inbox types.Inbox, uid gregor1.UID) types.Inbox {
	defer b.Trace(ctx, func() error { return nil }, "filterInboxRes")()
	// Loop through and look for empty convs or known errors and skip them
	var res []types.RemoteConversation
	for _, conv := range inbox.ConvsUnverified {
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
		Pagination:      inbox.Pagination,
	}
}

func (b *nonBlockingLocalizer) Localize(ctx context.Context, uid gregor1.UID, inbox types.Inbox,
	maxLocalize *int) (res []chat1.ConversationLocal, err error) {
	defer b.Trace(ctx, func() error { return err }, "Localize")()
	// Run some easy filters for empty messages and known errors to optimize UI drawing behavior
	inbox = b.filterSelfFinalized(ctx, inbox)
	filteredInbox := b.filterInboxRes(ctx, inbox, uid)
	// Send inbox over localize channel
	b.localizeCb <- types.AsyncInboxResult{
		InboxRes: &filteredInbox,
	}
	// Spawn off localization into its own goroutine and use cb to communicate with outside world
	bctx := BackgroundContext(ctx, b.G())
	go func() {
		b.Debug(bctx, "Localize: starting background localization: convs: %d", len(inbox.ConvsUnverified))
		b.baseLocalizer.pipeline.queue(bctx, uid, b.getConvs(inbox, maxLocalize), b.localizeCb)
	}()
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
	pending   []chat1.Conversation

	// testing
	gateCh chan struct{}
}

func (l *localizerPipelineJob) retry(g *globals.Context) (res *localizerPipelineJob) {
	l.Lock()
	defer l.Unlock()
	res = new(localizerPipelineJob)
	res.ctx, res.cancelFn = context.WithCancel(BackgroundContext(l.ctx, g))
	res.retCh = l.retCh
	res.uid = l.uid
	res.completed = l.completed
	res.pending = make([]chat1.Conversation, len(l.pending))
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

func (l *localizerPipelineJob) getPending() (res []chat1.Conversation) {
	l.Lock()
	defer l.Unlock()
	res = make([]chat1.Conversation, len(l.pending))
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
	convs []chat1.Conversation, retCh chan types.AsyncInboxResult) *localizerPipelineJob {
	return &localizerPipelineJob{
		ctx:     BackgroundContext(ctx, g),
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

	started   bool
	stopCh    chan struct{}
	cancelChs map[string]chan struct{}
	suspendWg sync.WaitGroup
	jobQueue  chan *localizerPipelineJob

	// testing
	useGateCh   bool
	jobPulledCh chan *localizerPipelineJob
}

func newLocalizerPipeline(g *globals.Context) *localizerPipeline {
	return &localizerPipeline{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "localizerPipeline", false),
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

func (s *localizerPipeline) queue(ctx context.Context, uid gregor1.UID, convs []chat1.Conversation,
	retCh chan types.AsyncInboxResult) {
	defer s.Trace(ctx, func() error { return nil }, "queue")()
	s.Lock()
	defer s.Unlock()
	job := newLocalizerPipelineJob(ctx, s.G(), uid, convs, retCh)
	job.ctx, job.cancelFn = context.WithCancel(BackgroundContext(ctx, s.G()))
	if isLocalizerCancelableContext(job.ctx) {
		s.Debug(job.ctx, "queue: adding cancellable job")
	}
	s.jobQueue <- job
}

func (s *localizerPipeline) clearQueue() {
	s.jobQueue = make(chan *localizerPipelineJob, 100)
}

func (s *localizerPipeline) start(ctx context.Context) {
	s.Lock()
	defer s.Unlock()
	s.Debug(ctx, "start")
	if s.started {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
	}
	s.clearQueue()
	s.started = true
	go s.localizeLoop()
}

func (s *localizerPipeline) stop(ctx context.Context) chan struct{} {
	s.Lock()
	defer s.Unlock()
	s.Debug(ctx, "stop")
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
	s.suspendWg.Add(1)
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
	if isLocalizerCancelableContext(ctx) {
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
	s.suspendWg.Done()
	return false
}

func (s *localizerPipeline) localizeJobPulled(job *localizerPipelineJob, stopCh chan struct{}) {
	id, cancelCh := s.registerJobPull(job.ctx)
	defer s.finishJobPull(id)
	s.Debug(job.ctx, "localizeJobPulled: pulling job: pending: %d completed: %d", job.numPending(),
		job.numCompleted())
	waitCh := make(chan struct{})
	if !isLocalizerCancelableContext(job.ctx) {
		close(waitCh)
	} else {
		s.Debug(job.ctx, "localizeJobPulled: waiting for resume")
		go func() {
			s.suspendWg.Wait()
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
	pending := localizeJob.getPending()
	if len(pending) == 0 {
		return nil
	}
	convCh := make(chan chat1.Conversation, len(pending))
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
				s.Debug(ctx, "localizeConversations: localizing: %d convID: %s", index, conv.GetConvID())
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
						conv.GetConvID(), convLocal.Error.Message)
				}
				localizeJob.retCh <- types.AsyncInboxResult{
					ConvLocal: convLocal,
					Conv:      conv,
				}
			}
			return nil
		})
	}
	go func() {
		eg.Wait()
		close(retCh)
	}()
	for convID := range retCh {
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

func (s *localizerPipeline) getMessagesOffline(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageSummary, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, chat1.ConversationErrorType, error) {

	st := storage.New(s.G(), s.G().ConvSource)
	res, err := st.FetchMessages(ctx, convID, uid, utils.PluckMessageIDs(msgs))
	if err != nil {
		// Just say we didn't find it in this case
		return nil, chat1.ConversationErrorType_TRANSIENT, err
	}

	// Make sure we got legit msgs
	var foundMsgs []chat1.MessageUnboxed
	for _, msg := range res {
		if msg != nil {
			foundMsgs = append(foundMsgs, *msg)
		}
	}

	if len(foundMsgs) == 0 {
		return nil, chat1.ConversationErrorType_TRANSIENT, errors.New("missing messages locally")
	}

	return foundMsgs, chat1.ConversationErrorType_NONE, nil
}

func (s *localizerPipeline) getMinWriterRoleInfoLocal(ctx context.Context, info *chat1.ConversationMinWriterRoleInfo) *chat1.ConversationMinWriterRoleInfoLocal {
	if info == nil {
		return nil
	}
	username := ""
	name, err := s.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(info.Uid.String()))
	if err == nil {
		username = name.String()
	}
	return &chat1.ConversationMinWriterRoleInfoLocal{
		Role:     info.Role,
		Username: username,
	}
}

func (s *localizerPipeline) getConvSettingsLocal(ctx context.Context, conv chat1.Conversation) (res *chat1.ConversationSettingsLocal) {
	settings := conv.ConvSettings
	if settings == nil {
		return nil
	}
	res = &chat1.ConversationSettingsLocal{}
	res.MinWriterRoleInfo = s.getMinWriterRoleInfoLocal(ctx, settings.MinWriterRoleInfo)
	return res

}

func (s *localizerPipeline) getResetUserNames(ctx context.Context, uidMapper libkb.UIDMapper,
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
		s.Debug(ctx, "getResetUserNames: failed to run uid mapper: %s", err)
		return res
	}
	for _, row := range rows {
		res = append(res, row.NormalizedUsername.String())
	}
	return res
}

func (s *localizerPipeline) localizeConversation(ctx context.Context, uid gregor1.UID,
	conversationRemote chat1.Conversation) (conversationLocal chat1.ConversationLocal) {

	// Pick a source of usernames based on offline status, if we are offline then just use a
	// type that just returns errors all the time (this will just use TLF name as the ordering)
	var umapper libkb.UIDMapper
	if s.offline {
		umapper = &uidmap.OfflineUIDMap{}
	} else {
		umapper = s.G().UIDMapper
	}

	unverifiedTLFName := getUnverifiedTlfNameForErrors(conversationRemote)
	s.Debug(ctx, "localizing: TLF: %s convID: %s offline: %v vis: %v", unverifiedTLFName,
		conversationRemote.GetConvID(), s.offline, conversationRemote.Metadata.Visibility)

	conversationLocal.Info = chat1.ConversationInfoLocal{
		Id:           conversationRemote.Metadata.ConversationID,
		Visibility:   conversationRemote.Metadata.Visibility,
		Triple:       conversationRemote.Metadata.IdTriple,
		Status:       conversationRemote.Metadata.Status,
		MembersType:  conversationRemote.Metadata.MembersType,
		MemberStatus: conversationRemote.ReaderInfo.Status,
		TeamType:     conversationRemote.Metadata.TeamType,
		Version:      conversationRemote.Metadata.Version,
	}
	conversationLocal.Info.FinalizeInfo = conversationRemote.Metadata.FinalizeInfo
	for _, super := range conversationRemote.Metadata.Supersedes {
		conversationLocal.Supersedes = append(conversationLocal.Supersedes, super)
	}
	for _, super := range conversationRemote.Metadata.SupersededBy {
		conversationLocal.SupersededBy = append(conversationLocal.SupersededBy, super)
	}
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
	conversationLocal.ConvSettings = s.getConvSettingsLocal(ctx, conversationRemote)

	if len(conversationRemote.MaxMsgSummaries) == 0 {
		errMsg := "conversation has an empty MaxMsgSummaries field"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
	}

	conversationLocal.IsEmpty = utils.IsConvEmpty(conversationRemote)
	errTyp := chat1.ConversationErrorType_PERMANENT
	if len(conversationRemote.MaxMsgs) == 0 {
		// Fetch max messages unboxed, using either a custom function or through
		// the conversation source configured in the global context
		var err error
		var msgs []chat1.MessageUnboxed
		if s.offline {
			msgs, errTyp, err = s.getMessagesOffline(ctx, conversationRemote.GetConvID(),
				uid, conversationRemote.MaxMsgSummaries, conversationRemote.Metadata.FinalizeInfo)
		} else {
			msgs, err = s.G().ConvSource.GetMessages(ctx, conversationRemote,
				uid, utils.PluckMessageIDs(conversationRemote.MaxMsgSummaries), nil)
			if !s.isErrPermanent(err) {
				errTyp = chat1.ConversationErrorType_TRANSIENT
			}
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
		conversationLocal.MaxMessages = msgs
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
		conversationLocal.MaxMessages = msgs
	}

	var maxValidID chat1.MessageID
	var newMaxMsgs []chat1.MessageUnboxed
	superXform := newBasicSupersedesTransform(s.G(), basicSupersedesTransformOpts{})
	for _, mm := range conversationLocal.MaxMessages {
		if mm.IsValid() {
			body := mm.Valid().MessageBody
			typ, err := body.MessageType()
			if err != nil {
				s.Debug(ctx, "failed to get message type: convID: %s id: %d",
					conversationRemote.Metadata.ConversationID, mm.GetMessageID())
				continue
			}
			if typ == chat1.MessageType_METADATA {
				conversationLocal.Info.TopicName = body.Metadata().ConversationTitle
			}

			if mm.GetMessageID() >= maxValidID {
				conversationLocal.Info.TlfName = mm.Valid().ClientHeader.TlfName
				maxValidID = mm.GetMessageID()
			}

			conversationLocal.Info.Triple = mm.Valid().ClientHeader.Conv

			// Resolve edits/deletes
			var newMsg []chat1.MessageUnboxed
			if newMsg, err = superXform.Run(ctx, conversationRemote, uid, []chat1.MessageUnboxed{mm}); err != nil {
				s.Debug(ctx, "failed to transform message: id: %d err: %s", mm.GetMessageID(),
					err.Error())
			} else {
				if len(newMsg) > 0 {
					newMaxMsgs = append(newMaxMsgs, newMsg[0])
				} else {
					newMaxMsgs = append(newMaxMsgs, mm)
				}
			}
		}
	}
	conversationLocal.MaxMessages = newMaxMsgs
	if len(conversationLocal.Info.TlfName) == 0 {
		errMsg := "no valid message in the conversation"
		conversationLocal.Error = chat1.NewConversationErrorLocal(
			errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
		return conversationLocal
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

	infoSource := CreateNameInfoSource(ctx, s.G(), conversationLocal.GetMembersType())
	var info *types.NameInfo
	var ierr error
	switch conversationRemote.GetMembersType() {
	case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAMNATIVE:
		info, ierr = infoSource.LookupName(ctx,
			conversationLocal.Info.Triple.Tlfid,
			conversationLocal.Info.Visibility == keybase1.TLFVisibility_PUBLIC)
	default:
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

	// Form the writers name list, either from the active list + TLF name, or from the
	// channel information for a team chat
	switch conversationRemote.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		var kuids []keybase1.UID
		for _, uid := range conversationRemote.Metadata.AllList {
			kuids = append(kuids, keybase1.UID(uid.String()))
		}
		conversationLocal.Info.ResetNames = s.getResetUserNames(ctx, umapper, conversationRemote)
		rows, err := umapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, time.Hour*24,
			10*time.Second, true)
		if err != nil {
			s.Debug(ctx, "localizeConversation: UIDMapper returned an error: %s", err)
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
		conversationLocal.Info.ResetNames = s.getResetUserNames(ctx, umapper, conversationRemote)
		fallthrough
	case chat1.ConversationMembersType_KBFS:
		var err error
		conversationLocal.Info.Participants, err = utils.ReorderParticipants(
			s.G().MetaContext(ctx),
			s.G(),
			umapper,
			conversationLocal.Info.TlfName,
			conversationRemote.Metadata.ActiveList)
		if err != nil {
			errMsg := fmt.Sprintf("error reordering participants: %v", err.Error())
			conversationLocal.Error = chat1.NewConversationErrorLocal(
				errMsg, conversationRemote, unverifiedTLFName, chat1.ConversationErrorType_TRANSIENT, nil)
			return conversationLocal
		}
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
	convErrTyp := chat1.ConversationErrorType_TRANSIENT
	var rekeyInfo *chat1.ConversationErrorRekey

	switch fromErr := fromErr.(type) {
	case types.UnboxingError:
		switch conversationRemote.GetMembersType() {
		case chat1.ConversationMembersType_KBFS:
			switch fromErr := fromErr.Inner().(type) {
			case libkb.NeedSelfRekeyError:
				convErrTyp = chat1.ConversationErrorType_SELFREKEYNEEDED
				rekeyInfo = &chat1.ConversationErrorRekey{
					TlfName: fromErr.Tlf,
				}
			case libkb.NeedOtherRekeyError:
				convErrTyp = chat1.ConversationErrorType_OTHERREKEYNEEDED
				rekeyInfo = &chat1.ConversationErrorRekey{
					TlfName: fromErr.Tlf,
				}
			}
		default:
			if teams.IsTeamReadError(fromErr.Inner()) {
				convErrTyp = chat1.ConversationErrorType_OTHERREKEYNEEDED
				rekeyInfo = &chat1.ConversationErrorRekey{
					TlfName: unverifiedTLFName,
				}
			}
		}
	}
	if rekeyInfo == nil {
		// Not a rekey error.
		return nil, nil
	}

	if len(conversationRemote.MaxMsgSummaries) == 0 {
		return nil, errors.New("can't determine isPrivate with no maxMsgs")
	}
	rekeyInfo.TlfPublic = conversationRemote.MaxMsgSummaries[0].TlfPublic

	// Fill readers and writers
	parts, err := utils.ReorderParticipants(
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
