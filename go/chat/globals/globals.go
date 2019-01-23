package globals

import (
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type ChatContext struct {
	InboxSource         types.InboxSource         // source of remote inbox entries for chat
	ConvSource          types.ConversationSource  // source of remote message bodies for chat
	MessageDeliverer    types.MessageDeliverer    // background message delivery service
	ServerCacheVersions types.ServerCacheVersions // server side versions for chat caches
	RegexpSearcher      types.RegexpSearcher      // For searching chat messages in a conversation via regexp
	Indexer             types.Indexer             // For searching chat messages in the entire inbox
	Syncer              types.Syncer              // For syncing inbox with server
	FetchRetrier        types.FetchRetrier        // For retrying failed fetch requests
	ConvLoader          types.ConvLoader          // background conversation loader
	PushHandler         types.PushHandler         // for handling push notifications from chat server
	TeamChannelSource   types.TeamChannelSource   // source of all channels in a team
	AttachmentURLSrv    types.AttachmentURLSrv    // source of URLs for loading attachments
	EphemeralPurger     types.EphemeralPurger     // triggers background purges of ephemeral chats
	ActivityNotifier    types.ActivityNotifier    // notify clients of chat of new activity
	AttachmentUploader  types.AttachmentUploader  // upload attachments
	NativeVideoHelper   types.NativeVideoHelper   // connection to native for doing things with video
	StellarLoader       types.StellarLoader       // stellar payment/request loader
	StellarSender       types.StellarSender       // stellar in-chat payment sender
	StellarPushHandler  types.OobmHandler
	Unfurler            types.Unfurler                   // unfurl messages with URLs
	CommandsSource      types.ConversationCommandsSource // source for / commands for conversations
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

var DefaultTeamTopic = "general"
