package chat

import (
	"context"
	"encoding/json"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ConvDevConversationBackedStorage struct {
	globals.Contextified
	utils.DebugLabeler

	adminOnly bool
	topicType chat1.TopicType
	ri        func() chat1.RemoteInterface
}

var _ types.ConvConversationBackedStorage = &ConvDevConversationBackedStorage{}

func NewConvDevConversationBackedStorage(g *globals.Context, topicType chat1.TopicType, adminOnly bool,
	ri func() chat1.RemoteInterface) *ConvDevConversationBackedStorage {
	return &ConvDevConversationBackedStorage{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "ConvDevConversationBackedStorage", false),
		adminOnly:    adminOnly,
		ri:           ri,
		topicType:    topicType,
	}
}

func (s *ConvDevConversationBackedStorage) getMembersType(conv chat1.ConversationLocal) chat1.ConversationMembersType {
	return conv.GetMembersType()
	/*
		TODO: might need this, not sure
		mt := conv.GetMembersType()
		switch mt {
		case chat1.ConversationMembersType_IMPTEAMUPGRADE:
			return chat1.ConversationMembersType_IMPTEAMNATIVE
		default:
			return mt
		}
	*/
}

func (s *ConvDevConversationBackedStorage) PutToKnownConv(ctx context.Context, uid gregor1.UID,
	conv chat1.ConversationLocal, src interface{}) (err error) {
	if s.adminOnly && !conv.ReaderInfo.UntrustedTeamRole.IsAdminOrAbove() {
		return NewDevStoragePermissionDeniedError(conv.ReaderInfo.UntrustedTeamRole)
	}
	dat, err := json.Marshal(src)
	if err != nil {
		return err
	}
	if _, _, err = NewBlockingSender(s.G(), NewBoxer(s.G()), s.ri).Send(ctx, conv.GetConvID(),
		chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Info.Triple,
				TlfName:     conv.Info.TlfName,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: string(dat),
			}),
		}, 0, nil, nil, nil); err != nil {
		return err
	}
	// only do min writer role stuff for team convs
	if conv.GetMembersType() != chat1.ConversationMembersType_TEAM {
		return nil
	}
	minWriterUnset := conv.ConvSettings == nil ||
		conv.ConvSettings.MinWriterRoleInfo == nil ||
		conv.ConvSettings.MinWriterRoleInfo.Role != keybase1.TeamRole_ADMIN
	if s.adminOnly && minWriterUnset {
		arg := chat1.SetConvMinWriterRoleArg{
			ConvID: conv.Info.Id,
			Role:   keybase1.TeamRole_ADMIN,
		}
		_, err := s.ri().SetConvMinWriterRole(ctx, arg)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *ConvDevConversationBackedStorage) Put(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, name string, src interface{}) (err error) {
	defer s.Trace(ctx, &err, "Put(%s)", name)()

	var conv chat1.ConversationLocal
	baseConv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	tlfname := baseConv.Info.TlfName
	conv, _, err = NewConversation(ctx, s.G(), uid, tlfname, &name, s.topicType,
		s.getMembersType(baseConv), keybase1.TLFVisibility_PRIVATE, nil, s.ri, NewConvFindExistingNormal)
	if err != nil {
		return err
	}
	return s.PutToKnownConv(ctx, uid, conv, src)
}

func (s *ConvDevConversationBackedStorage) GetFromKnownConv(ctx context.Context, uid gregor1.UID,
	conv chat1.ConversationLocal, dest interface{}) (found bool, err error) {
	defer s.Trace(ctx, &err, "GetFromKnownConv(%s)", conv.GetConvID())()
	tv, err := s.G().ConvSource.Pull(ctx, conv.GetConvID(), uid, chat1.GetThreadReason_GENERAL, nil,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, &chat1.Pagination{Num: 1})
	if err != nil {
		return false, err
	}
	if len(tv.Messages) == 0 {
		return false, nil
	}
	msg := tv.Messages[0]
	if !msg.IsValid() {
		return false, nil
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_TEXT) {
		return false, nil
	}

	if conv.GetMembersType() == chat1.ConversationMembersType_TEAM && s.adminOnly {
		if conv.ConvSettings == nil || conv.ConvSettings.MinWriterRoleInfo == nil {
			return false, NewDevStorageAdminOnlyError("no conversation settings")
		}
		if conv.ConvSettings.MinWriterRoleInfo.Role != keybase1.TeamRole_ADMIN {
			return false, NewDevStorageAdminOnlyError("minWriterRole was not admin")
		}
	}
	if err = json.Unmarshal([]byte(body.Text().Body), dest); err != nil {
		return false, err
	}
	if err = JoinConversation(ctx, s.G(), s.DebugLabeler, s.ri, uid, conv.GetConvID()); err != nil {
		return false, err
	}
	return true, nil
}

func (s *ConvDevConversationBackedStorage) Get(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, name string, dest interface{}, createConvIfMissing bool) (found bool, conv *chat1.ConversationLocal, err error) {
	defer s.Trace(ctx, &err, "Get(%s)", name)()

	baseConv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return false, conv, err
	}
	if !createConvIfMissing {
		convs, err := FindConversations(ctx, s.G(), s.DebugLabeler, types.InboxSourceDataSourceAll, s.ri, uid,
			baseConv.Info.TlfName, s.topicType, s.getMembersType(baseConv), keybase1.TLFVisibility_PRIVATE, name,
			nil)
		if err != nil {
			return false, conv, err
		}
		if len(convs) == 0 {
			return false, conv, nil
		}
		conv = &convs[0]
	} else {
		newconv, _, err := NewConversation(ctx, s.G(), uid, baseConv.Info.TlfName, &name, s.topicType,
			s.getMembersType(baseConv), keybase1.TLFVisibility_PRIVATE, nil, s.ri, NewConvFindExistingNormal)
		if err != nil {
			return false, conv, err
		}
		conv = &newconv
	}
	found, err = s.GetFromKnownConv(ctx, uid, *conv, dest)
	return found, conv, err
}
