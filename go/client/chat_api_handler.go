// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

// ErrInvalidOptions is returned when the options aren't valid.
type ErrInvalidOptions struct {
	method  string
	version int
	err     error
}

func (e ErrInvalidOptions) Error() string {
	return fmt.Sprintf("invalid %s v%d options: %s", e.method, e.version, e.err)
}

// Call represents a JSON chat call.
type Call struct {
	Jsonrpc string
	ID      int
	Method  string
	Params  Params
}

// Params represents the `params` portion of the JSON chat call.
type Params struct {
	Version int
	Options json.RawMessage
}

// CallError is the result when there is an error.
type CallError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Reply is returned with the results of procressing a Call.
type Reply struct {
	Jsonrpc string      `json:"jsonrpc,omitempty"`
	ID      int         `json:"id,omitempty"`
	Error   *CallError  `json:"error,omitempty"`
	Result  interface{} `json:"result,omitempty"`
}

// ChatAPIHandler can handle all of the chat json api methods.
type ChatAPIHandler interface {
	ListV1(context.Context, Call, io.Writer) error
	ReadV1(context.Context, Call, io.Writer) error
	SendV1(context.Context, Call, io.Writer) error
}

// ChatServiceHandler can call the service.
type ChatServiceHandler interface {
	ListV1(context.Context) Reply
	ReadV1(context.Context, readOptionsV1) Reply
	SendV1(context.Context, sendOptionsV1) Reply
}

// ChatAPI implements ChatAPIHandler and contains a ChatServiceHandler
// to do all the work.
type ChatAPI struct {
	svcHandler ChatServiceHandler
	indent     bool
}

// ChatChannel represents a channel through which chat happens.
type ChatChannel struct {
	Name      string `json:"name"`
	Public    bool   `json:"public"`
	TopicType string `json:"topic_type,omitempty"`
	TopicName string `json:"topic_name,omitempty"`
}

// Valid returns true if the ChatChannel has at least a Name.
func (c ChatChannel) Valid() bool {
	return len(c.Name) > 0
}

// TopicTypeEnum returns the chat1.TopicType from the TopicType string field.
func (c ChatChannel) TopicTypeEnum() chat1.TopicType {
	if len(c.TopicType) == 0 {
		return chat1.TopicType_CHAT
	}
	tt, ok := chat1.TopicTypeMap[strings.ToUpper(c.TopicType)]
	if ok {
		return tt
	}

	return chat1.TopicType_NONE
}

// ChatMessage represents a text message to be sent.
type ChatMessage struct {
	Body string
}

// Valid returns true if the message has a body.
func (c ChatMessage) Valid() bool {
	return len(c.Body) > 0
}

type sendOptionsV1 struct {
	Channel        ChatChannel
	ConversationID chat1.ConversationID `json:"conversation_id"`
	Message        ChatMessage
}

func (s sendOptionsV1) Check() error {
	if !s.Channel.Valid() {
		return ErrInvalidOptions{version: 1, method: "send", err: errors.New("invalid channel")}
	}
	if !s.Message.Valid() {
		return ErrInvalidOptions{version: 1, method: "send", err: errors.New("invalid message")}
	}

	return nil
}

type readOptionsV1 struct {
	Channel        ChatChannel
	ConversationID chat1.ConversationID `json:"conversation_id"`
	Limit          string
}

func (r readOptionsV1) Check() error {
	if !r.Channel.Valid() && r.ConversationID == 0 {
		return ErrInvalidOptions{version: 1, method: "read", err: errors.New("need channel or conversation_id")}
	}
	if r.Channel.Valid() && r.ConversationID > 0 {
		return ErrInvalidOptions{version: 1, method: "read", err: errors.New("include channel or conversation_id, not both")}
	}

	return nil
}

func (a *ChatAPI) ListV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) != 0 {
		return ErrInvalidOptions{version: 1, method: "list", err: errors.New("unexpected options, should be empty")}
	}

	return a.encodeReply(c, a.svcHandler.ListV1(ctx), w)
}

func (a *ChatAPI) ReadV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: "read", err: errors.New("empty options")}
	}
	var opts readOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for read v1

	return a.encodeReply(c, a.svcHandler.ReadV1(ctx, opts), w)
}

func (a *ChatAPI) SendV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: "send", err: errors.New("empty options")}
	}
	var opts sendOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for send v1

	return a.encodeReply(c, a.svcHandler.SendV1(ctx, opts), w)
}

func (a *ChatAPI) encodeReply(call Call, reply Reply, w io.Writer) error {
	// copy jsonrpc fields from call to reply
	reply.Jsonrpc = call.Jsonrpc
	reply.ID = call.ID

	enc := json.NewEncoder(w)
	if a.indent {
		// XXX put this back in when OS X CI machines using go 1.7...
		// enc.SetIndent("", "\t")
	}
	return enc.Encode(reply)
}
