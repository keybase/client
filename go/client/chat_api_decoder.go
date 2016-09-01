// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"io"
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

type Call struct {
	Jsonrpc string
	ID      int
	Method  string
	Params  Params
}

type Params struct {
	Version int
	Options json.RawMessage
}

type ChatAPIHandler interface {
	ListV1(Call, io.Writer) error
	ReadV1(Call, io.Writer) error
	SendV1(Call, io.Writer) error
}

type ChatAPIDecoder struct {
	handler ChatAPIHandler
}

func NewChatAPIDecoder(h ChatAPIHandler) *ChatAPIDecoder {
	return &ChatAPIDecoder{
		handler: h,
	}
}

func (d *ChatAPIDecoder) Decode(r io.Reader, w io.Writer) error {
	dec := json.NewDecoder(r)
	for {
		var c Call
		if err := dec.Decode(&c); err == io.EOF {
			break
		} else if err != nil {
			return err
		}

		switch c.Params.Version {
		case 0, 1:
			if err := d.handleV1(c, w); err != nil {
				return err
			}
		default:
			return ErrInvalidVersion{version: c.Params.Version}
		}
	}

	return nil
}

func (d *ChatAPIDecoder) handleV1(c Call, w io.Writer) error {
	switch c.Method {
	case "list":
		return d.handler.ListV1(c, w)
	case "read":
		return d.handler.ReadV1(c, w)
	case "send":
		return d.handler.SendV1(c, w)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}
