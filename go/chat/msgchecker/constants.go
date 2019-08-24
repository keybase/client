package msgchecker

import "github.com/keybase/client/go/protocol/chat1"

const (
	TextMessageMaxLength        = 10000
	DevTextMessageMaxLength     = 1000000
	ReactionMessageMaxLength    = 50
	HeadlineMaxLength           = 280
	TopicMaxLength              = 20
	RequestPaymentTextMaxLength = 240
)

const (
	BoxedTextMessageBodyMaxLength           = 11000
	DevBoxedTextMessageBodyMaxLength        = 1100000
	BoxedEditMessageBodyMaxLength           = 11000
	BoxedReactionMessageBodyMaxLength       = 150
	BoxedHeadlineMessageBodyMaxLength       = 380
	BoxedMetadataMessageBodyMaxLength       = 200
	BoxedJoinMessageBodyMaxLength           = 200
	BoxedLeaveMessageBodyMaxLength          = 200
	BoxedSystemMessageBodyMaxLength         = 5000
	BoxedDeleteHistoryMessageBodyMaxLength  = 200
	BoxedSendPaymentMessageBodyMaxLength    = 200
	BoxedRequestPaymentMessageBodyMaxLength = 500
	BoxedSanityLength                       = 5000000
)

func getMaxTextLength(topicType chat1.TopicType) (textMsgLength int) {
	switch topicType {
	case chat1.TopicType_CHAT:
		textMsgLength = TextMessageMaxLength
	case chat1.TopicType_DEV, chat1.TopicType_KBFSFILEEDIT:
		textMsgLength = DevTextMessageMaxLength
	default:
		textMsgLength = TextMessageMaxLength
	}
	return textMsgLength
}

func getBoxedMaxTextLength(topicType chat1.TopicType) (textMsgLength int) {
	switch topicType {
	case chat1.TopicType_CHAT:
		textMsgLength = BoxedTextMessageBodyMaxLength
	case chat1.TopicType_DEV, chat1.TopicType_KBFSFILEEDIT:
		textMsgLength = DevBoxedTextMessageBodyMaxLength
	default:
		textMsgLength = BoxedTextMessageBodyMaxLength
	}
	return textMsgLength
}
