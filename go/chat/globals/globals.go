package globals

import (
	"fmt"
	"regexp"

	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

var DefaultTeamTopic = "general"
var EmojiPattern = regexp.MustCompile(`(?::)([^:\s]+)(?::)`)

type ChatContext struct {
	CtxFactory           types.ContextFactory      // source of verified user info and crypt keys
	InboxSource          types.InboxSource         // source of remote inbox entries for chat
	ConvSource           types.ConversationSource  // source of remote message bodies for chat
	MessageDeliverer     types.MessageDeliverer    // background message delivery service
	ServerCacheVersions  types.ServerCacheVersions // server side versions for chat caches
	RegexpSearcher       types.RegexpSearcher      // For searching chat messages in a conversation via regexp
	Indexer              types.Indexer             // For searching chat messages in the entire inbox
	Syncer               types.Syncer              // For syncing inbox with server
	FetchRetrier         types.FetchRetrier        // For retrying failed fetch requests
	ConvLoader           types.ConvLoader          // background conversation loader
	PushHandler          types.PushHandler         // for handling push notifications from chat server
	TeamChannelSource    types.TeamChannelSource   // source of all channels in a team
	AttachmentURLSrv     types.AttachmentURLSrv    // source of URLs for loading attachments
	EphemeralPurger      types.EphemeralPurger     // triggers background purges of ephemeral chats
	ActivityNotifier     types.ActivityNotifier    // notify clients of chat of new activity
	AttachmentUploader   types.AttachmentUploader  // upload attachments
	NativeVideoHelper    types.NativeVideoHelper   // connection to native for doing things with video
	StellarLoader        types.StellarLoader       // stellar payment/request loader
	StellarSender        types.StellarSender       // stellar in-chat payment sender
	StellarPushHandler   types.OobmHandler
	Unfurler             types.Unfurler                   // unfurl messages with URLs
	CommandsSource       types.ConversationCommandsSource // source for / commands for conversations
	CoinFlipManager      types.CoinFlipManager            // manage /flip games
	JourneyCardManager   types.JourneyCardManager         // manages team journey cards
	TeamMentionLoader    types.TeamMentionLoader          // load potential team mentions
	ExternalAPIKeySource types.ExternalAPIKeySource       // source of third party API keys
	LiveLocationTracker  types.LiveLocationTracker        // track live location messages for updates
	BotCommandManager    types.BotCommandManager          // manages commands from bots in convs
	UIInboxLoader        types.UIInboxLoader              // manages loading inbox for UI
	UIThreadLoader       types.UIThreadLoader             // manages loading threads for UI
	Badger               *badges.Badger                   // app badging
	ParticipantsSource   types.ParticipantSource          // get team participants
	EmojiSource          types.EmojiSource                // emoji support
	EphemeralTracker     types.EphemeralTracker           // tracking of ephemeral msg caches
}

func (c *ChatContext) Describe() string {
	return fmt.Sprintf(`ChatContext{
  CtxFactory: %v,
  InboxSource: %v,
  ConvSource: %v,
  MessageDeliverer: %v,
  ServerCacheVersions: %v,
  RegexpSearcher: %v,
  Indexer: %v,
  Syncer: %v,
  FetchRetrier: %v,
  ConvLoader: %v,
  PushHandler: %v,
  TeamChannelSource: %v,
  AttachmentURLSrv: %v,
  EphemeralPurger: %v,
  ActivityNotifier: %v,
  AttachmentUploader: %v,
  NativeVideoHelper: %v,
  StellarLoader: %v,
  StellarSender: %v,
  StellarPushHandler: %v,
  Unfurler: %v,
  CommandsSource: %v,
  CoinFlipManager: %v,
  JourneyCardManager: %v,
  TeamMentionLoader: %v,
  ExternalAPIKeySource: %v,
  LiveLocationTracker: %v,
  BotCommandManager: %v,
  UIInboxLoader: %v,
  UIThreadLoader: %v,
  Badger: %v,
  ParticipantSource %v,
  EmojiSource: %v
  EphemeralTracker: %v
}`,
		c.CtxFactory != nil,
		c.InboxSource != nil,
		c.ConvSource != nil,
		c.MessageDeliverer != nil,
		c.ServerCacheVersions != nil,
		c.RegexpSearcher != nil,
		c.Indexer != nil,
		c.Syncer != nil,
		c.FetchRetrier != nil,
		c.ConvLoader != nil,
		c.PushHandler != nil,
		c.TeamChannelSource != nil,
		c.AttachmentURLSrv != nil,
		c.EphemeralPurger != nil,
		c.ActivityNotifier != nil,
		c.AttachmentUploader != nil,
		c.NativeVideoHelper != nil,
		c.StellarLoader != nil,
		c.StellarSender != nil,
		c.StellarPushHandler != nil,
		c.Unfurler != nil,
		c.CommandsSource != nil,
		c.CoinFlipManager != nil,
		c.JourneyCardManager != nil,
		c.TeamMentionLoader != nil,
		c.ExternalAPIKeySource != nil,
		c.LiveLocationTracker != nil,
		c.BotCommandManager != nil,
		c.UIInboxLoader != nil,
		c.UIThreadLoader != nil,
		c.Badger != nil,
		c.ParticipantsSource != nil,
		c.EmojiSource != nil,
		c.EphemeralTracker != nil,
	)
}

type Context struct {
	*libkb.GlobalContext
	*ChatContext
}

func (c *Context) ExternalG() *libkb.GlobalContext {
	return c.GlobalContext
}

func NewContext(g *libkb.GlobalContext, c *ChatContext) *Context {
	return &Context{
		GlobalContext: g,
		ChatContext:   c,
	}
}

type Contextified struct {
	gc *Context
}

func NewContextified(gc *Context) Contextified {
	return Contextified{
		gc: gc,
	}
}

func (c *Context) MetaContext(ctx context.Context) libkb.MetaContext {
	return libkb.NewMetaContext(ctx, c.ExternalG())
}

func (c Contextified) G() *Context {
	return c.gc
}

func (c Contextified) MetaContext(ctx context.Context) libkb.MetaContext {
	return libkb.NewMetaContext(ctx, c.G().ExternalG())
}

type ChatContextified struct {
	gc *ChatContext
}

func NewChatContextified(gc *ChatContext) ChatContextified {
	return ChatContextified{
		gc: gc,
	}
}

func (c ChatContextified) ChatG() *ChatContext {
	return c.gc
}
