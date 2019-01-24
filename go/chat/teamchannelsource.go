package chat

import (
	"context"
	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type TeamChannelSource struct {
	globals.Contextified
	utils.DebugLabeler
	memberStatus []chat1.ConversationMemberStatus
}

var _ types.TeamChannelSource = (*TeamChannelSource)(nil)

func NewTeamChannelSource(g *globals.Context) *TeamChannelSource {
	// store this in sorted order so we keep the order consistent for
	// GetInboxQuery which checks the hash of the query to hit the cache.
	memberStatus := chat1.AllConversationMemberStatuses()
	sort.Sort(utils.ByConversationMemberStatus(memberStatus))
	return &TeamChannelSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "TeamChannelSource", false),
		memberStatus: memberStatus,
	}
}

func (c *TeamChannelSource) getTLFConversations(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType) (types.Inbox, error) {
	inbox, err := c.G().InboxSource.ReadUnverified(ctx, uid, true, /* useLocalData */
		&chat1.GetInboxQuery{
			TlfID:            &teamID,
			TopicType:        &topicType,
			SummarizeMaxMsgs: false,
			MemberStatus:     c.memberStatus,
			Existences:       []chat1.ConversationExistence{chat1.ConversationExistence_ACTIVE},
		}, nil /* pagination */)
	return inbox, err
}

func (c *TeamChannelSource) GetChannels(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ConversationLocal, err error) {
	defer c.Trace(ctx, func() error { return err }, "GetChannels")()

	inbox, err := c.getTLFConversations(ctx, uid, teamID, topicType)
	if err != nil {
		return nil, err
	}
	convs, _, err := c.G().InboxSource.Localize(ctx, uid, inbox.ConvsUnverified,
		types.ConversationLocalizerBlocking)
	if err != nil {
		c.Debug(ctx, "GetChannels: failed to localize conversations: %s", err.Error())
		return nil, err
	}
	convs = append(convs, inbox.Convs...)
	sort.Sort(utils.ConvLocalByTopicName(convs))
	c.Debug(ctx, "GetChannels: found %d convs", len(convs))
	return convs, nil
}
