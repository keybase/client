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
	Searcher            types.Searcher            // For searching chat messages
	Syncer              types.Syncer              // For syncing inbox with server
	FetchRetrier        types.FetchRetrier        // For retrying failed fetch requests
	ConvLoader          types.ConvLoader          // background conversation loader
	PushHandler         types.PushHandler         // for handling push notifications from chat server
	TeamChannelSource   types.TeamChannelSource   // source of all channels in a team
	AttachmentURLSrv    types.AttachmentURLSrv    // source of URLs for loading attachments
	EphemeralPurger     types.EphemeralPurger     // triggers background purges of ephemeral chats
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
