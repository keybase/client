// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"io"

	"golang.org/x/net/context"
)

type ChatAPIVersionHandler struct {
	handler ChatAPIHandler
}

func NewChatAPIVersionHandler(h ChatAPIHandler) *ChatAPIVersionHandler {
	return &ChatAPIVersionHandler{
		handler: h,
	}
}

func (d *ChatAPIVersionHandler) handle(ctx context.Context, c Call, w io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return d.handleV1(ctx, c, w)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

func (d *ChatAPIVersionHandler) handleV1(ctx context.Context, c Call, w io.Writer) error {
	switch c.Method {
	case methodList:
		return d.handler.ListV1(ctx, c, w)
	case methodRead:
		return d.handler.ReadV1(ctx, c, w)
	case methodSend:
		return d.handler.SendV1(ctx, c, w)
	case methodGet:
		return d.handler.GetV1(ctx, c, w)
	case methodEdit:
		return d.handler.EditV1(ctx, c, w)
	case methodReaction:
		return d.handler.ReactionV1(ctx, c, w)
	case methodDelete:
		return d.handler.DeleteV1(ctx, c, w)
	case methodAttach:
		return d.handler.AttachV1(ctx, c, w)
	case methodDownload:
		return d.handler.DownloadV1(ctx, c, w)
	case methodSetStatus:
		return d.handler.SetStatusV1(ctx, c, w)
	case methodMark:
		return d.handler.MarkV1(ctx, c, w)
	case methodSearchInbox:
		return d.handler.SearchInboxV1(ctx, c, w)
	case methodSearchRegexp:
		return d.handler.SearchRegexpV1(ctx, c, w)
	case methodNewConv:
		return d.handler.NewConvV1(ctx, c, w)
	case methodListConvsOnName:
		return d.handler.ListConvsOnNameV1(ctx, c, w)
	case methodJoin:
		return d.handler.JoinV1(ctx, c, w)
	case methodLeave:
		return d.handler.LeaveV1(ctx, c, w)
	case methodLoadFlip:
		return d.handler.LoadFlipV1(ctx, c, w)
	case methodGetUnfurlSettings:
		return d.handler.GetUnfurlSettingsV1(ctx, c, w)
	case methodSetUnfurlSettings:
		return d.handler.SetUnfurlSettingsV1(ctx, c, w)
	case methodAdvertiseCommands:
		return d.handler.AdvertiseCommandsV1(ctx, c, w)
	case methodClearCommands:
		return d.handler.ClearCommandsV1(ctx, c, w)
	case methodListCommands:
		return d.handler.ListCommandsV1(ctx, c, w)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}
