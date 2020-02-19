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

type TeamDevConversationBackedStorage struct {
	globals.Contextified
	utils.DebugLabeler

	adminOnly bool

	ri func() chat1.RemoteInterface
}

var _ types.TeamConversationBackedStorage = &TeamDevConversationBackedStorage{}

func NewTeamDevConversationBackedStorage(g *globals.Context, adminOnly bool,
	ri func() chat1.RemoteInterface) *TeamDevConversationBackedStorage {
	return &TeamDevConversationBackedStorage{
		Contextified: globals.NewContextified(g),
		adminOnly:    adminOnly,
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "DevConversationBackedStorage", false),
		ri:           ri,
	}
}

func (s *TeamDevConversationBackedStorage) tlfName(ctx context.Context, teamID keybase1.TeamID) (tlfname string, err error) {
	tlfID, err := chat1.TeamIDToTLFID(teamID)
	if err != nil {
		return tlfname, err
	}
	info, err := CreateNameInfoSource(ctx, s.G(), chat1.ConversationMembersType_TEAM).
		LookupName(ctx, tlfID, false /* public */, "")
	if err != nil {
		return tlfname, err
	}
	return info.CanonicalName, nil
}

func (s *TeamDevConversationBackedStorage) Put(ctx context.Context, uid gregor1.UID,
	teamID keybase1.TeamID, name string, src interface{}) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Put(%s)", name)()

	tlfname, err := s.tlfName(ctx, teamID)
	if err != nil {
		return err
	}

	dat, err := json.Marshal(src)
	if err != nil {
		return err
	}

	var conv chat1.ConversationLocal

	// TODO(TRIAGE-1972): NewConversation should return the existing
	// conversation without an error if one already exists, but currently a bug
	// makes it so this doesn't work properly for team conversations one is not
	// in yet. After that bug is fixed, this block can be replaced by just
	// a call to NewConversation.
	convs, err := FindConversations(ctx, s.G(), s.DebugLabeler, types.InboxSourceDataSourceAll, s.ri, uid,
		tlfname, chat1.TopicType_DEV, chat1.ConversationMembersType_TEAM, keybase1.TLFVisibility_PRIVATE, name, nil)
	if err != nil {
		return err
	}
	if len(convs) == 0 {
		conv, _, err = NewConversation(ctx, s.G(), uid, tlfname, &name, chat1.TopicType_DEV,
			chat1.ConversationMembersType_TEAM, keybase1.TLFVisibility_PRIVATE, s.ri, NewConvFindExistingNormal)
		if err != nil {
			return err
		}
	} else {
		conv = convs[0]
	}

	if s.adminOnly && !conv.ReaderInfo.UntrustedTeamRole.IsAdminOrAbove() {
		return NewDevStoragePermissionDeniedError(conv.ReaderInfo.UntrustedTeamRole)
	}
	if _, _, err = NewBlockingSender(s.G(), NewBoxer(s.G()), s.ri).Send(ctx, conv.GetConvID(),
		chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Info.Triple,
				TlfName:     tlfname,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: string(dat),
			}),
		}, 0, nil, nil, nil); err != nil {
		return err
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

func (s *TeamDevConversationBackedStorage) Get(ctx context.Context, uid gregor1.UID,
	teamID keybase1.TeamID, name string, dest interface{}) (found bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "Get(%s)", name)()

	tlfname, err := s.tlfName(ctx, teamID)
	if err != nil {
		return false, err
	}

	convs, err := FindConversations(ctx, s.G(), s.DebugLabeler, types.InboxSourceDataSourceAll, s.ri, uid,
		tlfname, chat1.TopicType_DEV, chat1.ConversationMembersType_TEAM, keybase1.TLFVisibility_PRIVATE, name, nil)
	if err != nil {
		return false, err
	}
	if len(convs) == 0 {
		return false, nil
	}
	conv := convs[0]
	tv, err := s.G().ConvSource.Pull(ctx, conv.GetConvID(), uid, chat1.GetThreadReason_GENERAL,
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
	if s.adminOnly {
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
