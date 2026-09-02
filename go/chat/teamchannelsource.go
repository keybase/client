package chat

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type recentJoinsCacheItem struct {
	numJoins int
	mtime    gregor1.Time
}

type recentJoinsMemCache struct {
	sync.RWMutex
	cache map[chat1.ConvIDStr]recentJoinsCacheItem
}

func newRecentJoinsMemCache() *recentJoinsMemCache {
	return &recentJoinsMemCache{
		cache: make(map[chat1.ConvIDStr]recentJoinsCacheItem),
	}
}

func (i *recentJoinsMemCache) Get(convID chat1.ConversationID) int {
	i.RLock()
	defer i.RUnlock()
	if item, ok := i.cache[convID.ConvIDStr()]; ok {
		if time.Since(item.mtime.Time()) > time.Hour {
			delete(i.cache, convID.ConvIDStr())
			return -1
		}
		return item.numJoins
	}
	return -1
}

func (i *recentJoinsMemCache) Put(convID chat1.ConversationID, numJoins int) {
	i.Lock()
	defer i.Unlock()
	i.cache[convID.ConvIDStr()] = recentJoinsCacheItem{
		numJoins: numJoins,
		mtime:    gregor1.ToTime(time.Now()),
	}
}

func (i *recentJoinsMemCache) clearCache() {
	i.Lock()
	defer i.Unlock()
	i.cache = make(map[chat1.ConvIDStr]recentJoinsCacheItem)
}

func (i *recentJoinsMemCache) OnLogout(mctx libkb.MetaContext) error {
	i.clearCache()
	return nil
}

func (i *recentJoinsMemCache) OnDbNuke(mctx libkb.MetaContext) error {
	i.clearCache()
	return nil
}

type lastActiveAtCacheItem struct {
	lastActiveAt gregor1.Time
	mtime        gregor1.Time
}

type lastActiveAtMemCache struct {
	sync.RWMutex
	// key: teamID||uid
	cache map[string]lastActiveAtCacheItem
}

func newLastActiveAtMemCache() *lastActiveAtMemCache {
	return &lastActiveAtMemCache{
		cache: make(map[string]lastActiveAtCacheItem),
	}
}

func (i *lastActiveAtMemCache) key(teamID keybase1.TeamID, uid gregor1.UID) string {
	return fmt.Sprintf("%s:%s", teamID, uid)
}

func (i *lastActiveAtMemCache) Get(teamID keybase1.TeamID, uid gregor1.UID) (gregor1.Time, bool) {
	i.RLock()
	defer i.RUnlock()
	if item, ok := i.cache[i.key(teamID, uid)]; ok {
		if time.Since(item.mtime.Time()) > time.Hour {
			delete(i.cache, i.key(teamID, uid))
			return 0, false
		}
		return item.lastActiveAt, true
	}
	return 0, false
}

func (i *lastActiveAtMemCache) Put(teamID keybase1.TeamID, uid gregor1.UID, lastActiveAt gregor1.Time) {
	i.Lock()
	defer i.Unlock()
	i.cache[i.key(teamID, uid)] = lastActiveAtCacheItem{
		lastActiveAt: lastActiveAt,
		mtime:        gregor1.ToTime(time.Now()),
	}
}

func (i *lastActiveAtMemCache) clearCache() {
	i.Lock()
	defer i.Unlock()
	i.cache = make(map[string]lastActiveAtCacheItem)
}

func (i *lastActiveAtMemCache) OnLogout(mctx libkb.MetaContext) error {
	i.clearCache()
	return nil
}

func (i *lastActiveAtMemCache) OnDbNuke(mctx libkb.MetaContext) error {
	i.clearCache()
	return nil
}

type topicNameCacheItem struct {
	names []chat1.ChannelNameMention
	mtime gregor1.Time
}

// Channel-name resolution is charged per message: every message body holding a `#token` sends
// ParseChannelNameMentions here, and the uncached path reads the inbox and then fetches the METADATA
// message of every channel in the team. Unboxing one page of a busy channel in a team with a few
// dozen channels therefore cost thousands of single-message fetches.
//
// There is no invalidation hook, so the TTL is the only thing bounding staleness, and it is kept
// short for that reason - a page's worth of resolutions all land within milliseconds of each other,
// so seconds are enough to collapse them into one.
//
// Note also that an incomplete result is still returned to the caller, just not cached - so a
// resolution committed during a degraded read (right after a nuke, say) is missing channels no
// matter what this cache does. That is pre-existing, and the same persistence applies:
//
// Be aware of what the TTL does NOT heal. The result of a resolution is stored, not just displayed:
// it becomes MessageUnboxedValid.ChannelNameMentions (see boxer.go) and is written to local storage
// with the message. So a message unboxed during the window that a newly created or renamed channel
// is missing from the cache keeps the stale resolution after the entry expires, until that message
// happens to be unboxed again. Expiry heals later resolutions, not ones already committed. Widening
// this duration widens that hole; if it ever needs to grow, wire up real invalidation first.
const topicNameCacheDuration = 10 * time.Second

type topicNameMemCache struct {
	sync.RWMutex
	// key: tlfID||topicType||uid
	cache map[string]topicNameCacheItem
}

func newTopicNameMemCache() *topicNameMemCache {
	return &topicNameMemCache{
		cache: make(map[string]topicNameCacheItem),
	}
}

func (i *topicNameMemCache) key(tlfID chat1.TLFID, topicType chat1.TopicType, uid gregor1.UID) string {
	return fmt.Sprintf("%s:%v:%s", tlfID, topicType, uid)
}

func (i *topicNameMemCache) Get(tlfID chat1.TLFID, topicType chat1.TopicType, uid gregor1.UID) ([]chat1.ChannelNameMention, bool) {
	i.RLock()
	defer i.RUnlock()
	item, ok := i.cache[i.key(tlfID, topicType, uid)]
	if !ok || time.Since(item.mtime.Time()) > topicNameCacheDuration {
		return nil, false
	}
	// Hand back a copy: callers own what they get, and this slice is shared.
	return append([]chat1.ChannelNameMention(nil), item.names...), true
}

func (i *topicNameMemCache) Put(tlfID chat1.TLFID, topicType chat1.TopicType, uid gregor1.UID, names []chat1.ChannelNameMention) {
	i.Lock()
	defer i.Unlock()
	i.cache[i.key(tlfID, topicType, uid)] = topicNameCacheItem{
		names: append([]chat1.ChannelNameMention(nil), names...),
		mtime: gregor1.ToTime(time.Now()),
	}
}

func (i *topicNameMemCache) clearCache() {
	i.Lock()
	defer i.Unlock()
	i.cache = make(map[string]topicNameCacheItem)
}

func (i *topicNameMemCache) OnLogout(mctx libkb.MetaContext) error {
	i.clearCache()
	return nil
}

func (i *topicNameMemCache) OnDbNuke(mctx libkb.MetaContext) error {
	i.clearCache()
	return nil
}

type TeamChannelSource struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler
	recentJoinsCache  *recentJoinsMemCache
	lastActiveAtCache *lastActiveAtMemCache
	topicNameCache    *topicNameMemCache
}

var _ types.TeamChannelSource = (*TeamChannelSource)(nil)

func NewTeamChannelSource(g *globals.Context) *TeamChannelSource {
	return &TeamChannelSource{
		Contextified:      globals.NewContextified(g),
		DebugLabeler:      utils.NewDebugLabeler(g.ExternalG(), "TeamChannelSource", false),
		recentJoinsCache:  newRecentJoinsMemCache(),
		lastActiveAtCache: newLastActiveAtMemCache(),
		topicNameCache:    newTopicNameMemCache(),
	}
}

func (c *TeamChannelSource) OnLogout(mctx libkb.MetaContext) error {
	epick := libkb.FirstErrorPicker{}
	epick.Push(c.recentJoinsCache.OnLogout(mctx))
	epick.Push(c.lastActiveAtCache.OnLogout(mctx))
	epick.Push(c.topicNameCache.OnLogout(mctx))
	return epick.Error()
}

func (c *TeamChannelSource) OnDbNuke(mctx libkb.MetaContext) error {
	epick := libkb.FirstErrorPicker{}
	epick.Push(c.recentJoinsCache.OnDbNuke(mctx))
	epick.Push(c.lastActiveAtCache.OnDbNuke(mctx))
	epick.Push(c.topicNameCache.OnDbNuke(mctx))
	return epick.Error()
}

func (c *TeamChannelSource) getTLFConversations(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType,
) ([]types.RemoteConversation, error) {
	inbox, err := c.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQuery{
			TlfID:            &tlfID,
			TopicType:        &topicType,
			SummarizeMaxMsgs: false,
			MemberStatus:     chat1.AllConversationMemberStatuses(),
			Existences:       []chat1.ConversationExistence{chat1.ConversationExistence_ACTIVE},
			SkipBgLoads:      true,
		})
	return inbox.ConvsUnverified, err
}

func (c *TeamChannelSource) GetLastActiveForTLF(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType,
) (res gregor1.Time, err error) {
	defer c.Trace(ctx, &err,
		"GetLastActiveForTLF: tlfID: %v, topicType: %v", tlfID, topicType)()

	rcs, err := c.getTLFConversations(ctx, uid, tlfID, topicType)
	if err != nil {
		return 0, err
	}
	sort.Sort(utils.RemoteConvByMtime(rcs))
	if len(rcs) > 0 {
		return utils.GetConvMtime(rcs[0]), nil
	}
	return 0, nil
}

func (c *TeamChannelSource) GetLastActiveForTeams(ctx context.Context, uid gregor1.UID, topicType chat1.TopicType) (
	res chat1.LastActiveTimeAll, err error,
) {
	ctx = globals.CtxModifyUnboxMode(ctx, types.UnboxModeQuick)
	defer c.Trace(ctx, &err,
		"GetLastActiveForTeams: topicType: %v", topicType)()

	inbox, err := c.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQuery{
			TopicType:        &topicType,
			SummarizeMaxMsgs: false,
			MemberStatus:     chat1.AllConversationMemberStatuses(),
			Existences:       []chat1.ConversationExistence{chat1.ConversationExistence_ACTIVE},
			MembersTypes:     []chat1.ConversationMembersType{chat1.ConversationMembersType_TEAM},
			SkipBgLoads:      true,
		})
	byTLFID := make(map[chat1.TLFIDStr][]types.RemoteConversation)
	channels := make(map[chat1.ConvIDStr]gregor1.Time, len(inbox.ConvsUnverified))
	for _, conv := range inbox.ConvsUnverified {
		rc := conv
		tlfID := rc.Conv.Metadata.IdTriple.Tlfid.TLFIDStr()
		byTLFID[tlfID] = append(byTLFID[tlfID], rc)
		channels[rc.ConvIDStr] = utils.GetConvMtime(rc)
	}
	teams := make(map[chat1.TLFIDStr]gregor1.Time, len(byTLFID))
	for tlfID, rcs := range byTLFID {
		sort.Sort(utils.RemoteConvByMtime(rcs))
		teams[tlfID] = channels[rcs[0].ConvIDStr]
	}
	res.Teams = teams
	res.Channels = channels
	return res, nil
}

func (c *TeamChannelSource) GetChannelsFull(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType,
) (res []chat1.ConversationLocal, err error) {
	ctx = globals.CtxModifyUnboxMode(ctx, types.UnboxModeQuick)
	defer c.Trace(ctx, &err,
		"GetChannelsFull: tlfID: %v, topicType: %v", tlfID, topicType)()

	rcs, err := c.getTLFConversations(ctx, uid, tlfID, topicType)
	if err != nil {
		return nil, err
	}
	for _, rc := range rcs {
		c.G().ParticipantsSource.GetWithNotifyNonblock(ctx, uid, rc.GetConvID(),
			types.InboxSourceDataSourceAll)
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
	tlfID chat1.TLFID, topicType chat1.TopicType,
) (res []chat1.ChannelNameMention, err error) {
	// Before the trace: this runs once per message body holding a `#token`, which reaches hundreds
	// per second while paging a busy channel, and tracing a hit costs two log lines apiece. Safe
	// because DebugLabeler.trace is pure logging - no context checks, no error handling. Note the
	// misses below still fan out concurrently on a cold cache; this collapses the steady state, not
	// the initial burst.
	if cached, ok := c.topicNameCache.Get(tlfID, topicType, uid); ok {
		return cached, nil
	}
	ctx = globals.CtxModifyUnboxMode(ctx, types.UnboxModeQuick)
	defer c.Trace(ctx, &err,
		"GetChannelsTopicName: tlfID: %v, topicType: %v", tlfID, topicType)()

	addValidMetadataMsg := func(convID chat1.ConversationID, msg chat1.MessageUnboxed) bool {
		if !msg.IsValid() {
			c.Debug(ctx, "GetChannelsTopicName: metadata message invalid: convID, %s", convID)
			return false
		}
		body := msg.Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			c.Debug(ctx, "GetChannelsTopicName: error getting message type: convID, %s",
				convID, err)
			return false
		}
		if typ != chat1.MessageType_METADATA {
			c.Debug(ctx, "GetChannelsTopicName: message not a real metadata message: convID, %s msgID: %d",
				convID, msg.GetMessageID())
			return false
		}
		res = append(res, chat1.ChannelNameMention{
			ConvID:    convID,
			TopicName: body.Metadata().ConversationTitle,
		})
		return true
	}

	convs, err := c.getTLFConversations(ctx, uid, tlfID, topicType)
	if err != nil {
		return nil, err
	}
	// Any channel we fail to resolve makes the result incomplete, and an incomplete result must not
	// be cached: it would pin a degraded answer for the whole window. This matters most right after
	// a db nuke, when local storage holds no METADATA messages yet and most of these fail.
	complete := true
	for _, rc := range convs {
		conv := rc.Conv
		msg, err := conv.GetMaxMessage(chat1.MessageType_METADATA)
		if err != nil {
			complete = false
			continue
		}
		unboxeds, err := c.G().ConvSource.GetMessages(ctx, conv.GetConvID(), uid,
			[]chat1.MessageID{msg.GetMessageID()}, nil, nil, false)
		if err != nil {
			c.Debug(ctx, "GetChannelsTopicName: failed to unbox metadata message for: convID: %s err: %s",
				conv.GetConvID(), err)
			complete = false
			continue
		}
		if len(unboxeds) != 1 {
			c.Debug(ctx, "GetChannelsTopicName: empty result: convID: %s", conv.GetConvID())
			complete = false
			continue
		}
		if !addValidMetadataMsg(conv.GetConvID(), unboxeds[0]) {
			complete = false
		}
	}
	// len(convs) == 0 is never a legitimate answer - a chat TLF always has at least #general - so it
	// means the inbox read came back degraded, and caching it would pin "this team has no channels"
	// for the whole window.
	if complete && len(convs) > 0 {
		c.topicNameCache.Put(tlfID, topicType, uid, res)
	} else {
		c.Debug(ctx, "GetChannelsTopicName: incomplete result (%d of %d channels), not caching",
			len(res), len(convs))
	}
	return res, nil
}

func (c *TeamChannelSource) GetChannelTopicName(ctx context.Context, uid gregor1.UID,
	tlfID chat1.TLFID, topicType chat1.TopicType, convID chat1.ConversationID,
) (res string, err error) {
	ctx = globals.CtxModifyUnboxMode(ctx, types.UnboxModeQuick)
	defer c.Trace(ctx, &err,
		"GetChannelTopicName: tlfID: %v, topicType: %v, convID: %v", tlfID, topicType, convID)()

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
	return "", fmt.Errorf("no convs found with convID")
}

func (c *TeamChannelSource) GetRecentJoins(ctx context.Context, convID chat1.ConversationID, remoteClient chat1.RemoteInterface) (res int, err error) {
	defer c.Trace(ctx, &err, "GetRecentJoins")()

	numJoins := c.recentJoinsCache.Get(convID)
	if numJoins < 0 {
		res, err := remoteClient.GetRecentJoins(ctx, convID)
		if err != nil {
			return 0, err
		}
		numJoins = res.NumJoins
		c.recentJoinsCache.Put(convID, numJoins)
	}
	return numJoins, nil
}

func (c *TeamChannelSource) GetLastActiveAt(ctx context.Context, teamID keybase1.TeamID, uid gregor1.UID,
	remoteClient chat1.RemoteInterface,
) (res gregor1.Time, err error) {
	defer c.Trace(ctx, &err, "GetLastActiveAt")()

	lastActiveAt, found := c.lastActiveAtCache.Get(teamID, uid)
	if !found {
		res, err := remoteClient.GetLastActiveAt(ctx, chat1.GetLastActiveAtArg{
			TeamID: teamID,
			Uid:    uid,
		})
		if err != nil {
			return 0, err
		}
		lastActiveAt = res.LastActiveAt
		c.lastActiveAtCache.Put(teamID, uid, lastActiveAt)
	}
	return lastActiveAt, nil
}
