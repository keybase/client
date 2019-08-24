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

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

const (
	methodList              = "list"
	methodRead              = "read"
	methodGet               = "get"
	methodSend              = "send"
	methodEdit              = "edit"
	methodReaction          = "reaction"
	methodDelete            = "delete"
	methodAttach            = "attach"
	methodDownload          = "download"
	methodSetStatus         = "setstatus"
	methodMark              = "mark"
	methodSearchInbox       = "searchinbox"
	methodSearchRegexp      = "searchregexp"
	methodNewConv           = "newconv"
	methodListConvsOnName   = "listconvsonname"
	methodJoin              = "join"
	methodLeave             = "leave"
	methodLoadFlip          = "loadflip"
	methodGetUnfurlSettings = "getunfurlsettings"
	methodSetUnfurlSettings = "setunfurlsettings"
	methodAdvertiseCommands = "advertisecommands"
	methodClearCommands     = "clearcommands"
	methodListCommands      = "listcommands"
)

// ChatAPIHandler can handle all of the chat json api methods.
type ChatAPIHandler interface {
	ListV1(context.Context, Call, io.Writer) error
	ReadV1(context.Context, Call, io.Writer) error
	GetV1(context.Context, Call, io.Writer) error
	SendV1(context.Context, Call, io.Writer) error
	EditV1(context.Context, Call, io.Writer) error
	ReactionV1(context.Context, Call, io.Writer) error
	DeleteV1(context.Context, Call, io.Writer) error
	AttachV1(context.Context, Call, io.Writer) error
	DownloadV1(context.Context, Call, io.Writer) error
	SetStatusV1(context.Context, Call, io.Writer) error
	MarkV1(context.Context, Call, io.Writer) error
	SearchInboxV1(context.Context, Call, io.Writer) error
	SearchRegexpV1(context.Context, Call, io.Writer) error
	NewConvV1(context.Context, Call, io.Writer) error
	ListConvsOnNameV1(context.Context, Call, io.Writer) error
	JoinV1(context.Context, Call, io.Writer) error
	LeaveV1(context.Context, Call, io.Writer) error
	LoadFlipV1(context.Context, Call, io.Writer) error
	GetUnfurlSettingsV1(context.Context, Call, io.Writer) error
	SetUnfurlSettingsV1(context.Context, Call, io.Writer) error
	AdvertiseCommandsV1(context.Context, Call, io.Writer) error
	ClearCommandsV1(context.Context, Call, io.Writer) error
	ListCommandsV1(context.Context, Call, io.Writer) error
}

// ChatAPI implements ChatAPIHandler and contains a ChatServiceHandler
// to do all the work.
type ChatAPI struct {
	svcHandler ChatServiceHandler
	indent     bool
}

// ChatChannel represents a channel through which chat happens.
type ChatChannel chat1.ChatChannel

func (c ChatChannel) IsNil() bool {
	return c == ChatChannel{}
}

// Valid returns true if the ChatChannel has at least a Name.
func (c ChatChannel) Valid() bool {
	if len(c.Name) == 0 {
		return false
	}
	if len(c.MembersType) > 0 && !isValidMembersType(c.MembersType) {
		return false
	}
	return true
}

func (c ChatChannel) Visibility() (vis keybase1.TLFVisibility) {
	vis = keybase1.TLFVisibility_PRIVATE
	if c.Public {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	return vis
}

func (c ChatChannel) GetMembersType(e *libkb.Env) chat1.ConversationMembersType {
	return MembersTypeFromStrDefault(c.MembersType, e)
}

func isValidMembersType(mt string) bool {
	for typ := range chat1.ConversationMembersTypeMap {
		if strings.ToLower(typ) == mt {
			return true
		}
	}
	return false
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
	UnreadOnly  bool              `json:"unread_only,omitempty"`
	TopicType   string            `json:"topic_type,omitempty"`
	ShowErrors  bool              `json:"show_errors,omitempty"`
	FailOffline bool              `json:"fail_offline,omitempty"`
	Pagination  *chat1.Pagination `json:"pagination,omitempty"`
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
	ConfirmLumenSend  bool              `json:"confirm_lumen_send"`
	ReplyTo           *chat1.MessageID  `json:"reply_to"`
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

type getOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string            `json:"conversation_id"`
	MessageIDs     []chat1.MessageID `json:"message_ids"`
	Peek           bool
	FailOffline    bool `json:"fail_offline"`
}

func (r getOptionsV1) Check() error {
	return checkChannelConv(methodGet, r.Channel, r.ConversationID)
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

type searchOptionsV1 struct {
	SentBy         string `json:"sent_by"`
	SentTo         string `json:"sent_to"`
	SentBefore     string `json:"sent_before"`
	SentAfter      string `json:"sent_after"`
	MaxHits        int    `json:"max_hits"`
	BeforeContext  int    `json:"before_context"`
	AfterContext   int    `json:"after_context"`
	Channel        ChatChannel
	ConversationID string `json:"conversation_id"`
}

type searchInboxOptionsV1 struct {
	searchOptionsV1
	Query        string `json:"query"`
	ForceReindex bool   `json:"force_reindex"`
}

func (o searchInboxOptionsV1) Check() error {
	// conversation info is optional
	if o.Channel.Valid() || len(o.ConversationID) > 0 {
		if err := checkChannelConv(methodSearchRegexp, o.Channel, o.ConversationID); err != nil {
			return err
		}
	}
	if o.Query == "" {
		return errors.New("query required")
	}
	return nil
}

type searchRegexpOptionsV1 struct {
	searchOptionsV1
	Query       string `json:"query"`
	IsRegex     bool   `json:"is_regex"`
	MaxMessages int    `json:"max_messages"`
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

type newConvOptionsV1 struct {
	Channel ChatChannel
}

func (o newConvOptionsV1) Check() error {
	if err := checkChannelConv(methodNewConv, o.Channel, ""); err != nil {
		return err
	}
	return nil
}

type listConvsOnNameOptionsV1 struct {
	Name        string `json:"name,omitempty"`
	MembersType string `json:"members_type,omitempty"`
	TopicType   string `json:"topic_type,omitempty"`
}

func (o listConvsOnNameOptionsV1) Check() error {
	if len(o.Name) == 0 {
		return errors.New("name required")
	}
	if len(o.MembersType) > 0 && !isValidMembersType(o.MembersType) {
		return errors.New("invalid members type")
	}
	return nil
}

type joinOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string `json:"conversation_id"`
}

func (o joinOptionsV1) Check() error {
	if err := checkChannelConv(methodNewConv, o.Channel, o.ConversationID); err != nil {
		return err
	}
	return nil
}

type leaveOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string `json:"conversation_id"`
}

func (o leaveOptionsV1) Check() error {
	if err := checkChannelConv(methodNewConv, o.Channel, o.ConversationID); err != nil {
		return err
	}
	return nil
}

type loadFlipOptionsV1 struct {
	ConversationID     string          `json:"conversation_id"`
	FlipConversationID string          `json:"flip_conversation_id"`
	MsgID              chat1.MessageID `json:"msg_id"`
	GameID             string          `json:"game_id"`
}

func (o loadFlipOptionsV1) Check() error {
	if len(o.ConversationID) == 0 {
		return ErrInvalidOptions{
			version: 1,
			method:  methodLoadFlip,
			err:     errors.New("missing conversation ID"),
		}
	}
	if len(o.FlipConversationID) == 0 {
		return ErrInvalidOptions{
			version: 1,
			method:  methodLoadFlip,
			err:     errors.New("missing flip conversation ID"),
		}
	}
	if o.MsgID == 0 {
		return ErrInvalidOptions{
			version: 1,
			method:  methodLoadFlip,
			err:     errors.New("missing flip message ID"),
		}
	}
	if len(o.GameID) == 0 {
		return ErrInvalidOptions{
			version: 1,
			method:  methodLoadFlip,
			err:     errors.New("missing flip game ID"),
		}
	}
	return nil
}

type setUnfurlSettingsOptionsV1 struct {
	Mode      string
	Whitelist []string
	intMode   chat1.UnfurlMode
}

func (o setUnfurlSettingsOptionsV1) Check() error {
	if val, ok := chat1.UnfurlModeMap[strings.ToUpper(o.Mode)]; ok {
		o.intMode = val
	} else {
		return ErrInvalidOptions{
			version: 1,
			method:  methodSetUnfurlSettings,
			err:     errors.New("invalid unfurl mode"),
		}
	}
	return nil
}

type advertisementParam struct {
	Typ      string `json:"type"`
	Commands []chat1.UserBotCommandInput
	TeamName string `json:"team_name,omitempty"`
}

type advertiseCommandsOptionsV1 struct {
	Alias          string `json:"alias,omitempty"`
	Advertisements []advertisementParam
}

func (a advertiseCommandsOptionsV1) Check() error {
	if len(a.Advertisements) == 0 {
		return errors.New("must specify at least one commands advertiement")
	}
	for _, c := range a.Advertisements {
		if len(c.Commands) == 0 {
			return errors.New("must specify at least one command in each advertisement")
		}
	}
	return nil
}

type listCommandsOptionsV1 struct {
	Channel        ChatChannel
	ConversationID string `json:"conversation_id"`
}

func (o listCommandsOptionsV1) Check() error {
	if err := checkChannelConv(methodListCommands, o.Channel, o.ConversationID); err != nil {
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

func (a *ChatAPI) GetV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodRead, err: errors.New("empty options")}
	}
	var opts getOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for get v1
	return a.encodeReply(c, a.svcHandler.GetV1(ctx, opts), w)
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
	chatUI := NewChatAPIUI(AllowStellarPayments(opts.ConfirmLumenSend))
	return a.encodeReply(c, a.svcHandler.SendV1(ctx, opts, chatUI), w)
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
	return a.encodeReply(c, a.svcHandler.AttachV1(ctx, opts, NewChatAPIUI(), NewChatAPINotifications()), w)
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

	return a.encodeReply(c, a.svcHandler.DownloadV1(ctx, opts, NewChatAPIUI()), w)
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

func (a *ChatAPI) SearchInboxV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodSearchInbox, err: errors.New("empty options")}
	}
	var opts searchInboxOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}

	// opts are valid for search inbox v1

	return a.encodeReply(c, a.svcHandler.SearchInboxV1(ctx, opts), w)
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

	// opts are valid for search regexp v1

	return a.encodeReply(c, a.svcHandler.SearchRegexpV1(ctx, opts), w)
}

func (a *ChatAPI) NewConvV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodNewConv, err: errors.New("empty options")}
	}
	var opts newConvOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}
	return a.encodeReply(c, a.svcHandler.NewConvV1(ctx, opts), w)
}

func (a *ChatAPI) ListConvsOnNameV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodListConvsOnName, err: errors.New("empty options")}
	}
	var opts listConvsOnNameOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}
	return a.encodeReply(c, a.svcHandler.ListConvsOnNameV1(ctx, opts), w)
}

func (a *ChatAPI) JoinV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodJoin, err: errors.New("empty options")}
	}
	var opts joinOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}
	return a.encodeReply(c, a.svcHandler.JoinV1(ctx, opts), w)
}

func (a *ChatAPI) LeaveV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodLeave, err: errors.New("empty options")}
	}
	var opts leaveOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}
	return a.encodeReply(c, a.svcHandler.LeaveV1(ctx, opts), w)
}

func (a *ChatAPI) LoadFlipV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodLoadFlip, err: errors.New("empty options")}
	}
	var opts loadFlipOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}
	return a.encodeReply(c, a.svcHandler.LoadFlipV1(ctx, opts), w)
}

func (a *ChatAPI) GetUnfurlSettingsV1(ctx context.Context, c Call, w io.Writer) error {
	return a.encodeReply(c, a.svcHandler.GetUnfurlSettingsV1(ctx), w)
}

func (a *ChatAPI) SetUnfurlSettingsV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodSetUnfurlSettings,
			err: errors.New("empty options")}
	}
	var opts setUnfurlSettingsOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}
	return a.encodeReply(c, a.svcHandler.SetUnfurlSettingsV1(ctx, opts), w)
}

func (a *ChatAPI) AdvertiseCommandsV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodAdvertiseCommands,
			err: errors.New("empty options")}
	}
	var opts advertiseCommandsOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}
	return a.encodeReply(c, a.svcHandler.AdvertiseCommandsV1(ctx, opts), w)
}

func (a *ChatAPI) ClearCommandsV1(ctx context.Context, c Call, w io.Writer) error {
	return a.encodeReply(c, a.svcHandler.ClearCommandsV1(ctx), w)
}

func (a *ChatAPI) ListCommandsV1(ctx context.Context, c Call, w io.Writer) error {
	if len(c.Params.Options) == 0 {
		return ErrInvalidOptions{version: 1, method: methodListCommands,
			err: errors.New("empty options")}
	}
	var opts listCommandsOptionsV1
	if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
		return err
	}
	if err := opts.Check(); err != nil {
		return err
	}
	return a.encodeReply(c, a.svcHandler.ListCommandsV1(ctx, opts), w)
}

func (a *ChatAPI) encodeReply(call Call, reply Reply, w io.Writer) error {
	return encodeReply(call, reply, w, a.indent)
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
