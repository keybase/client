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
	teamID chat1.TLFID, topicType chat1.TopicType) (types.Inbox, error) {
	inbox, err := c.G().InboxSource.ReadUnverified(ctx, uid, true, /* useLocalData */
		&chat1.GetInboxQuery{
			TlfID:            &teamID,
			TopicType:        &topicType,
			SummarizeMaxMsgs: false,
			MemberStatus:     chat1.AllConversationMemberStatuses(),
		}, nil /* pagination */)
	return inbox, err
}

func (c *TeamChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ConversationLocal, err error) {
	defer c.Trace(ctx, func() error { return err }, "GetChannelsFull", res)()

	inbox, err := c.getTLFConversations(ctx, uid, teamID, topicType)
	if err != nil {
		return nil, err
	}
	convs, _, err := c.G().InboxSource.Localize(ctx, uid, inbox.ConvsUnverified,
		types.ConversationLocalizerBlocking)
	if err != nil {
		c.Debug(ctx, "GetChannelsFull: failed to localize conversations: %s", err.Error())
		return nil, err
	}
	convs = append(convs, inbox.Convs...)
	sort.Sort(utils.ConvLocalByTopicName(convs))
	return convs, nil
}

func (c *TeamChannelSource) GetChannelsTopicName(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType) (res []chat1.ChannelNameMention, err error) {
	defer c.Trace(ctx, func() error { return err }, "GetChannelsTopicName")()

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

	inbox, err := c.getTLFConversations(ctx, uid, teamID, topicType)
	if err != nil {
		return nil, err
	}
	for _, rc := range inbox.ConvsUnverified {
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
	for _, conv := range inbox.Convs {
		msg, err := conv.GetMaxMessage(chat1.MessageType_METADATA)
		if err != nil {
			c.Debug(ctx, "GetChannelsTopicName: failed get metadata max message for: convID: %s err: %s",
				conv.GetConvID(), err)
			continue
		}
		addValidMetadataMsg(conv.GetConvID(), msg)
	}
	return res, nil
}

func (c *TeamChannelSource) GetChannelTopicName(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType, convID chat1.ConversationID) (res string, err error) {
	defer c.Trace(ctx, func() error { return err }, "GetChannelTopicName")()

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
