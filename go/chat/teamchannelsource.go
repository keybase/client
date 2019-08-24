package chat

import (
	"context"
	"fmt"
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
}

var _ types.TeamChannelSource = (*TeamChannelSource)(nil)

func NewTeamChannelSource(g *globals.Context) *TeamChannelSource {
	return &TeamChannelSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "TeamChannelSource", false),
	}
}

func (c *TeamChannelSource) getTLFConversations(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType) ([]types.RemoteConversation, error) {
	inbox, err := c.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQuery{
			TlfID:            &tlfID,
			TopicType:        &topicType,
			SummarizeMaxMsgs: false,
			MemberStatus:     chat1.AllConversationMemberStatuses(),
			Existences:       []chat1.ConversationExistence{chat1.ConversationExistence_ACTIVE},
			SkipBgLoads:      true,
		}, nil /* pagination */)
	return inbox.ConvsUnverified, err
}

func (c *TeamChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ConversationLocal, err error) {
	defer c.Trace(ctx, func() error { return err },
		fmt.Sprintf("GetChannelsFull: tlfID: %v, topicType: %v", tlfID, topicType))()

	rcs, err := c.getTLFConversations(ctx, uid, tlfID, topicType)
	if err != nil {
		return nil, err
	}
	convs, _, err := c.G().InboxSource.Localize(ctx, uid, rcs, types.ConversationLocalizerBlocking)
	if err != nil {
		c.Debug(ctx, "GetChannelsFull: failed to localize conversations: %s", err.Error())
		return nil, err
	}
	sort.Sort(utils.ConvLocalByTopicName(convs))
	c.Debug(ctx, "GetChannelsFull: found %d convs", len(convs))
	return convs, nil
}

func (c *TeamChannelSource) GetChannelsTopicName(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ChannelNameMention, err error) {
	defer c.Trace(ctx, func() error { return err },
		fmt.Sprintf("GetChannelsTopicName: tlfID: %v, topicType: %v", tlfID, topicType))()

	addValidMetadataMsg := func(convID chat1.ConversationID, msg chat1.MessageUnboxed) {
		if !msg.IsValid() {
			c.Debug(ctx, "GetChannelsTopicName: metadata message invalid: convID, %s", convID)
			return
		}
		body := msg.Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			c.Debug(ctx, "GetChannelsTopicName: error getting message type: convID, %s",
				convID, err)
			return
		}
		if typ != chat1.MessageType_METADATA {
			c.Debug(ctx, "GetChannelsTopicName: message not a real metadata message: convID, %s msgID: %d",
				convID, msg.GetMessageID())
			return
		}
		res = append(res, chat1.ChannelNameMention{
			ConvID:    convID,
			TopicName: body.Metadata().ConversationTitle,
		})
	}

	convs, err := c.getTLFConversations(ctx, uid, tlfID, topicType)
	if err != nil {
		return nil, err
	}
	for _, rc := range convs {
		conv := rc.Conv
		msg, err := conv.GetMaxMessage(chat1.MessageType_METADATA)
		if err != nil {
			continue
		}
		unboxeds, err := c.G().ConvSource.GetMessages(ctx, conv, uid, []chat1.MessageID{msg.GetMessageID()}, nil)
		if err != nil {
			c.Debug(ctx, "GetChannelsTopicName: failed to unbox metadata message for: convID: %s err: %s",
				conv.GetConvID(), err)
			continue
		}
		if len(unboxeds) != 1 {
			c.Debug(ctx, "GetChannelsTopicName: empty result: convID: %s", conv.GetConvID())
			continue
		}
		addValidMetadataMsg(conv.GetConvID(), unboxeds[0])
	}
	return res, nil
}

func (c *TeamChannelSource) GetChannelTopicName(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType, convID chat1.ConversationID) (res string, err error) {
	defer c.Trace(ctx, func() error { return err },
		fmt.Sprintf("GetChannelTopicName: tlfID: %v, topicType: %v, convID: %v", tlfID, topicType, convID))()

	convs, err := c.GetChannelsTopicName(ctx, uid, tlfID, topicType)
	if err != nil {
		return "", err
	}
	if len(convs) == 0 {
		return "", fmt.Errorf("no convs found")
	}
	for _, conv := range convs {
		if conv.ConvID.Eq(convID) {
			return conv.TopicName, nil
		}
	}
	return "", fmt.Errorf("no convs found with conv ID")
}
