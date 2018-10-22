package chat

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
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

type localizerPipeline struct {
	globals.Contextified
	utils.DebugLabeler

	offline    bool
	superXform supersedesTransform
}

func newLocalizerPipeline(g *globals.Context, superXform supersedesTransform) *localizerPipeline {
	return &localizerPipeline{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "localizerPipeline", false),
		superXform:   superXform,
	}
}
func (s *localizerPipeline) localizeConversationsPipeline(ctx context.Context, uid gregor1.UID,
	convs []chat1.Conversation, maxUnbox *int, localizeCb *chan NonblockInboxResult) ([]chat1.ConversationLocal, error) {

	// Fetch conversation local information in parallel
	type jobRes struct {
		conv  chat1.ConversationLocal
		index int
	}
	type job struct {
		conv  chat1.Conversation
		index int
	}

	if maxUnbox != nil {
		s.Debug(ctx, "pipeline: maxUnbox set to: %d", *maxUnbox)
	}
	eg, ctx := errgroup.WithContext(ctx)
	convCh := make(chan job)
	retCh := make(chan jobRes)
	eg.Go(func() error {
		defer close(convCh)
		for i, conv := range convs {
			if maxUnbox != nil && i >= *maxUnbox {
				s.Debug(ctx, "pipeline: maxUnbox set and reached, early exit: %d",
					*maxUnbox)
				return nil
			}
			select {
			case convCh <- job{conv: conv, index: i}:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		return nil
	})
	nthreads := s.G().Env.GetChatInboxSourceLocalizeThreads()
	s.Debug(ctx, "pipeline: using %d threads", nthreads)
	for i := 0; i < nthreads; i++ {
		eg.Go(func() error {
			for conv := range convCh {
				convLocal := s.localizeConversation(ctx, uid, conv.conv)

				jr := jobRes{
					conv:  convLocal,
					index: conv.index,
				}
				select {
				case retCh <- jr:
				case <-ctx.Done():
					return ctx.Err()
				}

				// If a localize callback channel exists, send along the result as well
				if localizeCb != nil {
					if convLocal.Error != nil {
						s.Debug(ctx, "error localizing: convID: %s err: %s", conv.conv.GetConvID(),
							convLocal.Error.Message)
						*localizeCb <- NonblockInboxResult{
							Err:  convLocal.Error,
							Conv: conv.conv,
						}
					} else {
						*localizeCb <- NonblockInboxResult{
							ConvRes: &convLocal,
							Conv:    conv.conv,
						}
					}
				}
			}
			return nil
		})
	}
	go func() {
		eg.Wait()
		close(retCh)
	}()
	res := make([]chat1.ConversationLocal, len(convs))
	for c := range retCh {
		res[c.index] = c.conv
	}
	if err := eg.Wait(); err != nil {
		return nil, err
	}
	return res, nil
}

func (s *localizerPipeline) isErrPermanent(err error) bool {
	if uberr, ok := err.(UnboxingError); ok {
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
			if newMsg, err = s.superXform.Run(ctx, conversationRemote, uid, []chat1.MessageUnboxed{mm}); err != nil {
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
	case UnboxingError:
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
