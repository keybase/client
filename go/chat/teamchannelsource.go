package chat

import (
	"context"
	"sort"

	"github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type CachingTeamChannelSource struct {
	globals.Contextified
	utils.DebugLabeler

	cache *lru.Cache
	ri    func() chat1.RemoteInterface
}

func NewCachingTeamChannelSource(g *globals.Context, ri func() chat1.RemoteInterface) *CachingTeamChannelSource {
	s := &CachingTeamChannelSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "CachingTeamChannelSource", false),
		ri:           ri,
	}
	s.cache = s.newCache()
	return s
}

func (c *CachingTeamChannelSource) newCache() *lru.Cache {
	cc, _ := lru.New(100)
	return cc
}

func (c *CachingTeamChannelSource) key(teamID chat1.TLFID) string {
	return teamID.String()
}

func (c *CachingTeamChannelSource) fetchFromCache(ctx context.Context, teamID chat1.TLFID) (res []chat1.Conversation, ok bool) {
	val, ok := c.cache.Get(c.key(teamID))
	if !ok {
		return res, false
	}
	if res, ok = val.([]chat1.Conversation); !ok {
		return nil, false
	}
	return res, true
}

func (c *CachingTeamChannelSource) writeToCache(ctx context.Context, teamID chat1.TLFID,
	convs []chat1.Conversation) {
	c.cache.Add(c.key(teamID), convs)
}

func (c *CachingTeamChannelSource) invalidate(ctx context.Context, teamID chat1.TLFID) {
	c.cache.Remove(c.key(teamID))
}

func (c *CachingTeamChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID, teamID chat1.TLFID,
	topicType chat1.TopicType, membersType chat1.ConversationMembersType) (res []chat1.ConversationLocal,
	rl []chat1.RateLimit, err error) {
	var ok bool
	var convs []chat1.Conversation
	if convs, ok = c.fetchFromCache(ctx, teamID); !ok {
		tlfRes, err := c.ri().GetTLFConversations(ctx, chat1.GetTLFConversationsArg{
			TlfID:            teamID,
			TopicType:        topicType,
			MembersType:      membersType,
			SummarizeMaxMsgs: false,
		})
		if err != nil {
			return res, rl, err
		}
		if tlfRes.RateLimit != nil {
			rl = append(rl, *tlfRes.RateLimit)
		}
		convs = tlfRes.Conversations

		// Write back to cache
		c.writeToCache(ctx, teamID, convs)
	}

	// Localize the conversations
	res, err = NewBlockingLocalizer(c.G()).Localize(ctx, uid, types.Inbox{
		ConvsUnverified: utils.RemoteConvs(convs),
	})
	if err != nil {
		c.Debug(ctx, "GetTLFConversations: failed to localize conversations: %s", err.Error())
		return res, rl, err
	}
	sort.Sort(utils.ConvLocalByTopicName(res))
	rl = utils.AggRateLimits(rl)
	return res, rl, nil
}

func (c *CachingTeamChannelSource) GetChannelsTopicName(ctx context.Context, uid gregor1.UID,
	teamID chat1.TLFID, topicType chat1.TopicType, membersType chat1.ConversationMembersType) (res []types.ConvIDAndTopicName, rl []chat1.RateLimit, err error) {
	var ok bool
	var convs []chat1.Conversation
	if convs, ok = c.fetchFromCache(ctx, teamID); !ok {
		tlfRes, err := c.ri().GetTLFConversations(ctx, chat1.GetTLFConversationsArg{
			TlfID:            teamID,
			TopicType:        topicType,
			MembersType:      membersType,
			SummarizeMaxMsgs: false,
		})
		if err != nil {
			return res, rl, err
		}
		if tlfRes.RateLimit != nil {
			rl = append(rl, *tlfRes.RateLimit)
		}
		convs = tlfRes.Conversations

		// Write back to cache
		c.writeToCache(ctx, teamID, convs)
	}

	getMetadataMsg := func(conv chat1.Conversation) (chat1.MessageBoxed, bool) {
		for _, msg := range conv.MaxMsgs {
			if msg.GetMessageType() == chat1.MessageType_METADATA {
				return msg, true
			}
		}
		return chat1.MessageBoxed{}, false
	}

	// Find metadata messages in this result and unbox them
	for _, conv := range convs {
		msg, ok := getMetadataMsg(conv)
		if ok {
			unboxeds, err := c.G().ConvSource.GetMessagesWithRemotes(ctx, conv, uid, []chat1.MessageBoxed{msg})
			if err != nil {
				c.Debug(ctx, "GetTLFConversationTopicNames: failed to unbox metadata message for: convID: %s err: %s", conv.GetConvID(), err)
				continue
			}
			if len(unboxeds) != 1 {
				c.Debug(ctx, "GetTLFConversationTopicNames: empty result: convID: %s", conv.GetConvID())
				continue
			}
			unboxed := unboxeds[0]
			if !unboxed.IsValid() {
				c.Debug(ctx, "GetTLFConversationTopicNames: metadata message invalid: convID, %s",
					conv.GetConvID())
				continue
			}
			body := unboxed.Valid().MessageBody
			typ, err := body.MessageType()
			if err != nil {
				c.Debug(ctx, "GetTLFConversationTopicNames: error getting message type: convID, %s",
					conv.GetConvID(), err)
				continue
			}
			if typ != chat1.MessageType_METADATA {
				c.Debug(ctx, "GetTLFConversationTopicNames: message not a real metadata message: convID, %s msgID: %d", conv.GetConvID(), unboxed.GetMessageID())
				continue
			}

			res = append(res, types.ConvIDAndTopicName{
				ConvID:    conv.GetConvID(),
				TopicName: body.Metadata().ConversationTitle,
			})
		}
	}

	return res, rl, nil
}

func (c *CachingTeamChannelSource) ChannelsChanged(ctx context.Context, teamID chat1.TLFID) {
	if len(teamID) == 0 {
		// Clear everything with blank TLF ID
		c.cache = c.newCache()
	} else {
		c.invalidate(ctx, teamID)
	}
}
