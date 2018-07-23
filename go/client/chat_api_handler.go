// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

const (
	methodList         = "list"
	methodRead         = "read"
	methodSend         = "send"
	methodEdit         = "edit"
	methodReaction     = "reaction"
	methodDelete       = "delete"
	methodAttach       = "attach"
	methodDownload     = "download"
	methodSetStatus    = "setstatus"
	methodMark         = "mark"
	methodSearchRegexp = "searchregexp"
)

type RateLimit struct {
	Tank     string `json:"tank"`
	Capacity int    `json:"capacity"`
	Reset    int    `json:"reset"`
	Gas      int    `json:"gas"`
}

type RateLimits struct {
	RateLimits []RateLimit `json:"ratelimits,omitempty"`
}

// ChatAPIHandler can handle all of the chat json api methods.
type ChatAPIHandler interface {
	ListV1(context.Context, Call, io.Writer) error
	ReadV1(context.Context, Call, io.Writer) error
	SendV1(context.Context, Call, io.Writer) error
	EditV1(context.Context, Call, io.Writer) error
	ReactionV1(context.Context, Call, io.Writer) error
	DeleteV1(context.Context, Call, io.Writer) error
	AttachV1(context.Context, Call, io.Writer) error
	DownloadV1(context.Context, Call, io.Writer) error
	SetStatusV1(context.Context, Call, io.Writer) error
	MarkV1(context.Context, Call, io.Writer) error
	SearchRegexpV1(context.Context, Call, io.Writer) error
}

// ChatAPI implements ChatAPIHandler and contains a ChatServiceHandler
// to do all the work.
type ChatAPI struct {
	svcHandler ChatServiceHandler
	indent     bool
}

// ChatChannel represents a channel through which chat happens.
type ChatChannel struct {
	Name        string `json:"name"`
	Public      bool   `json:"public"`
	MembersType string `json:"members_type"`
	TopicType   string `json:"topic_type,omitempty"`
	TopicName   string `json:"topic_name,omitempty"`
}

func (c ChatChannel) IsNil() bool {
	return c == ChatChannel{}
}

// Valid returns true if the ChatChannel has at least a Name.
func (c ChatChannel) Valid() bool {
	if len(c.Name) == 0 {
		return false
	}
	validTyp := false
	if len(c.MembersType) > 0 {
		for typ := range chat1.ConversationMembersTypeMap {
			if strings.ToLower(typ) == c.MembersType {
				validTyp = true
				break
			}
		}
	} else {
		validTyp = true
	}
	return validTyp
}

func (c ChatChannel) GetMembersType(e *libkb.Env) chat1.ConversationMembersType {
	if typ, ok := chat1.ConversationMembersTypeMap[strings.ToUpper(c.MembersType)]; ok {
		return typ
	}
	if e.GetChatMemberType() == "impteam" {
		return chat1.ConversationMembersType_IMPTEAMNATIVE
	}
	return chat1.ConversationMembersType_KBFS
}

// ChatMessage represents a text message to be sent.
type ChatMessage struct {
	Body string
}

// Valid returns true if the message has a body.
func (c ChatMessage) Valid() bool {
	return len(c.Body) > 0
}

type listOptionsV1 struct {
	UnreadOnly  bool   `json:"unread_only,omitempty"`
	TopicType   string `json:"topic_type,omitempty"`
	ShowErrors  bool   `json:"show_errors,omitempty"`
	FailOffline bool   `json:"fail_offline,omitempty"`
}

func (l listOptionsV1) Check() error {
	_, err := TopicTypeFromStrDefault(l.TopicType)
	if err != nil {
		return ErrInvalidOptions{version: 1, method: methodList, err: err}
	}
	return nil
}

type ephemeralLifetime struct {
	time.Duration
}

func (l *ephemeralLifetime) UnmarshalJSON(b []byte) (err error) {
	l.Duration, err = time.ParseDuration(strings.Trim(string(b), `"`))
	return err
}

func (l ephemeralLifetime) MarshalJSON() (b []byte, err error) {
	return []byte(fmt.Sprintf(`"%s"`, l.String())), nil
}

func (l ephemeralLifetime) Valid() bool {
	d := l.Duration
	if d == 0 {
		return true // nil val
	}
	return d <= libkb.MaxEphemeralContentLifetime && d >= libkb.MinEphemeralContentLifetime
}

type sendOptionsV1 struct {
	Channel           ChatChannel
	ConversationID    string `json:"conversation_id"`
	Message           ChatMessage
	Nonblock          bool              `json:"nonblock"`
	MembersType       string            `json:"members_type"`
	EphemeralLifetime ephemeralLifetime `json:"exploding_lifetime"`
}

func (s sendOptionsV1) Check() error {
	if err := checkChannelConv(methodSend, s.Channel, s.ConversationID); err != nil {
		return err
	}
	if !s.Message.Valid() {
		return ErrInvalidOptions{version: 1, method: methodSend, err: errors.New("invalid message")}
	}
	if !s.EphemeralLifetime.Valid() {
		return ErrInvalidOptions{version: 1, method: methodSend, err: errors.New("invalid ephemeral lifetime")}
	}
	return nil
}

type readOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string            `json:"conversation_id"`
	Pagination     *chat1.Pagination `json:"pagination,omitempty"`
	Peek           bool
	UnreadOnly     bool `json:"unread_only"`
	FailOffline    bool `json:"fail_offline"`
}

func (r readOptionsV1) Check() error {
	return checkChannelConv(methodRead, r.Channel, r.ConversationID)
}

type editOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string          `json:"conversation_id"`
	MessageID      chat1.MessageID `json:"message_id"`
	Message        ChatMessage
}

func (e editOptionsV1) Check() error {
	if err := checkChannelConv(methodEdit, e.Channel, e.ConversationID); err != nil {
		return err
	}

	if e.MessageID == 0 {
		return ErrInvalidOptions{version: 1, method: methodEdit, err: errors.New("invalid message id")}
	}

	if !e.Message.Valid() {
		return ErrInvalidOptions{version: 1, method: methodEdit, err: errors.New("invalid message")}
	}

	return nil
}

type reactionOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string          `json:"conversation_id"`
	MessageID      chat1.MessageID `json:"message_id"`
	Message        ChatMessage
}

func (e reactionOptionsV1) Check() error {
	if err := checkChannelConv(methodReaction, e.Channel, e.ConversationID); err != nil {
		return err
	}

	if e.MessageID == 0 {
		return ErrInvalidOptions{version: 1, method: methodReaction, err: errors.New("invalid message id")}
	}

	if !e.Message.Valid() {
		return ErrInvalidOptions{version: 1, method: methodReaction, err: errors.New("invalid message")}
	}

	return nil
}

type deleteOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string          `json:"conversation_id"`
	MessageID      chat1.MessageID `json:"message_id"`
}

func (d deleteOptionsV1) Check() error {
	if err := checkChannelConv(methodDelete, d.Channel, d.ConversationID); err != nil {
		return err
	}

	if d.MessageID == 0 {
		return ErrInvalidOptions{version: 1, method: methodDelete, err: errors.New("invalid message id")}
	}

	return nil
}

type attachOptionsV1 struct {
	Channel           ChatChannel
	ConversationID    string `json:"conversation_id"`
	Filename          string
	Preview           string
	Title             string
	EphemeralLifetime ephemeralLifetime `json:"exploding_lifetime"`
	Nonblock          bool
}

func (a attachOptionsV1) Check() error {
	if err := checkChannelConv(methodAttach, a.Channel, a.ConversationID); err != nil {
		return err
	}
	if len(strings.TrimSpace(a.Filename)) == 0 {
		return ErrInvalidOptions{version: 1, method: methodAttach, err: errors.New("empty filename")}
	}
	if !a.EphemeralLifetime.Valid() {
		return ErrInvalidOptions{version: 1, method: methodAttach, err: errors.New("invalid ephemeral lifetime")}
	}
	return nil
}

type downloadOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string          `json:"conversation_id"`
	MessageID      chat1.MessageID `json:"message_id"`
	Output         string
	Preview        bool
	NoStream       bool
}

func (a downloadOptionsV1) Check() error {
	if err := checkChannelConv(methodDownload, a.Channel, a.ConversationID); err != nil {
		return err
	}
	if a.MessageID == 0 {
		return ErrInvalidOptions{version: 1, method: methodDownload, err: errors.New("invalid message id")}
	}
	if len(strings.TrimSpace(a.Output)) == 0 {
		return ErrInvalidOptions{version: 1, method: methodDownload, err: errors.New("empty output filename")}
	}

	return nil
}

type setStatusOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string `json:"conversation_id"`
	Status         string `json:"status"`
}

func (o setStatusOptionsV1) Check() error {
	if err := checkChannelConv(methodSetStatus, o.Channel, o.ConversationID); err != nil {
		return err
	}
	if _, ok := chat1.ConversationStatusMap[strings.ToUpper(o.Status)]; !ok {
		return ErrInvalidOptions{version: 1, method: methodSetStatus, err: fmt.Errorf("unsupported status: '%v'", o.Status)}
	}

	return nil
}

type markOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string          `json:"conversation_id"`
	MessageID      chat1.MessageID `json:"message_id"`
}

func (o markOptionsV1) Check() error {
	return checkChannelConv(methodMark, o.Channel, o.ConversationID)
}

type searchRegexpOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string `json:"conversation_id"`
	Query          string `json:"query"`
	IsRegex        bool   `json:"is_regex"`
	MaxHits        int    `json:"max_hits"`
	MaxMessages    int    `json:"max_messages"`
	BeforeContext  int    `json:"before_context"`
	AfterContext   int    `json:"after_context"`
}

func (o searchRegexpOptionsV1) Check() error {
	if err := checkChannelConv(methodSearchRegexp, o.Channel, o.ConversationID); err != nil {
		return err
	}
	if o.Query == "" {
		return errors.New("query required")
	}
	query := o.Query
	if !o.IsRegex {
		query = regexp.QuoteMeta(o.Query)
	}
	if _, err := regexp.Compile(query); err != nil {
		return err
	}
	return nil
}

func (a *ChatAPI) ListV1(ctx context.Context, c Call, w io.Writer) error {
	var opts listOptionsV1
	// Options are optional for list
	if len(c.Params.Options) != 0 {
		if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
			return err
		}
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for list v1

	return a.encodeReply(c, a.svcHandler.ListV1(ctx, opts), w)
}

func (a *ChatAPI) ReadV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodRead, err: errors.New("empty options")}
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
		return ErrInvalidOptions{version: 1, method: methodSend, err: errors.New("empty options")}
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

func (a *ChatAPI) EditV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodEdit, err: errors.New("empty options")}
	}
	var opts editOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for edit v1

	return a.encodeReply(c, a.svcHandler.EditV1(ctx, opts), w)
}

func (a *ChatAPI) ReactionV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodReaction, err: errors.New("empty options")}
	}
	var opts reactionOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for reaction v1

	return a.encodeReply(c, a.svcHandler.ReactionV1(ctx, opts), w)
}

func (a *ChatAPI) DeleteV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodDelete, err: errors.New("empty options")}
	}
	var opts deleteOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for delete v1

	return a.encodeReply(c, a.svcHandler.DeleteV1(ctx, opts), w)
}

func (a *ChatAPI) AttachV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodAttach, err: errors.New("empty options")}
	}
	var opts attachOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for attach v1

	return a.encodeReply(c, a.svcHandler.AttachV1(ctx, opts), w)
}

func (a *ChatAPI) DownloadV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodDownload, err: errors.New("empty options")}
	}
	var opts downloadOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for download v1

	return a.encodeReply(c, a.svcHandler.DownloadV1(ctx, opts), w)
}

func (a *ChatAPI) SetStatusV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodSetStatus, err: errors.New("empty options")}
	}
	var opts setStatusOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for setstatus v1

	return a.encodeReply(c, a.svcHandler.SetStatusV1(ctx, opts), w)
}

func (a *ChatAPI) MarkV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodMark, err: errors.New("empty options")}
	}
	var opts markOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for mark v1

	return a.encodeReply(c, a.svcHandler.MarkV1(ctx, opts), w)
}

func (a *ChatAPI) SearchRegexpV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodSearchRegexp, err: errors.New("empty options")}
	}
	var opts searchRegexpOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for search v1

	return a.encodeReply(c, a.svcHandler.SearchRegexpV1(ctx, opts), w)
}

func (a *ChatAPI) encodeReply(call Call, reply Reply, w io.Writer) error {
	// copy jsonrpc fields from call to reply
	reply.Jsonrpc = call.Jsonrpc
	reply.ID = call.ID

	enc := json.NewEncoder(w)
	if a.indent {
		enc.SetIndent("", "    ")
	}
	return enc.Encode(reply)
}

func checkChannelConv(method string, channel ChatChannel, convID string) error {
	if !channel.Valid() && len(convID) == 0 {
		return ErrInvalidOptions{version: 1, method: method, err: errors.New("need channel or conversation_id")}
	}
	if channel.Valid() && len(convID) > 0 {
		return ErrInvalidOptions{version: 1, method: method, err: errors.New("include channel or conversation_id, not both")}
	}
	return nil
}
