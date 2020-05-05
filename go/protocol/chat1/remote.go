// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/remote.avdl

package chat1

import (
	"errors"
	"fmt"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type MessageBoxed struct {
	Version          MessageBoxedVersion  `codec:"version" json:"version"`
	ServerHeader     *MessageServerHeader `codec:"serverHeader,omitempty" json:"serverHeader,omitempty"`
	ClientHeader     MessageClientHeader  `codec:"clientHeader" json:"clientHeader"`
	HeaderCiphertext SealedData           `codec:"headerCiphertext" json:"headerCiphertext"`
	BodyCiphertext   EncryptedData        `codec:"bodyCiphertext" json:"bodyCiphertext"`
	VerifyKey        []byte               `codec:"verifyKey" json:"verifyKey"`
	KeyGeneration    int                  `codec:"keyGeneration" json:"keyGeneration"`
}

func (o MessageBoxed) DeepCopy() MessageBoxed {
	return MessageBoxed{
		Version: o.Version.DeepCopy(),
		ServerHeader: (func(x *MessageServerHeader) *MessageServerHeader {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ServerHeader),
		ClientHeader:     o.ClientHeader.DeepCopy(),
		HeaderCiphertext: o.HeaderCiphertext.DeepCopy(),
		BodyCiphertext:   o.BodyCiphertext.DeepCopy(),
		VerifyKey: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.VerifyKey),
		KeyGeneration: o.KeyGeneration,
	}
}

type MessageBoxedVersion int

const (
	MessageBoxedVersion_VNONE MessageBoxedVersion = 0
	MessageBoxedVersion_V1    MessageBoxedVersion = 1
	MessageBoxedVersion_V2    MessageBoxedVersion = 2
	MessageBoxedVersion_V3    MessageBoxedVersion = 3
	MessageBoxedVersion_V4    MessageBoxedVersion = 4
)

func (o MessageBoxedVersion) DeepCopy() MessageBoxedVersion { return o }

var MessageBoxedVersionMap = map[string]MessageBoxedVersion{
	"VNONE": 0,
	"V1":    1,
	"V2":    2,
	"V3":    3,
	"V4":    4,
}

var MessageBoxedVersionRevMap = map[MessageBoxedVersion]string{
	0: "VNONE",
	1: "V1",
	2: "V2",
	3: "V3",
	4: "V4",
}

func (e MessageBoxedVersion) String() string {
	if v, ok := MessageBoxedVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ThreadViewBoxed struct {
	Messages   []MessageBoxed `codec:"messages" json:"messages"`
	Pagination *Pagination    `codec:"pagination,omitempty" json:"pagination,omitempty"`
}

func (o ThreadViewBoxed) DeepCopy() ThreadViewBoxed {
	return ThreadViewBoxed{
		Messages: (func(x []MessageBoxed) []MessageBoxed {
			if x == nil {
				return nil
			}
			ret := make([]MessageBoxed, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Messages),
		Pagination: (func(x *Pagination) *Pagination {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pagination),
	}
}

type GetInboxRemoteRes struct {
	Inbox     InboxView  `codec:"inbox" json:"inbox"`
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetInboxRemoteRes) DeepCopy() GetInboxRemoteRes {
	return GetInboxRemoteRes{
		Inbox: o.Inbox.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetInboxByTLFIDRemoteRes struct {
	Convs     []Conversation `codec:"convs" json:"convs"`
	RateLimit *RateLimit     `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetInboxByTLFIDRemoteRes) DeepCopy() GetInboxByTLFIDRemoteRes {
	return GetInboxByTLFIDRemoteRes{
		Convs: (func(x []Conversation) []Conversation {
			if x == nil {
				return nil
			}
			ret := make([]Conversation, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Convs),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetThreadRemoteRes struct {
	Thread      ThreadViewBoxed         `codec:"thread" json:"thread"`
	MembersType ConversationMembersType `codec:"membersType" json:"membersType"`
	Visibility  keybase1.TLFVisibility  `codec:"visibility" json:"visibility"`
	RateLimit   *RateLimit              `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetThreadRemoteRes) DeepCopy() GetThreadRemoteRes {
	return GetThreadRemoteRes{
		Thread:      o.Thread.DeepCopy(),
		MembersType: o.MembersType.DeepCopy(),
		Visibility:  o.Visibility.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetConversationMetadataRemoteRes struct {
	Conv      Conversation `codec:"conv" json:"conv"`
	RateLimit *RateLimit   `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetConversationMetadataRemoteRes) DeepCopy() GetConversationMetadataRemoteRes {
	return GetConversationMetadataRemoteRes{
		Conv: o.Conv.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type PostRemoteRes struct {
	MsgHeader MessageServerHeader `codec:"msgHeader" json:"msgHeader"`
	RateLimit *RateLimit          `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o PostRemoteRes) DeepCopy() PostRemoteRes {
	return PostRemoteRes{
		MsgHeader: o.MsgHeader.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type NewConversationRemoteRes struct {
	ConvID             ConversationID `codec:"convID" json:"convID"`
	CreatedComplexTeam bool           `codec:"createdComplexTeam" json:"createdComplexTeam"`
	RateLimit          *RateLimit     `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o NewConversationRemoteRes) DeepCopy() NewConversationRemoteRes {
	return NewConversationRemoteRes{
		ConvID:             o.ConvID.DeepCopy(),
		CreatedComplexTeam: o.CreatedComplexTeam,
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetMessagesRemoteRes struct {
	Msgs        []MessageBoxed          `codec:"msgs" json:"msgs"`
	MembersType ConversationMembersType `codec:"membersType" json:"membersType"`
	Visibility  keybase1.TLFVisibility  `codec:"visibility" json:"visibility"`
	RateLimit   *RateLimit              `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetMessagesRemoteRes) DeepCopy() GetMessagesRemoteRes {
	return GetMessagesRemoteRes{
		Msgs: (func(x []MessageBoxed) []MessageBoxed {
			if x == nil {
				return nil
			}
			ret := make([]MessageBoxed, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Msgs),
		MembersType: o.MembersType.DeepCopy(),
		Visibility:  o.Visibility.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type MarkAsReadRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o MarkAsReadRes) DeepCopy() MarkAsReadRes {
	return MarkAsReadRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type SetConversationStatusRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o SetConversationStatusRes) DeepCopy() SetConversationStatusRes {
	return SetConversationStatusRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetPublicConversationsRes struct {
	Conversations []Conversation `codec:"conversations" json:"conversations"`
	RateLimit     *RateLimit     `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetPublicConversationsRes) DeepCopy() GetPublicConversationsRes {
	return GetPublicConversationsRes{
		Conversations: (func(x []Conversation) []Conversation {
			if x == nil {
				return nil
			}
			ret := make([]Conversation, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetUnreadlineRemoteRes struct {
	UnreadlineID *MessageID `codec:"unreadlineID,omitempty" json:"unreadlineID,omitempty"`
	RateLimit    *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetUnreadlineRemoteRes) DeepCopy() GetUnreadlineRemoteRes {
	return GetUnreadlineRemoteRes{
		UnreadlineID: (func(x *MessageID) *MessageID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.UnreadlineID),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type ChannelMention int

const (
	ChannelMention_NONE ChannelMention = 0
	ChannelMention_ALL  ChannelMention = 1
	ChannelMention_HERE ChannelMention = 2
)

func (o ChannelMention) DeepCopy() ChannelMention { return o }

var ChannelMentionMap = map[string]ChannelMention{
	"NONE": 0,
	"ALL":  1,
	"HERE": 2,
}

var ChannelMentionRevMap = map[ChannelMention]string{
	0: "NONE",
	1: "ALL",
	2: "HERE",
}

func (e ChannelMention) String() string {
	if v, ok := ChannelMentionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UnreadUpdateFull struct {
	Ignore          bool             `codec:"ignore" json:"ignore"`
	InboxVers       InboxVers        `codec:"inboxVers" json:"inboxVers"`
	InboxSyncStatus SyncInboxResType `codec:"inboxSyncStatus" json:"inboxSyncStatus"`
	Updates         []UnreadUpdate   `codec:"updates" json:"updates"`
}

func (o UnreadUpdateFull) DeepCopy() UnreadUpdateFull {
	return UnreadUpdateFull{
		Ignore:          o.Ignore,
		InboxVers:       o.InboxVers.DeepCopy(),
		InboxSyncStatus: o.InboxSyncStatus.DeepCopy(),
		Updates: (func(x []UnreadUpdate) []UnreadUpdate {
			if x == nil {
				return nil
			}
			ret := make([]UnreadUpdate, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Updates),
	}
}

type S3Params struct {
	Bucket               string `codec:"bucket" json:"bucket"`
	ObjectKey            string `codec:"objectKey" json:"objectKey"`
	AccessKey            string `codec:"accessKey" json:"accessKey"`
	Acl                  string `codec:"acl" json:"acl"`
	RegionName           string `codec:"regionName" json:"regionName"`
	RegionEndpoint       string `codec:"regionEndpoint" json:"regionEndpoint"`
	RegionBucketEndpoint string `codec:"regionBucketEndpoint" json:"regionBucketEndpoint"`
}

func (o S3Params) DeepCopy() S3Params {
	return S3Params{
		Bucket:               o.Bucket,
		ObjectKey:            o.ObjectKey,
		AccessKey:            o.AccessKey,
		Acl:                  o.Acl,
		RegionName:           o.RegionName,
		RegionEndpoint:       o.RegionEndpoint,
		RegionBucketEndpoint: o.RegionBucketEndpoint,
	}
}

type SyncIncrementalRes struct {
	Vers  InboxVers      `codec:"vers" json:"vers"`
	Convs []Conversation `codec:"convs" json:"convs"`
}

func (o SyncIncrementalRes) DeepCopy() SyncIncrementalRes {
	return SyncIncrementalRes{
		Vers: o.Vers.DeepCopy(),
		Convs: (func(x []Conversation) []Conversation {
			if x == nil {
				return nil
			}
			ret := make([]Conversation, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Convs),
	}
}

type ServerCacheVers struct {
	InboxVers  int `codec:"inboxVers" json:"inboxVers"`
	BodiesVers int `codec:"bodiesVers" json:"bodiesVers"`
}

func (o ServerCacheVers) DeepCopy() ServerCacheVers {
	return ServerCacheVers{
		InboxVers:  o.InboxVers,
		BodiesVers: o.BodiesVers,
	}
}

type SyncInboxRes struct {
	Typ__         SyncInboxResType    `codec:"typ" json:"typ"`
	Incremental__ *SyncIncrementalRes `codec:"incremental,omitempty" json:"incremental,omitempty"`
}

func (o *SyncInboxRes) Typ() (ret SyncInboxResType, err error) {
	switch o.Typ__ {
	case SyncInboxResType_INCREMENTAL:
		if o.Incremental__ == nil {
			err = errors.New("unexpected nil value for Incremental__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o SyncInboxRes) Incremental() (res SyncIncrementalRes) {
	if o.Typ__ != SyncInboxResType_INCREMENTAL {
		panic("wrong case accessed")
	}
	if o.Incremental__ == nil {
		return
	}
	return *o.Incremental__
}

func NewSyncInboxResWithCurrent() SyncInboxRes {
	return SyncInboxRes{
		Typ__: SyncInboxResType_CURRENT,
	}
}

func NewSyncInboxResWithIncremental(v SyncIncrementalRes) SyncInboxRes {
	return SyncInboxRes{
		Typ__:         SyncInboxResType_INCREMENTAL,
		Incremental__: &v,
	}
}

func NewSyncInboxResWithClear() SyncInboxRes {
	return SyncInboxRes{
		Typ__: SyncInboxResType_CLEAR,
	}
}

func (o SyncInboxRes) DeepCopy() SyncInboxRes {
	return SyncInboxRes{
		Typ__: o.Typ__.DeepCopy(),
		Incremental__: (func(x *SyncIncrementalRes) *SyncIncrementalRes {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Incremental__),
	}
}

type SyncChatRes struct {
	CacheVers ServerCacheVers `codec:"cacheVers" json:"cacheVers"`
	InboxRes  SyncInboxRes    `codec:"inboxRes" json:"inboxRes"`
}

func (o SyncChatRes) DeepCopy() SyncChatRes {
	return SyncChatRes{
		CacheVers: o.CacheVers.DeepCopy(),
		InboxRes:  o.InboxRes.DeepCopy(),
	}
}

type SyncAllProtVers int

const (
	SyncAllProtVers_V0 SyncAllProtVers = 0
	SyncAllProtVers_V1 SyncAllProtVers = 1
)

func (o SyncAllProtVers) DeepCopy() SyncAllProtVers { return o }

var SyncAllProtVersMap = map[string]SyncAllProtVers{
	"V0": 0,
	"V1": 1,
}

var SyncAllProtVersRevMap = map[SyncAllProtVers]string{
	0: "V0",
	1: "V1",
}

func (e SyncAllProtVers) String() string {
	if v, ok := SyncAllProtVersRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SyncAllNotificationType int

const (
	SyncAllNotificationType_STATE       SyncAllNotificationType = 0
	SyncAllNotificationType_INCREMENTAL SyncAllNotificationType = 1
)

func (o SyncAllNotificationType) DeepCopy() SyncAllNotificationType { return o }

var SyncAllNotificationTypeMap = map[string]SyncAllNotificationType{
	"STATE":       0,
	"INCREMENTAL": 1,
}

var SyncAllNotificationTypeRevMap = map[SyncAllNotificationType]string{
	0: "STATE",
	1: "INCREMENTAL",
}

func (e SyncAllNotificationType) String() string {
	if v, ok := SyncAllNotificationTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SyncAllNotificationRes struct {
	Typ__         SyncAllNotificationType `codec:"typ" json:"typ"`
	State__       *gregor1.State          `codec:"state,omitempty" json:"state,omitempty"`
	Incremental__ *gregor1.SyncResult     `codec:"incremental,omitempty" json:"incremental,omitempty"`
}

func (o *SyncAllNotificationRes) Typ() (ret SyncAllNotificationType, err error) {
	switch o.Typ__ {
	case SyncAllNotificationType_STATE:
		if o.State__ == nil {
			err = errors.New("unexpected nil value for State__")
			return ret, err
		}
	case SyncAllNotificationType_INCREMENTAL:
		if o.Incremental__ == nil {
			err = errors.New("unexpected nil value for Incremental__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o SyncAllNotificationRes) State() (res gregor1.State) {
	if o.Typ__ != SyncAllNotificationType_STATE {
		panic("wrong case accessed")
	}
	if o.State__ == nil {
		return
	}
	return *o.State__
}

func (o SyncAllNotificationRes) Incremental() (res gregor1.SyncResult) {
	if o.Typ__ != SyncAllNotificationType_INCREMENTAL {
		panic("wrong case accessed")
	}
	if o.Incremental__ == nil {
		return
	}
	return *o.Incremental__
}

func NewSyncAllNotificationResWithState(v gregor1.State) SyncAllNotificationRes {
	return SyncAllNotificationRes{
		Typ__:   SyncAllNotificationType_STATE,
		State__: &v,
	}
}

func NewSyncAllNotificationResWithIncremental(v gregor1.SyncResult) SyncAllNotificationRes {
	return SyncAllNotificationRes{
		Typ__:         SyncAllNotificationType_INCREMENTAL,
		Incremental__: &v,
	}
}

func (o SyncAllNotificationRes) DeepCopy() SyncAllNotificationRes {
	return SyncAllNotificationRes{
		Typ__: o.Typ__.DeepCopy(),
		State__: (func(x *gregor1.State) *gregor1.State {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.State__),
		Incremental__: (func(x *gregor1.SyncResult) *gregor1.SyncResult {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Incremental__),
	}
}

type SyncAllResult struct {
	Auth         gregor1.AuthResult     `codec:"auth" json:"auth"`
	Chat         SyncChatRes            `codec:"chat" json:"chat"`
	Notification SyncAllNotificationRes `codec:"notification" json:"notification"`
	Badge        UnreadUpdateFull       `codec:"badge" json:"badge"`
}

func (o SyncAllResult) DeepCopy() SyncAllResult {
	return SyncAllResult{
		Auth:         o.Auth.DeepCopy(),
		Chat:         o.Chat.DeepCopy(),
		Notification: o.Notification.DeepCopy(),
		Badge:        o.Badge.DeepCopy(),
	}
}

type JoinLeaveConversationRemoteRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o JoinLeaveConversationRemoteRes) DeepCopy() JoinLeaveConversationRemoteRes {
	return JoinLeaveConversationRemoteRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type DeleteConversationRemoteRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o DeleteConversationRemoteRes) DeepCopy() DeleteConversationRemoteRes {
	return DeleteConversationRemoteRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type RemoveFromConversationRemoteRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o RemoveFromConversationRemoteRes) DeepCopy() RemoveFromConversationRemoteRes {
	return RemoveFromConversationRemoteRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetMessageBeforeRes struct {
	MsgID     MessageID  `codec:"msgID" json:"msgID"`
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetMessageBeforeRes) DeepCopy() GetMessageBeforeRes {
	return GetMessageBeforeRes{
		MsgID: o.MsgID.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetTLFConversationsRes struct {
	Conversations []Conversation `codec:"conversations" json:"conversations"`
	RateLimit     *RateLimit     `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetTLFConversationsRes) DeepCopy() GetTLFConversationsRes {
	return GetTLFConversationsRes{
		Conversations: (func(x []Conversation) []Conversation {
			if x == nil {
				return nil
			}
			ret := make([]Conversation, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type SetAppNotificationSettingsRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o SetAppNotificationSettingsRes) DeepCopy() SetAppNotificationSettingsRes {
	return SetAppNotificationSettingsRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type SetRetentionRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o SetRetentionRes) DeepCopy() SetRetentionRes {
	return SetRetentionRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type SetConvMinWriterRoleRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o SetConvMinWriterRoleRes) DeepCopy() SetConvMinWriterRoleRes {
	return SetConvMinWriterRoleRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type SweepRes struct {
	FoundTask       bool    `codec:"foundTask" json:"foundTask"`
	DeletedMessages bool    `codec:"deletedMessages" json:"deletedMessages"`
	Expunge         Expunge `codec:"expunge" json:"expunge"`
}

func (o SweepRes) DeepCopy() SweepRes {
	return SweepRes{
		FoundTask:       o.FoundTask,
		DeletedMessages: o.DeletedMessages,
		Expunge:         o.Expunge.DeepCopy(),
	}
}

type ServerNowRes struct {
	RateLimit *RateLimit   `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
	Now       gregor1.Time `codec:"now" json:"now"`
}

func (o ServerNowRes) DeepCopy() ServerNowRes {
	return ServerNowRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
		Now: o.Now.DeepCopy(),
	}
}

type ExternalAPIKeyTyp int

const (
	ExternalAPIKeyTyp_GOOGLEMAPS ExternalAPIKeyTyp = 0
	ExternalAPIKeyTyp_GIPHY      ExternalAPIKeyTyp = 1
)

func (o ExternalAPIKeyTyp) DeepCopy() ExternalAPIKeyTyp { return o }

var ExternalAPIKeyTypMap = map[string]ExternalAPIKeyTyp{
	"GOOGLEMAPS": 0,
	"GIPHY":      1,
}

var ExternalAPIKeyTypRevMap = map[ExternalAPIKeyTyp]string{
	0: "GOOGLEMAPS",
	1: "GIPHY",
}

func (e ExternalAPIKeyTyp) String() string {
	if v, ok := ExternalAPIKeyTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ExternalAPIKey struct {
	Typ__        ExternalAPIKeyTyp `codec:"typ" json:"typ"`
	Googlemaps__ *string           `codec:"googlemaps,omitempty" json:"googlemaps,omitempty"`
	Giphy__      *string           `codec:"giphy,omitempty" json:"giphy,omitempty"`
}

func (o *ExternalAPIKey) Typ() (ret ExternalAPIKeyTyp, err error) {
	switch o.Typ__ {
	case ExternalAPIKeyTyp_GOOGLEMAPS:
		if o.Googlemaps__ == nil {
			err = errors.New("unexpected nil value for Googlemaps__")
			return ret, err
		}
	case ExternalAPIKeyTyp_GIPHY:
		if o.Giphy__ == nil {
			err = errors.New("unexpected nil value for Giphy__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o ExternalAPIKey) Googlemaps() (res string) {
	if o.Typ__ != ExternalAPIKeyTyp_GOOGLEMAPS {
		panic("wrong case accessed")
	}
	if o.Googlemaps__ == nil {
		return
	}
	return *o.Googlemaps__
}

func (o ExternalAPIKey) Giphy() (res string) {
	if o.Typ__ != ExternalAPIKeyTyp_GIPHY {
		panic("wrong case accessed")
	}
	if o.Giphy__ == nil {
		return
	}
	return *o.Giphy__
}

func NewExternalAPIKeyWithGooglemaps(v string) ExternalAPIKey {
	return ExternalAPIKey{
		Typ__:        ExternalAPIKeyTyp_GOOGLEMAPS,
		Googlemaps__: &v,
	}
}

func NewExternalAPIKeyWithGiphy(v string) ExternalAPIKey {
	return ExternalAPIKey{
		Typ__:   ExternalAPIKeyTyp_GIPHY,
		Giphy__: &v,
	}
}

func (o ExternalAPIKey) DeepCopy() ExternalAPIKey {
	return ExternalAPIKey{
		Typ__: o.Typ__.DeepCopy(),
		Googlemaps__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Googlemaps__),
		Giphy__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Giphy__),
	}
}

type BotInfoHashVers uint64

func (o BotInfoHashVers) DeepCopy() BotInfoHashVers {
	return o
}

type CommandConvVers uint64

func (o CommandConvVers) DeepCopy() CommandConvVers {
	return o
}

type RemoteBotCommandsAdvertisementPublic struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

func (o RemoteBotCommandsAdvertisementPublic) DeepCopy() RemoteBotCommandsAdvertisementPublic {
	return RemoteBotCommandsAdvertisementPublic{
		ConvID: o.ConvID.DeepCopy(),
	}
}

type RemoteBotCommandsAdvertisementTLFID struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	TlfID  TLFID          `codec:"tlfID" json:"tlfID"`
}

func (o RemoteBotCommandsAdvertisementTLFID) DeepCopy() RemoteBotCommandsAdvertisementTLFID {
	return RemoteBotCommandsAdvertisementTLFID{
		ConvID: o.ConvID.DeepCopy(),
		TlfID:  o.TlfID.DeepCopy(),
	}
}

type RemoteBotCommandsAdvertisementConv struct {
	ConvID          ConversationID `codec:"convID" json:"convID"`
	AdvertiseConvID ConversationID `codec:"advertiseConvID" json:"advertiseConvID"`
}

func (o RemoteBotCommandsAdvertisementConv) DeepCopy() RemoteBotCommandsAdvertisementConv {
	return RemoteBotCommandsAdvertisementConv{
		ConvID:          o.ConvID.DeepCopy(),
		AdvertiseConvID: o.AdvertiseConvID.DeepCopy(),
	}
}

type RemoteBotCommandsAdvertisement struct {
	Typ__          BotCommandsAdvertisementTyp           `codec:"typ" json:"typ"`
	Public__       *RemoteBotCommandsAdvertisementPublic `codec:"public,omitempty" json:"public,omitempty"`
	TlfidMembers__ *RemoteBotCommandsAdvertisementTLFID  `codec:"tlfidMembers,omitempty" json:"tlfidMembers,omitempty"`
	TlfidConvs__   *RemoteBotCommandsAdvertisementTLFID  `codec:"tlfidConvs,omitempty" json:"tlfidConvs,omitempty"`
	Conv__         *RemoteBotCommandsAdvertisementConv   `codec:"conv,omitempty" json:"conv,omitempty"`
}

func (o *RemoteBotCommandsAdvertisement) Typ() (ret BotCommandsAdvertisementTyp, err error) {
	switch o.Typ__ {
	case BotCommandsAdvertisementTyp_PUBLIC:
		if o.Public__ == nil {
			err = errors.New("unexpected nil value for Public__")
			return ret, err
		}
	case BotCommandsAdvertisementTyp_TLFID_MEMBERS:
		if o.TlfidMembers__ == nil {
			err = errors.New("unexpected nil value for TlfidMembers__")
			return ret, err
		}
	case BotCommandsAdvertisementTyp_TLFID_CONVS:
		if o.TlfidConvs__ == nil {
			err = errors.New("unexpected nil value for TlfidConvs__")
			return ret, err
		}
	case BotCommandsAdvertisementTyp_CONV:
		if o.Conv__ == nil {
			err = errors.New("unexpected nil value for Conv__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o RemoteBotCommandsAdvertisement) Public() (res RemoteBotCommandsAdvertisementPublic) {
	if o.Typ__ != BotCommandsAdvertisementTyp_PUBLIC {
		panic("wrong case accessed")
	}
	if o.Public__ == nil {
		return
	}
	return *o.Public__
}

func (o RemoteBotCommandsAdvertisement) TlfidMembers() (res RemoteBotCommandsAdvertisementTLFID) {
	if o.Typ__ != BotCommandsAdvertisementTyp_TLFID_MEMBERS {
		panic("wrong case accessed")
	}
	if o.TlfidMembers__ == nil {
		return
	}
	return *o.TlfidMembers__
}

func (o RemoteBotCommandsAdvertisement) TlfidConvs() (res RemoteBotCommandsAdvertisementTLFID) {
	if o.Typ__ != BotCommandsAdvertisementTyp_TLFID_CONVS {
		panic("wrong case accessed")
	}
	if o.TlfidConvs__ == nil {
		return
	}
	return *o.TlfidConvs__
}

func (o RemoteBotCommandsAdvertisement) Conv() (res RemoteBotCommandsAdvertisementConv) {
	if o.Typ__ != BotCommandsAdvertisementTyp_CONV {
		panic("wrong case accessed")
	}
	if o.Conv__ == nil {
		return
	}
	return *o.Conv__
}

func NewRemoteBotCommandsAdvertisementWithPublic(v RemoteBotCommandsAdvertisementPublic) RemoteBotCommandsAdvertisement {
	return RemoteBotCommandsAdvertisement{
		Typ__:    BotCommandsAdvertisementTyp_PUBLIC,
		Public__: &v,
	}
}

func NewRemoteBotCommandsAdvertisementWithTlfidMembers(v RemoteBotCommandsAdvertisementTLFID) RemoteBotCommandsAdvertisement {
	return RemoteBotCommandsAdvertisement{
		Typ__:          BotCommandsAdvertisementTyp_TLFID_MEMBERS,
		TlfidMembers__: &v,
	}
}

func NewRemoteBotCommandsAdvertisementWithTlfidConvs(v RemoteBotCommandsAdvertisementTLFID) RemoteBotCommandsAdvertisement {
	return RemoteBotCommandsAdvertisement{
		Typ__:        BotCommandsAdvertisementTyp_TLFID_CONVS,
		TlfidConvs__: &v,
	}
}

func NewRemoteBotCommandsAdvertisementWithConv(v RemoteBotCommandsAdvertisementConv) RemoteBotCommandsAdvertisement {
	return RemoteBotCommandsAdvertisement{
		Typ__:  BotCommandsAdvertisementTyp_CONV,
		Conv__: &v,
	}
}

func (o RemoteBotCommandsAdvertisement) DeepCopy() RemoteBotCommandsAdvertisement {
	return RemoteBotCommandsAdvertisement{
		Typ__: o.Typ__.DeepCopy(),
		Public__: (func(x *RemoteBotCommandsAdvertisementPublic) *RemoteBotCommandsAdvertisementPublic {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Public__),
		TlfidMembers__: (func(x *RemoteBotCommandsAdvertisementTLFID) *RemoteBotCommandsAdvertisementTLFID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TlfidMembers__),
		TlfidConvs__: (func(x *RemoteBotCommandsAdvertisementTLFID) *RemoteBotCommandsAdvertisementTLFID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TlfidConvs__),
		Conv__: (func(x *RemoteBotCommandsAdvertisementConv) *RemoteBotCommandsAdvertisementConv {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv__),
	}
}

type BotCommandConv struct {
	Uid               gregor1.UID                 `codec:"uid" json:"uid"`
	UntrustedTeamRole keybase1.TeamRole           `codec:"untrustedTeamRole" json:"untrustedTeamRole"`
	ConvID            ConversationID              `codec:"convID" json:"convID"`
	Vers              CommandConvVers             `codec:"vers" json:"vers"`
	Mtime             gregor1.Time                `codec:"mtime" json:"mtime"`
	Typ               BotCommandsAdvertisementTyp `codec:"typ" json:"typ"`
}

func (o BotCommandConv) DeepCopy() BotCommandConv {
	return BotCommandConv{
		Uid:               o.Uid.DeepCopy(),
		UntrustedTeamRole: o.UntrustedTeamRole.DeepCopy(),
		ConvID:            o.ConvID.DeepCopy(),
		Vers:              o.Vers.DeepCopy(),
		Mtime:             o.Mtime.DeepCopy(),
		Typ:               o.Typ.DeepCopy(),
	}
}

type BotInfo struct {
	ServerHashVers BotInfoHashVers  `codec:"serverHashVers" json:"serverHashVers"`
	ClientHashVers BotInfoHashVers  `codec:"clientHashVers" json:"clientHashVers"`
	CommandConvs   []BotCommandConv `codec:"commandConvs" json:"commandConvs"`
}

func (o BotInfo) DeepCopy() BotInfo {
	return BotInfo{
		ServerHashVers: o.ServerHashVers.DeepCopy(),
		ClientHashVers: o.ClientHashVers.DeepCopy(),
		CommandConvs: (func(x []BotCommandConv) []BotCommandConv {
			if x == nil {
				return nil
			}
			ret := make([]BotCommandConv, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.CommandConvs),
	}
}

type AdvertiseBotCommandsRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o AdvertiseBotCommandsRes) DeepCopy() AdvertiseBotCommandsRes {
	return AdvertiseBotCommandsRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type RemoteClearBotCommandsFilterPublic struct {
}

func (o RemoteClearBotCommandsFilterPublic) DeepCopy() RemoteClearBotCommandsFilterPublic {
	return RemoteClearBotCommandsFilterPublic{}
}

type RemoteClearBotCommandsFilterTLFID struct {
	TlfID TLFID `codec:"tlfID" json:"tlfID"`
}

func (o RemoteClearBotCommandsFilterTLFID) DeepCopy() RemoteClearBotCommandsFilterTLFID {
	return RemoteClearBotCommandsFilterTLFID{
		TlfID: o.TlfID.DeepCopy(),
	}
}

type RemoteClearBotCommandsFilterConv struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

func (o RemoteClearBotCommandsFilterConv) DeepCopy() RemoteClearBotCommandsFilterConv {
	return RemoteClearBotCommandsFilterConv{
		ConvID: o.ConvID.DeepCopy(),
	}
}

type RemoteClearBotCommandsFilter struct {
	Typ__          BotCommandsAdvertisementTyp         `codec:"typ" json:"typ"`
	Public__       *RemoteClearBotCommandsFilterPublic `codec:"public,omitempty" json:"public,omitempty"`
	TlfidMembers__ *RemoteClearBotCommandsFilterTLFID  `codec:"tlfidMembers,omitempty" json:"tlfidMembers,omitempty"`
	TlfidConvs__   *RemoteClearBotCommandsFilterTLFID  `codec:"tlfidConvs,omitempty" json:"tlfidConvs,omitempty"`
	Conv__         *RemoteClearBotCommandsFilterConv   `codec:"conv,omitempty" json:"conv,omitempty"`
}

func (o *RemoteClearBotCommandsFilter) Typ() (ret BotCommandsAdvertisementTyp, err error) {
	switch o.Typ__ {
	case BotCommandsAdvertisementTyp_PUBLIC:
		if o.Public__ == nil {
			err = errors.New("unexpected nil value for Public__")
			return ret, err
		}
	case BotCommandsAdvertisementTyp_TLFID_MEMBERS:
		if o.TlfidMembers__ == nil {
			err = errors.New("unexpected nil value for TlfidMembers__")
			return ret, err
		}
	case BotCommandsAdvertisementTyp_TLFID_CONVS:
		if o.TlfidConvs__ == nil {
			err = errors.New("unexpected nil value for TlfidConvs__")
			return ret, err
		}
	case BotCommandsAdvertisementTyp_CONV:
		if o.Conv__ == nil {
			err = errors.New("unexpected nil value for Conv__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o RemoteClearBotCommandsFilter) Public() (res RemoteClearBotCommandsFilterPublic) {
	if o.Typ__ != BotCommandsAdvertisementTyp_PUBLIC {
		panic("wrong case accessed")
	}
	if o.Public__ == nil {
		return
	}
	return *o.Public__
}

func (o RemoteClearBotCommandsFilter) TlfidMembers() (res RemoteClearBotCommandsFilterTLFID) {
	if o.Typ__ != BotCommandsAdvertisementTyp_TLFID_MEMBERS {
		panic("wrong case accessed")
	}
	if o.TlfidMembers__ == nil {
		return
	}
	return *o.TlfidMembers__
}

func (o RemoteClearBotCommandsFilter) TlfidConvs() (res RemoteClearBotCommandsFilterTLFID) {
	if o.Typ__ != BotCommandsAdvertisementTyp_TLFID_CONVS {
		panic("wrong case accessed")
	}
	if o.TlfidConvs__ == nil {
		return
	}
	return *o.TlfidConvs__
}

func (o RemoteClearBotCommandsFilter) Conv() (res RemoteClearBotCommandsFilterConv) {
	if o.Typ__ != BotCommandsAdvertisementTyp_CONV {
		panic("wrong case accessed")
	}
	if o.Conv__ == nil {
		return
	}
	return *o.Conv__
}

func NewRemoteClearBotCommandsFilterWithPublic(v RemoteClearBotCommandsFilterPublic) RemoteClearBotCommandsFilter {
	return RemoteClearBotCommandsFilter{
		Typ__:    BotCommandsAdvertisementTyp_PUBLIC,
		Public__: &v,
	}
}

func NewRemoteClearBotCommandsFilterWithTlfidMembers(v RemoteClearBotCommandsFilterTLFID) RemoteClearBotCommandsFilter {
	return RemoteClearBotCommandsFilter{
		Typ__:          BotCommandsAdvertisementTyp_TLFID_MEMBERS,
		TlfidMembers__: &v,
	}
}

func NewRemoteClearBotCommandsFilterWithTlfidConvs(v RemoteClearBotCommandsFilterTLFID) RemoteClearBotCommandsFilter {
	return RemoteClearBotCommandsFilter{
		Typ__:        BotCommandsAdvertisementTyp_TLFID_CONVS,
		TlfidConvs__: &v,
	}
}

func NewRemoteClearBotCommandsFilterWithConv(v RemoteClearBotCommandsFilterConv) RemoteClearBotCommandsFilter {
	return RemoteClearBotCommandsFilter{
		Typ__:  BotCommandsAdvertisementTyp_CONV,
		Conv__: &v,
	}
}

func (o RemoteClearBotCommandsFilter) DeepCopy() RemoteClearBotCommandsFilter {
	return RemoteClearBotCommandsFilter{
		Typ__: o.Typ__.DeepCopy(),
		Public__: (func(x *RemoteClearBotCommandsFilterPublic) *RemoteClearBotCommandsFilterPublic {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Public__),
		TlfidMembers__: (func(x *RemoteClearBotCommandsFilterTLFID) *RemoteClearBotCommandsFilterTLFID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TlfidMembers__),
		TlfidConvs__: (func(x *RemoteClearBotCommandsFilterTLFID) *RemoteClearBotCommandsFilterTLFID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TlfidConvs__),
		Conv__: (func(x *RemoteClearBotCommandsFilterConv) *RemoteClearBotCommandsFilterConv {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv__),
	}
}

type ClearBotCommandsRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o ClearBotCommandsRes) DeepCopy() ClearBotCommandsRes {
	return ClearBotCommandsRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type BotInfoResponseTyp int

const (
	BotInfoResponseTyp_UPTODATE BotInfoResponseTyp = 0
	BotInfoResponseTyp_INFO     BotInfoResponseTyp = 1
)

func (o BotInfoResponseTyp) DeepCopy() BotInfoResponseTyp { return o }

var BotInfoResponseTypMap = map[string]BotInfoResponseTyp{
	"UPTODATE": 0,
	"INFO":     1,
}

var BotInfoResponseTypRevMap = map[BotInfoResponseTyp]string{
	0: "UPTODATE",
	1: "INFO",
}

func (e BotInfoResponseTyp) String() string {
	if v, ok := BotInfoResponseTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type BotInfoResponse struct {
	Typ__  BotInfoResponseTyp `codec:"typ" json:"typ"`
	Info__ *BotInfo           `codec:"info,omitempty" json:"info,omitempty"`
}

func (o *BotInfoResponse) Typ() (ret BotInfoResponseTyp, err error) {
	switch o.Typ__ {
	case BotInfoResponseTyp_INFO:
		if o.Info__ == nil {
			err = errors.New("unexpected nil value for Info__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o BotInfoResponse) Info() (res BotInfo) {
	if o.Typ__ != BotInfoResponseTyp_INFO {
		panic("wrong case accessed")
	}
	if o.Info__ == nil {
		return
	}
	return *o.Info__
}

func NewBotInfoResponseWithUptodate() BotInfoResponse {
	return BotInfoResponse{
		Typ__: BotInfoResponseTyp_UPTODATE,
	}
}

func NewBotInfoResponseWithInfo(v BotInfo) BotInfoResponse {
	return BotInfoResponse{
		Typ__:  BotInfoResponseTyp_INFO,
		Info__: &v,
	}
}

func (o BotInfoResponse) DeepCopy() BotInfoResponse {
	return BotInfoResponse{
		Typ__: o.Typ__.DeepCopy(),
		Info__: (func(x *BotInfo) *BotInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Info__),
	}
}

type GetBotInfoRes struct {
	Response  BotInfoResponse `codec:"response" json:"response"`
	RateLimit *RateLimit      `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetBotInfoRes) DeepCopy() GetBotInfoRes {
	return GetBotInfoRes{
		Response: o.Response.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type BotInfoHash []byte

func (o BotInfoHash) DeepCopy() BotInfoHash {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type GetDefaultTeamChannelsRes struct {
	Convs     []ConversationID `codec:"convs" json:"convs"`
	RateLimit *RateLimit       `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetDefaultTeamChannelsRes) DeepCopy() GetDefaultTeamChannelsRes {
	return GetDefaultTeamChannelsRes{
		Convs: (func(x []ConversationID) []ConversationID {
			if x == nil {
				return nil
			}
			ret := make([]ConversationID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Convs),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type SetDefaultTeamChannelsRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o SetDefaultTeamChannelsRes) DeepCopy() SetDefaultTeamChannelsRes {
	return SetDefaultTeamChannelsRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetRecentJoinsRes struct {
	NumJoins  int        `codec:"numJoins" json:"numJoins"`
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetRecentJoinsRes) DeepCopy() GetRecentJoinsRes {
	return GetRecentJoinsRes{
		NumJoins: o.NumJoins,
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type RefreshParticipantsRemoteRes struct {
	HashMatch bool          `codec:"hashMatch" json:"hashMatch"`
	Uids      []gregor1.UID `codec:"uids" json:"uids"`
	Hash      string        `codec:"hash" json:"hash"`
	RateLimit *RateLimit    `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o RefreshParticipantsRemoteRes) DeepCopy() RefreshParticipantsRemoteRes {
	return RefreshParticipantsRemoteRes{
		HashMatch: o.HashMatch,
		Uids: (func(x []gregor1.UID) []gregor1.UID {
			if x == nil {
				return nil
			}
			ret := make([]gregor1.UID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Uids),
		Hash: o.Hash,
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetLastActiveAtRes struct {
	LastActiveAt gregor1.Time `codec:"lastActiveAt" json:"lastActiveAt"`
	RateLimit    *RateLimit   `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetLastActiveAtRes) DeepCopy() GetLastActiveAtRes {
	return GetLastActiveAtRes{
		LastActiveAt: o.LastActiveAt.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type ResetConversationMember struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	Uid    gregor1.UID    `codec:"uid" json:"uid"`
}

func (o ResetConversationMember) DeepCopy() ResetConversationMember {
	return ResetConversationMember{
		ConvID: o.ConvID.DeepCopy(),
		Uid:    o.Uid.DeepCopy(),
	}
}

type GetResetConversationsRes struct {
	ResetConvs []ResetConversationMember `codec:"resetConvs" json:"resetConvs"`
	RateLimit  *RateLimit                `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetResetConversationsRes) DeepCopy() GetResetConversationsRes {
	return GetResetConversationsRes{
		ResetConvs: (func(x []ResetConversationMember) []ResetConversationMember {
			if x == nil {
				return nil
			}
			ret := make([]ResetConversationMember, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ResetConvs),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type GetInboxRemoteArg struct {
	Vers       InboxVers      `codec:"vers" json:"vers"`
	Query      *GetInboxQuery `codec:"query,omitempty" json:"query,omitempty"`
	Pagination *Pagination    `codec:"pagination,omitempty" json:"pagination,omitempty"`
}

type GetThreadRemoteArg struct {
	ConversationID ConversationID  `codec:"conversationID" json:"conversationID"`
	Reason         GetThreadReason `codec:"reason" json:"reason"`
	Query          *GetThreadQuery `codec:"query,omitempty" json:"query,omitempty"`
	Pagination     *Pagination     `codec:"pagination,omitempty" json:"pagination,omitempty"`
}

type GetUnreadlineRemoteArg struct {
	ConvID    ConversationID `codec:"convID" json:"convID"`
	ReadMsgID MessageID      `codec:"readMsgID" json:"readMsgID"`
}

type GetPublicConversationsArg struct {
	TlfID            TLFID     `codec:"tlfID" json:"tlfID"`
	TopicType        TopicType `codec:"topicType" json:"topicType"`
	SummarizeMaxMsgs bool      `codec:"summarizeMaxMsgs" json:"summarizeMaxMsgs"`
}

type PostRemoteArg struct {
	ConversationID ConversationID            `codec:"conversationID" json:"conversationID"`
	MessageBoxed   MessageBoxed              `codec:"messageBoxed" json:"messageBoxed"`
	AtMentions     []gregor1.UID             `codec:"atMentions" json:"atMentions"`
	ChannelMention ChannelMention            `codec:"channelMention" json:"channelMention"`
	TopicNameState *TopicNameState           `codec:"topicNameState,omitempty" json:"topicNameState,omitempty"`
	JoinMentionsAs *ConversationMemberStatus `codec:"joinMentionsAs,omitempty" json:"joinMentionsAs,omitempty"`
}

type NewConversationRemoteArg struct {
	IdTriple ConversationIDTriple `codec:"idTriple" json:"idTriple"`
}

type NewConversationRemote2Arg struct {
	IdTriple         ConversationIDTriple    `codec:"idTriple" json:"idTriple"`
	TLFMessage       MessageBoxed            `codec:"TLFMessage" json:"TLFMessage"`
	MembersType      ConversationMembersType `codec:"membersType" json:"membersType"`
	TopicNameState   *TopicNameState         `codec:"topicNameState,omitempty" json:"topicNameState,omitempty"`
	MemberSourceConv *ConversationID         `codec:"memberSourceConv,omitempty" json:"memberSourceConv,omitempty"`
	RetentionPolicy  *RetentionPolicy        `codec:"retentionPolicy,omitempty" json:"retentionPolicy,omitempty"`
}

type GetMessagesRemoteArg struct {
	ConversationID ConversationID   `codec:"conversationID" json:"conversationID"`
	ThreadReason   *GetThreadReason `codec:"threadReason,omitempty" json:"threadReason,omitempty"`
	MessageIDs     []MessageID      `codec:"messageIDs" json:"messageIDs"`
}

type MarkAsReadArg struct {
	ConversationID ConversationID `codec:"conversationID" json:"conversationID"`
	MsgID          MessageID      `codec:"msgID" json:"msgID"`
}

type SetConversationStatusArg struct {
	ConversationID ConversationID     `codec:"conversationID" json:"conversationID"`
	Status         ConversationStatus `codec:"status" json:"status"`
}

type GetUnreadUpdateFullArg struct {
	InboxVers InboxVers `codec:"inboxVers" json:"inboxVers"`
}

type GetS3ParamsArg struct {
	ConversationID ConversationID `codec:"conversationID" json:"conversationID"`
}

type S3SignArg struct {
	Version int    `codec:"version" json:"version"`
	Payload []byte `codec:"payload" json:"payload"`
}

type GetInboxVersionArg struct {
	Uid gregor1.UID `codec:"uid" json:"uid"`
}

type SyncInboxArg struct {
	Vers InboxVers `codec:"vers" json:"vers"`
}

type SyncChatArg struct {
	Vers             InboxVers             `codec:"vers" json:"vers"`
	SummarizeMaxMsgs bool                  `codec:"summarizeMaxMsgs" json:"summarizeMaxMsgs"`
	ParticipantsMode InboxParticipantsMode `codec:"participantsMode" json:"participantsMode"`
}

type SyncAllArg struct {
	Uid              gregor1.UID           `codec:"uid" json:"uid"`
	DeviceID         gregor1.DeviceID      `codec:"deviceID" json:"deviceID"`
	Session          gregor1.SessionToken  `codec:"session" json:"session"`
	InboxVers        InboxVers             `codec:"inboxVers" json:"inboxVers"`
	Ctime            gregor1.Time          `codec:"ctime" json:"ctime"`
	Fresh            bool                  `codec:"fresh" json:"fresh"`
	ProtVers         SyncAllProtVers       `codec:"protVers" json:"protVers"`
	HostName         string                `codec:"hostName" json:"hostName"`
	SummarizeMaxMsgs bool                  `codec:"summarizeMaxMsgs" json:"summarizeMaxMsgs"`
	ParticipantsMode InboxParticipantsMode `codec:"participantsMode" json:"participantsMode"`
}

type TlfFinalizeArg struct {
	TlfID          TLFID         `codec:"tlfID" json:"tlfID"`
	ResetUser      string        `codec:"resetUser" json:"resetUser"`
	ResetDate      string        `codec:"resetDate" json:"resetDate"`
	ResetTimestamp gregor1.Time  `codec:"resetTimestamp" json:"resetTimestamp"`
	ResetFull      string        `codec:"resetFull" json:"resetFull"`
	ResetUID       *keybase1.UID `codec:"resetUID,omitempty" json:"resetUID,omitempty"`
}

type TlfResolveArg struct {
	TlfID           TLFID         `codec:"tlfID" json:"tlfID"`
	ResolvedWriters []gregor1.UID `codec:"resolvedWriters" json:"resolvedWriters"`
	ResolvedReaders []gregor1.UID `codec:"resolvedReaders" json:"resolvedReaders"`
}

type UpdateTypingRemoteArg struct {
	Uid      gregor1.UID      `codec:"uid" json:"uid"`
	DeviceID gregor1.DeviceID `codec:"deviceID" json:"deviceID"`
	ConvID   ConversationID   `codec:"convID" json:"convID"`
	Typing   bool             `codec:"typing" json:"typing"`
}

type JoinConversationArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type LeaveConversationArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type PreviewConversationArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type DeleteConversationArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type RemoveFromConversationArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	Users  []gregor1.UID  `codec:"users" json:"users"`
}

type GetMessageBeforeArg struct {
	ConvID ConversationID      `codec:"convID" json:"convID"`
	Age    gregor1.DurationSec `codec:"age" json:"age"`
}

type GetTLFConversationsArg struct {
	TlfID            TLFID     `codec:"tlfID" json:"tlfID"`
	TopicType        TopicType `codec:"topicType" json:"topicType"`
	SummarizeMaxMsgs bool      `codec:"summarizeMaxMsgs" json:"summarizeMaxMsgs"`
}

type SetAppNotificationSettingsArg struct {
	ConvID   ConversationID               `codec:"convID" json:"convID"`
	Settings ConversationNotificationInfo `codec:"settings" json:"settings"`
}

type SetGlobalAppNotificationSettingsArg struct {
	Settings GlobalAppNotificationSettings `codec:"settings" json:"settings"`
}

type GetGlobalAppNotificationSettingsArg struct {
}

type RemoteNotificationSuccessfulArg struct {
	AuthToken        gregor1.SessionToken `codec:"authToken" json:"authToken"`
	CompanionPushIDs []string             `codec:"companionPushIDs" json:"companionPushIDs"`
}

type SetConvRetentionArg struct {
	ConvID       ConversationID  `codec:"convID" json:"convID"`
	Policy       RetentionPolicy `codec:"policy" json:"policy"`
	SweepChannel uint64          `codec:"sweepChannel" json:"sweepChannel"`
}

type SetTeamRetentionArg struct {
	TeamID       keybase1.TeamID `codec:"teamID" json:"teamID"`
	Policy       RetentionPolicy `codec:"policy" json:"policy"`
	SweepChannel uint64          `codec:"sweepChannel" json:"sweepChannel"`
}

type SetConvMinWriterRoleArg struct {
	ConvID ConversationID    `codec:"convID" json:"convID"`
	Role   keybase1.TeamRole `codec:"role" json:"role"`
}

type RetentionSweepConvArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type UpgradeKBFSToImpteamArg struct {
	TlfID  TLFID           `codec:"tlfID" json:"tlfID"`
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
}

type RegisterSharePostArg struct {
	ConvID   ConversationID   `codec:"convID" json:"convID"`
	DeviceID gregor1.DeviceID `codec:"deviceID" json:"deviceID"`
	OutboxID OutboxID         `codec:"outboxID" json:"outboxID"`
}

type FailSharePostArg struct {
	ConvID   ConversationID   `codec:"convID" json:"convID"`
	DeviceID gregor1.DeviceID `codec:"deviceID" json:"deviceID"`
	OutboxID OutboxID         `codec:"outboxID" json:"outboxID"`
}

type BroadcastGregorMessageToConvArg struct {
	ConvID ConversationID  `codec:"convID" json:"convID"`
	Msg    gregor1.Message `codec:"msg" json:"msg"`
}

type TeamIDOfConvArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type ServerNowArg struct {
}

type GetExternalAPIKeysArg struct {
	Typs []ExternalAPIKeyTyp `codec:"typs" json:"typs"`
}

type AdvertiseBotCommandsArg struct {
	Ads []RemoteBotCommandsAdvertisement `codec:"ads" json:"ads"`
}

type ClearBotCommandsArg struct {
	Filter *RemoteClearBotCommandsFilter `codec:"filter,omitempty" json:"filter,omitempty"`
}

type GetBotInfoArg struct {
	ConvID         ConversationID  `codec:"convID" json:"convID"`
	InfoHash       BotInfoHash     `codec:"infoHash" json:"infoHash"`
	ClientHashVers BotInfoHashVers `codec:"clientHashVers" json:"clientHashVers"`
}

type GetDefaultTeamChannelsArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
}

type SetDefaultTeamChannelsArg struct {
	TeamID keybase1.TeamID  `codec:"teamID" json:"teamID"`
	Convs  []ConversationID `codec:"convs" json:"convs"`
}

type GetRecentJoinsArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type RefreshParticipantsRemoteArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	Hash   string         `codec:"hash" json:"hash"`
}

type GetLastActiveAtArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
	Uid    gregor1.UID     `codec:"uid" json:"uid"`
}

type GetResetConversationsArg struct {
}

type RemoteInterface interface {
	GetInboxRemote(context.Context, GetInboxRemoteArg) (GetInboxRemoteRes, error)
	GetThreadRemote(context.Context, GetThreadRemoteArg) (GetThreadRemoteRes, error)
	GetUnreadlineRemote(context.Context, GetUnreadlineRemoteArg) (GetUnreadlineRemoteRes, error)
	GetPublicConversations(context.Context, GetPublicConversationsArg) (GetPublicConversationsRes, error)
	PostRemote(context.Context, PostRemoteArg) (PostRemoteRes, error)
	NewConversationRemote(context.Context, ConversationIDTriple) (NewConversationRemoteRes, error)
	NewConversationRemote2(context.Context, NewConversationRemote2Arg) (NewConversationRemoteRes, error)
	GetMessagesRemote(context.Context, GetMessagesRemoteArg) (GetMessagesRemoteRes, error)
	MarkAsRead(context.Context, MarkAsReadArg) (MarkAsReadRes, error)
	SetConversationStatus(context.Context, SetConversationStatusArg) (SetConversationStatusRes, error)
	GetUnreadUpdateFull(context.Context, InboxVers) (UnreadUpdateFull, error)
	GetS3Params(context.Context, ConversationID) (S3Params, error)
	S3Sign(context.Context, S3SignArg) ([]byte, error)
	GetInboxVersion(context.Context, gregor1.UID) (InboxVers, error)
	SyncInbox(context.Context, InboxVers) (SyncInboxRes, error)
	SyncChat(context.Context, SyncChatArg) (SyncChatRes, error)
	SyncAll(context.Context, SyncAllArg) (SyncAllResult, error)
	TlfFinalize(context.Context, TlfFinalizeArg) error
	TlfResolve(context.Context, TlfResolveArg) error
	UpdateTypingRemote(context.Context, UpdateTypingRemoteArg) error
	JoinConversation(context.Context, ConversationID) (JoinLeaveConversationRemoteRes, error)
	LeaveConversation(context.Context, ConversationID) (JoinLeaveConversationRemoteRes, error)
	PreviewConversation(context.Context, ConversationID) (JoinLeaveConversationRemoteRes, error)
	DeleteConversation(context.Context, ConversationID) (DeleteConversationRemoteRes, error)
	RemoveFromConversation(context.Context, RemoveFromConversationArg) (RemoveFromConversationRemoteRes, error)
	GetMessageBefore(context.Context, GetMessageBeforeArg) (GetMessageBeforeRes, error)
	GetTLFConversations(context.Context, GetTLFConversationsArg) (GetTLFConversationsRes, error)
	SetAppNotificationSettings(context.Context, SetAppNotificationSettingsArg) (SetAppNotificationSettingsRes, error)
	SetGlobalAppNotificationSettings(context.Context, GlobalAppNotificationSettings) error
	GetGlobalAppNotificationSettings(context.Context) (GlobalAppNotificationSettings, error)
	RemoteNotificationSuccessful(context.Context, RemoteNotificationSuccessfulArg) error
	SetConvRetention(context.Context, SetConvRetentionArg) (SetRetentionRes, error)
	SetTeamRetention(context.Context, SetTeamRetentionArg) (SetRetentionRes, error)
	SetConvMinWriterRole(context.Context, SetConvMinWriterRoleArg) (SetConvMinWriterRoleRes, error)
	RetentionSweepConv(context.Context, ConversationID) (SweepRes, error)
	UpgradeKBFSToImpteam(context.Context, UpgradeKBFSToImpteamArg) error
	RegisterSharePost(context.Context, RegisterSharePostArg) error
	FailSharePost(context.Context, FailSharePostArg) error
	BroadcastGregorMessageToConv(context.Context, BroadcastGregorMessageToConvArg) error
	TeamIDOfConv(context.Context, ConversationID) (*keybase1.TeamID, error)
	ServerNow(context.Context) (ServerNowRes, error)
	GetExternalAPIKeys(context.Context, []ExternalAPIKeyTyp) ([]ExternalAPIKey, error)
	AdvertiseBotCommands(context.Context, []RemoteBotCommandsAdvertisement) (AdvertiseBotCommandsRes, error)
	ClearBotCommands(context.Context, *RemoteClearBotCommandsFilter) (ClearBotCommandsRes, error)
	GetBotInfo(context.Context, GetBotInfoArg) (GetBotInfoRes, error)
	GetDefaultTeamChannels(context.Context, keybase1.TeamID) (GetDefaultTeamChannelsRes, error)
	SetDefaultTeamChannels(context.Context, SetDefaultTeamChannelsArg) (SetDefaultTeamChannelsRes, error)
	GetRecentJoins(context.Context, ConversationID) (GetRecentJoinsRes, error)
	RefreshParticipantsRemote(context.Context, RefreshParticipantsRemoteArg) (RefreshParticipantsRemoteRes, error)
	GetLastActiveAt(context.Context, GetLastActiveAtArg) (GetLastActiveAtRes, error)
	GetResetConversations(context.Context) (GetResetConversationsRes, error)
}

func RemoteProtocol(i RemoteInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "chat.1.remote",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getInboxRemote": {
				MakeArg: func() interface{} {
					var ret [1]GetInboxRemoteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetInboxRemoteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetInboxRemoteArg)(nil), args)
						return
					}
					ret, err = i.GetInboxRemote(ctx, typedArgs[0])
					return
				},
			},
			"getThreadRemote": {
				MakeArg: func() interface{} {
					var ret [1]GetThreadRemoteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetThreadRemoteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetThreadRemoteArg)(nil), args)
						return
					}
					ret, err = i.GetThreadRemote(ctx, typedArgs[0])
					return
				},
			},
			"getUnreadlineRemote": {
				MakeArg: func() interface{} {
					var ret [1]GetUnreadlineRemoteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUnreadlineRemoteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUnreadlineRemoteArg)(nil), args)
						return
					}
					ret, err = i.GetUnreadlineRemote(ctx, typedArgs[0])
					return
				},
			},
			"getPublicConversations": {
				MakeArg: func() interface{} {
					var ret [1]GetPublicConversationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPublicConversationsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPublicConversationsArg)(nil), args)
						return
					}
					ret, err = i.GetPublicConversations(ctx, typedArgs[0])
					return
				},
			},
			"postRemote": {
				MakeArg: func() interface{} {
					var ret [1]PostRemoteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostRemoteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostRemoteArg)(nil), args)
						return
					}
					ret, err = i.PostRemote(ctx, typedArgs[0])
					return
				},
			},
			"newConversationRemote": {
				MakeArg: func() interface{} {
					var ret [1]NewConversationRemoteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NewConversationRemoteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NewConversationRemoteArg)(nil), args)
						return
					}
					ret, err = i.NewConversationRemote(ctx, typedArgs[0].IdTriple)
					return
				},
			},
			"newConversationRemote2": {
				MakeArg: func() interface{} {
					var ret [1]NewConversationRemote2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NewConversationRemote2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]NewConversationRemote2Arg)(nil), args)
						return
					}
					ret, err = i.NewConversationRemote2(ctx, typedArgs[0])
					return
				},
			},
			"getMessagesRemote": {
				MakeArg: func() interface{} {
					var ret [1]GetMessagesRemoteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMessagesRemoteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMessagesRemoteArg)(nil), args)
						return
					}
					ret, err = i.GetMessagesRemote(ctx, typedArgs[0])
					return
				},
			},
			"markAsRead": {
				MakeArg: func() interface{} {
					var ret [1]MarkAsReadArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MarkAsReadArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MarkAsReadArg)(nil), args)
						return
					}
					ret, err = i.MarkAsRead(ctx, typedArgs[0])
					return
				},
			},
			"SetConversationStatus": {
				MakeArg: func() interface{} {
					var ret [1]SetConversationStatusArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetConversationStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetConversationStatusArg)(nil), args)
						return
					}
					ret, err = i.SetConversationStatus(ctx, typedArgs[0])
					return
				},
			},
			"GetUnreadUpdateFull": {
				MakeArg: func() interface{} {
					var ret [1]GetUnreadUpdateFullArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUnreadUpdateFullArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUnreadUpdateFullArg)(nil), args)
						return
					}
					ret, err = i.GetUnreadUpdateFull(ctx, typedArgs[0].InboxVers)
					return
				},
			},
			"getS3Params": {
				MakeArg: func() interface{} {
					var ret [1]GetS3ParamsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetS3ParamsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetS3ParamsArg)(nil), args)
						return
					}
					ret, err = i.GetS3Params(ctx, typedArgs[0].ConversationID)
					return
				},
			},
			"s3Sign": {
				MakeArg: func() interface{} {
					var ret [1]S3SignArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]S3SignArg)
					if !ok {
						err = rpc.NewTypeError((*[1]S3SignArg)(nil), args)
						return
					}
					ret, err = i.S3Sign(ctx, typedArgs[0])
					return
				},
			},
			"getInboxVersion": {
				MakeArg: func() interface{} {
					var ret [1]GetInboxVersionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetInboxVersionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetInboxVersionArg)(nil), args)
						return
					}
					ret, err = i.GetInboxVersion(ctx, typedArgs[0].Uid)
					return
				},
			},
			"syncInbox": {
				MakeArg: func() interface{} {
					var ret [1]SyncInboxArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SyncInboxArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SyncInboxArg)(nil), args)
						return
					}
					ret, err = i.SyncInbox(ctx, typedArgs[0].Vers)
					return
				},
			},
			"syncChat": {
				MakeArg: func() interface{} {
					var ret [1]SyncChatArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SyncChatArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SyncChatArg)(nil), args)
						return
					}
					ret, err = i.SyncChat(ctx, typedArgs[0])
					return
				},
			},
			"syncAll": {
				MakeArg: func() interface{} {
					var ret [1]SyncAllArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SyncAllArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SyncAllArg)(nil), args)
						return
					}
					ret, err = i.SyncAll(ctx, typedArgs[0])
					return
				},
			},
			"tlfFinalize": {
				MakeArg: func() interface{} {
					var ret [1]TlfFinalizeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TlfFinalizeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TlfFinalizeArg)(nil), args)
						return
					}
					err = i.TlfFinalize(ctx, typedArgs[0])
					return
				},
			},
			"tlfResolve": {
				MakeArg: func() interface{} {
					var ret [1]TlfResolveArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TlfResolveArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TlfResolveArg)(nil), args)
						return
					}
					err = i.TlfResolve(ctx, typedArgs[0])
					return
				},
			},
			"updateTypingRemote": {
				MakeArg: func() interface{} {
					var ret [1]UpdateTypingRemoteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateTypingRemoteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateTypingRemoteArg)(nil), args)
						return
					}
					err = i.UpdateTypingRemote(ctx, typedArgs[0])
					return
				},
			},
			"joinConversation": {
				MakeArg: func() interface{} {
					var ret [1]JoinConversationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]JoinConversationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]JoinConversationArg)(nil), args)
						return
					}
					ret, err = i.JoinConversation(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"leaveConversation": {
				MakeArg: func() interface{} {
					var ret [1]LeaveConversationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LeaveConversationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LeaveConversationArg)(nil), args)
						return
					}
					ret, err = i.LeaveConversation(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"previewConversation": {
				MakeArg: func() interface{} {
					var ret [1]PreviewConversationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PreviewConversationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PreviewConversationArg)(nil), args)
						return
					}
					ret, err = i.PreviewConversation(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"deleteConversation": {
				MakeArg: func() interface{} {
					var ret [1]DeleteConversationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteConversationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteConversationArg)(nil), args)
						return
					}
					ret, err = i.DeleteConversation(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"removeFromConversation": {
				MakeArg: func() interface{} {
					var ret [1]RemoveFromConversationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RemoveFromConversationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RemoveFromConversationArg)(nil), args)
						return
					}
					ret, err = i.RemoveFromConversation(ctx, typedArgs[0])
					return
				},
			},
			"getMessageBefore": {
				MakeArg: func() interface{} {
					var ret [1]GetMessageBeforeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMessageBeforeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMessageBeforeArg)(nil), args)
						return
					}
					ret, err = i.GetMessageBefore(ctx, typedArgs[0])
					return
				},
			},
			"getTLFConversations": {
				MakeArg: func() interface{} {
					var ret [1]GetTLFConversationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTLFConversationsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTLFConversationsArg)(nil), args)
						return
					}
					ret, err = i.GetTLFConversations(ctx, typedArgs[0])
					return
				},
			},
			"setAppNotificationSettings": {
				MakeArg: func() interface{} {
					var ret [1]SetAppNotificationSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetAppNotificationSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetAppNotificationSettingsArg)(nil), args)
						return
					}
					ret, err = i.SetAppNotificationSettings(ctx, typedArgs[0])
					return
				},
			},
			"setGlobalAppNotificationSettings": {
				MakeArg: func() interface{} {
					var ret [1]SetGlobalAppNotificationSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetGlobalAppNotificationSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetGlobalAppNotificationSettingsArg)(nil), args)
						return
					}
					err = i.SetGlobalAppNotificationSettings(ctx, typedArgs[0].Settings)
					return
				},
			},
			"getGlobalAppNotificationSettings": {
				MakeArg: func() interface{} {
					var ret [1]GetGlobalAppNotificationSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetGlobalAppNotificationSettings(ctx)
					return
				},
			},
			"remoteNotificationSuccessful": {
				MakeArg: func() interface{} {
					var ret [1]RemoteNotificationSuccessfulArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RemoteNotificationSuccessfulArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RemoteNotificationSuccessfulArg)(nil), args)
						return
					}
					err = i.RemoteNotificationSuccessful(ctx, typedArgs[0])
					return
				},
			},
			"setConvRetention": {
				MakeArg: func() interface{} {
					var ret [1]SetConvRetentionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetConvRetentionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetConvRetentionArg)(nil), args)
						return
					}
					ret, err = i.SetConvRetention(ctx, typedArgs[0])
					return
				},
			},
			"setTeamRetention": {
				MakeArg: func() interface{} {
					var ret [1]SetTeamRetentionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetTeamRetentionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetTeamRetentionArg)(nil), args)
						return
					}
					ret, err = i.SetTeamRetention(ctx, typedArgs[0])
					return
				},
			},
			"setConvMinWriterRole": {
				MakeArg: func() interface{} {
					var ret [1]SetConvMinWriterRoleArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetConvMinWriterRoleArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetConvMinWriterRoleArg)(nil), args)
						return
					}
					ret, err = i.SetConvMinWriterRole(ctx, typedArgs[0])
					return
				},
			},
			"retentionSweepConv": {
				MakeArg: func() interface{} {
					var ret [1]RetentionSweepConvArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RetentionSweepConvArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RetentionSweepConvArg)(nil), args)
						return
					}
					ret, err = i.RetentionSweepConv(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"upgradeKBFSToImpteam": {
				MakeArg: func() interface{} {
					var ret [1]UpgradeKBFSToImpteamArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpgradeKBFSToImpteamArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpgradeKBFSToImpteamArg)(nil), args)
						return
					}
					err = i.UpgradeKBFSToImpteam(ctx, typedArgs[0])
					return
				},
			},
			"registerSharePost": {
				MakeArg: func() interface{} {
					var ret [1]RegisterSharePostArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RegisterSharePostArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RegisterSharePostArg)(nil), args)
						return
					}
					err = i.RegisterSharePost(ctx, typedArgs[0])
					return
				},
			},
			"failSharePost": {
				MakeArg: func() interface{} {
					var ret [1]FailSharePostArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FailSharePostArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FailSharePostArg)(nil), args)
						return
					}
					err = i.FailSharePost(ctx, typedArgs[0])
					return
				},
			},
			"broadcastGregorMessageToConv": {
				MakeArg: func() interface{} {
					var ret [1]BroadcastGregorMessageToConvArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BroadcastGregorMessageToConvArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BroadcastGregorMessageToConvArg)(nil), args)
						return
					}
					err = i.BroadcastGregorMessageToConv(ctx, typedArgs[0])
					return
				},
			},
			"teamIDOfConv": {
				MakeArg: func() interface{} {
					var ret [1]TeamIDOfConvArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamIDOfConvArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamIDOfConvArg)(nil), args)
						return
					}
					ret, err = i.TeamIDOfConv(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"serverNow": {
				MakeArg: func() interface{} {
					var ret [1]ServerNowArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.ServerNow(ctx)
					return
				},
			},
			"getExternalAPIKeys": {
				MakeArg: func() interface{} {
					var ret [1]GetExternalAPIKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetExternalAPIKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetExternalAPIKeysArg)(nil), args)
						return
					}
					ret, err = i.GetExternalAPIKeys(ctx, typedArgs[0].Typs)
					return
				},
			},
			"advertiseBotCommands": {
				MakeArg: func() interface{} {
					var ret [1]AdvertiseBotCommandsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AdvertiseBotCommandsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AdvertiseBotCommandsArg)(nil), args)
						return
					}
					ret, err = i.AdvertiseBotCommands(ctx, typedArgs[0].Ads)
					return
				},
			},
			"clearBotCommands": {
				MakeArg: func() interface{} {
					var ret [1]ClearBotCommandsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ClearBotCommandsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ClearBotCommandsArg)(nil), args)
						return
					}
					ret, err = i.ClearBotCommands(ctx, typedArgs[0].Filter)
					return
				},
			},
			"getBotInfo": {
				MakeArg: func() interface{} {
					var ret [1]GetBotInfoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetBotInfoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetBotInfoArg)(nil), args)
						return
					}
					ret, err = i.GetBotInfo(ctx, typedArgs[0])
					return
				},
			},
			"getDefaultTeamChannels": {
				MakeArg: func() interface{} {
					var ret [1]GetDefaultTeamChannelsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetDefaultTeamChannelsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetDefaultTeamChannelsArg)(nil), args)
						return
					}
					ret, err = i.GetDefaultTeamChannels(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"setDefaultTeamChannels": {
				MakeArg: func() interface{} {
					var ret [1]SetDefaultTeamChannelsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetDefaultTeamChannelsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetDefaultTeamChannelsArg)(nil), args)
						return
					}
					ret, err = i.SetDefaultTeamChannels(ctx, typedArgs[0])
					return
				},
			},
			"getRecentJoins": {
				MakeArg: func() interface{} {
					var ret [1]GetRecentJoinsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetRecentJoinsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetRecentJoinsArg)(nil), args)
						return
					}
					ret, err = i.GetRecentJoins(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"refreshParticipantsRemote": {
				MakeArg: func() interface{} {
					var ret [1]RefreshParticipantsRemoteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RefreshParticipantsRemoteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RefreshParticipantsRemoteArg)(nil), args)
						return
					}
					ret, err = i.RefreshParticipantsRemote(ctx, typedArgs[0])
					return
				},
			},
			"getLastActiveAt": {
				MakeArg: func() interface{} {
					var ret [1]GetLastActiveAtArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetLastActiveAtArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetLastActiveAtArg)(nil), args)
						return
					}
					ret, err = i.GetLastActiveAt(ctx, typedArgs[0])
					return
				},
			},
			"getResetConversations": {
				MakeArg: func() interface{} {
					var ret [1]GetResetConversationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetResetConversations(ctx)
					return
				},
			},
		},
	}
}

type RemoteClient struct {
	Cli rpc.GenericClient
}

func (c RemoteClient) GetInboxRemote(ctx context.Context, __arg GetInboxRemoteArg) (res GetInboxRemoteRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getInboxRemote", []interface{}{__arg}, &res, rpc.CompressionGzip, 1200000*time.Millisecond)
	return
}

func (c RemoteClient) GetThreadRemote(ctx context.Context, __arg GetThreadRemoteArg) (res GetThreadRemoteRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getThreadRemote", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetUnreadlineRemote(ctx context.Context, __arg GetUnreadlineRemoteArg) (res GetUnreadlineRemoteRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getUnreadlineRemote", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetPublicConversations(ctx context.Context, __arg GetPublicConversationsArg) (res GetPublicConversationsRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getPublicConversations", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) PostRemote(ctx context.Context, __arg PostRemoteArg) (res PostRemoteRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.postRemote", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) NewConversationRemote(ctx context.Context, idTriple ConversationIDTriple) (res NewConversationRemoteRes, err error) {
	__arg := NewConversationRemoteArg{IdTriple: idTriple}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.newConversationRemote", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) NewConversationRemote2(ctx context.Context, __arg NewConversationRemote2Arg) (res NewConversationRemoteRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.newConversationRemote2", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetMessagesRemote(ctx context.Context, __arg GetMessagesRemoteArg) (res GetMessagesRemoteRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getMessagesRemote", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) MarkAsRead(ctx context.Context, __arg MarkAsReadArg) (res MarkAsReadRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.markAsRead", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SetConversationStatus(ctx context.Context, __arg SetConversationStatusArg) (res SetConversationStatusRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.SetConversationStatus", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetUnreadUpdateFull(ctx context.Context, inboxVers InboxVers) (res UnreadUpdateFull, err error) {
	__arg := GetUnreadUpdateFullArg{InboxVers: inboxVers}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.GetUnreadUpdateFull", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetS3Params(ctx context.Context, conversationID ConversationID) (res S3Params, err error) {
	__arg := GetS3ParamsArg{ConversationID: conversationID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getS3Params", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) S3Sign(ctx context.Context, __arg S3SignArg) (res []byte, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.s3Sign", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetInboxVersion(ctx context.Context, uid gregor1.UID) (res InboxVers, err error) {
	__arg := GetInboxVersionArg{Uid: uid}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getInboxVersion", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SyncInbox(ctx context.Context, vers InboxVers) (res SyncInboxRes, err error) {
	__arg := SyncInboxArg{Vers: vers}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.syncInbox", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SyncChat(ctx context.Context, __arg SyncChatArg) (res SyncChatRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.syncChat", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SyncAll(ctx context.Context, __arg SyncAllArg) (res SyncAllResult, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.syncAll", []interface{}{__arg}, &res, rpc.CompressionMsgpackzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) TlfFinalize(ctx context.Context, __arg TlfFinalizeArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.tlfFinalize", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) TlfResolve(ctx context.Context, __arg TlfResolveArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.tlfResolve", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) UpdateTypingRemote(ctx context.Context, __arg UpdateTypingRemoteArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.updateTypingRemote", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) JoinConversation(ctx context.Context, convID ConversationID) (res JoinLeaveConversationRemoteRes, err error) {
	__arg := JoinConversationArg{ConvID: convID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.joinConversation", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) LeaveConversation(ctx context.Context, convID ConversationID) (res JoinLeaveConversationRemoteRes, err error) {
	__arg := LeaveConversationArg{ConvID: convID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.leaveConversation", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) PreviewConversation(ctx context.Context, convID ConversationID) (res JoinLeaveConversationRemoteRes, err error) {
	__arg := PreviewConversationArg{ConvID: convID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.previewConversation", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) DeleteConversation(ctx context.Context, convID ConversationID) (res DeleteConversationRemoteRes, err error) {
	__arg := DeleteConversationArg{ConvID: convID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.deleteConversation", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) RemoveFromConversation(ctx context.Context, __arg RemoveFromConversationArg) (res RemoveFromConversationRemoteRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.removeFromConversation", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetMessageBefore(ctx context.Context, __arg GetMessageBeforeArg) (res GetMessageBeforeRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getMessageBefore", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetTLFConversations(ctx context.Context, __arg GetTLFConversationsArg) (res GetTLFConversationsRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getTLFConversations", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SetAppNotificationSettings(ctx context.Context, __arg SetAppNotificationSettingsArg) (res SetAppNotificationSettingsRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.setAppNotificationSettings", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SetGlobalAppNotificationSettings(ctx context.Context, settings GlobalAppNotificationSettings) (err error) {
	__arg := SetGlobalAppNotificationSettingsArg{Settings: settings}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.setGlobalAppNotificationSettings", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetGlobalAppNotificationSettings(ctx context.Context) (res GlobalAppNotificationSettings, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getGlobalAppNotificationSettings", []interface{}{GetGlobalAppNotificationSettingsArg{}}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) RemoteNotificationSuccessful(ctx context.Context, __arg RemoteNotificationSuccessfulArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.remote.remoteNotificationSuccessful", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c RemoteClient) SetConvRetention(ctx context.Context, __arg SetConvRetentionArg) (res SetRetentionRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.setConvRetention", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SetTeamRetention(ctx context.Context, __arg SetTeamRetentionArg) (res SetRetentionRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.setTeamRetention", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SetConvMinWriterRole(ctx context.Context, __arg SetConvMinWriterRoleArg) (res SetConvMinWriterRoleRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.setConvMinWriterRole", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) RetentionSweepConv(ctx context.Context, convID ConversationID) (res SweepRes, err error) {
	__arg := RetentionSweepConvArg{ConvID: convID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.retentionSweepConv", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) UpgradeKBFSToImpteam(ctx context.Context, __arg UpgradeKBFSToImpteamArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.upgradeKBFSToImpteam", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) RegisterSharePost(ctx context.Context, __arg RegisterSharePostArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.registerSharePost", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) FailSharePost(ctx context.Context, __arg FailSharePostArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.failSharePost", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) BroadcastGregorMessageToConv(ctx context.Context, __arg BroadcastGregorMessageToConvArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.broadcastGregorMessageToConv", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) TeamIDOfConv(ctx context.Context, convID ConversationID) (res *keybase1.TeamID, err error) {
	__arg := TeamIDOfConvArg{ConvID: convID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.teamIDOfConv", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) ServerNow(ctx context.Context) (res ServerNowRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.serverNow", []interface{}{ServerNowArg{}}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetExternalAPIKeys(ctx context.Context, typs []ExternalAPIKeyTyp) (res []ExternalAPIKey, err error) {
	__arg := GetExternalAPIKeysArg{Typs: typs}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getExternalAPIKeys", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) AdvertiseBotCommands(ctx context.Context, ads []RemoteBotCommandsAdvertisement) (res AdvertiseBotCommandsRes, err error) {
	__arg := AdvertiseBotCommandsArg{Ads: ads}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.advertiseBotCommands", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) ClearBotCommands(ctx context.Context, filter *RemoteClearBotCommandsFilter) (res ClearBotCommandsRes, err error) {
	__arg := ClearBotCommandsArg{Filter: filter}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.clearBotCommands", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetBotInfo(ctx context.Context, __arg GetBotInfoArg) (res GetBotInfoRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getBotInfo", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetDefaultTeamChannels(ctx context.Context, teamID keybase1.TeamID) (res GetDefaultTeamChannelsRes, err error) {
	__arg := GetDefaultTeamChannelsArg{TeamID: teamID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getDefaultTeamChannels", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) SetDefaultTeamChannels(ctx context.Context, __arg SetDefaultTeamChannelsArg) (res SetDefaultTeamChannelsRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.setDefaultTeamChannels", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetRecentJoins(ctx context.Context, convID ConversationID) (res GetRecentJoinsRes, err error) {
	__arg := GetRecentJoinsArg{ConvID: convID}
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getRecentJoins", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) RefreshParticipantsRemote(ctx context.Context, __arg RefreshParticipantsRemoteArg) (res RefreshParticipantsRemoteRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.refreshParticipantsRemote", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetLastActiveAt(ctx context.Context, __arg GetLastActiveAtArg) (res GetLastActiveAtRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getLastActiveAt", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c RemoteClient) GetResetConversations(ctx context.Context) (res GetResetConversationsRes, err error) {
	err = c.Cli.CallCompressed(ctx, "chat.1.remote.getResetConversations", []interface{}{GetResetConversationsArg{}}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}
