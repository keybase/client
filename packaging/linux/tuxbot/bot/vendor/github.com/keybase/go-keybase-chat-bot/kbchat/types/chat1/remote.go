// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/chat1/remote.avdl

package chat1

import (
	"errors"
	"fmt"

	gregor1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/gregor1"
	keybase1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/keybase1"
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
	Msgs      []MessageBoxed `codec:"msgs" json:"msgs"`
	RateLimit *RateLimit     `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
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

type RemoteBotCommandsAdvertisement struct {
	Typ__          BotCommandsAdvertisementTyp           `codec:"typ" json:"typ"`
	Public__       *RemoteBotCommandsAdvertisementPublic `codec:"public,omitempty" json:"public,omitempty"`
	TlfidMembers__ *RemoteBotCommandsAdvertisementTLFID  `codec:"tlfidMembers,omitempty" json:"tlfidMembers,omitempty"`
	TlfidConvs__   *RemoteBotCommandsAdvertisementTLFID  `codec:"tlfidConvs,omitempty" json:"tlfidConvs,omitempty"`
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
	}
}

type BotCommandConv struct {
	Uid               gregor1.UID       `codec:"uid" json:"uid"`
	UntrustedTeamRole keybase1.TeamRole `codec:"untrustedTeamRole" json:"untrustedTeamRole"`
	ConvID            ConversationID    `codec:"convID" json:"convID"`
	Vers              CommandConvVers   `codec:"vers" json:"vers"`
	Mtime             gregor1.Time      `codec:"mtime" json:"mtime"`
}

func (o BotCommandConv) DeepCopy() BotCommandConv {
	return BotCommandConv{
		Uid:               o.Uid.DeepCopy(),
		UntrustedTeamRole: o.UntrustedTeamRole.DeepCopy(),
		ConvID:            o.ConvID.DeepCopy(),
		Vers:              o.Vers.DeepCopy(),
		Mtime:             o.Mtime.DeepCopy(),
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
