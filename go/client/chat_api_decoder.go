// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"io"

	"golang.org/x/net/context"
)

type ErrInvalidMethod struct {
	name    string
	version int
}

func (e ErrInvalidMethod) Error() string {
	return fmt.Sprintf("invalid v%d method %q", e.version, e.name)
}

type ErrInvalidVersion struct {
	version int
}

func (e ErrInvalidVersion) Error() string {
	return fmt.Sprintf("invalid version %d", e.version)
}

type ErrInvalidJSON struct {
	message string
}

func (e ErrInvalidJSON) Error() string {
	return fmt.Sprintf("invalid JSON: %s", e.message)
}

type ChatAPIDecoder struct {
	handler ChatAPIHandler
}

func NewChatAPIDecoder(h ChatAPIHandler) *ChatAPIDecoder {
	return &ChatAPIDecoder{
		handler: h,
	}
}

func (d *ChatAPIDecoder) Decode(ctx context.Context, r io.Reader, w io.Writer) error {
	dec := json.NewDecoder(r)
	for {
		var c Call
		if err := dec.Decode(&c); err == io.EOF {
			break
		} else if err != nil {
			if err == io.ErrUnexpectedEOF {
				return ErrInvalidJSON{message: "expected more JSON in input"}
			}
			return err
		}

		switch c.Params.Version {
		case 0, 1:
			if err := d.handleV1(ctx, c, w); err != nil {
				return err
			}
		default:
			return ErrInvalidVersion{version: c.Params.Version}
		}
	}

	return nil
}

func (d *ChatAPIDecoder) handleV1(ctx context.Context, c Call, w io.Writer) error {
	switch c.Method {
	case methodList:
		return d.handler.ListV1(ctx, c, w)
	case methodRead:
		return d.handler.ReadV1(ctx, c, w)
	case methodSend:
		return d.handler.SendV1(ctx, c, w)
	case methodEdit:
		return d.handler.EditV1(ctx, c, w)
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
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}
