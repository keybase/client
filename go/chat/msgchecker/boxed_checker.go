package msgchecker

import (
	"fmt"

	"github.com/keybase/client/go/protocol/chat1"
)

type MessageBoxedLengthExceedingError struct {
	DescriptibleItemName string
	ActualLength         int
	MaxLength            int
}

func (e MessageBoxedLengthExceedingError) Error() string {
	return fmt.Sprintf("%s exceeds the maximum length (%v > %v)", e.DescriptibleItemName, e.ActualLength, e.MaxLength)
}

func boxedFieldLengthChecker(descriptibleItemName string, actualLength int, maxLength int) error {
	if actualLength > maxLength {
		return MessageBoxedLengthExceedingError{
			DescriptibleItemName: descriptibleItemName,
			ActualLength:         actualLength,
			MaxLength:            maxLength,
		}
	}
	return nil
}

func checkMessageBoxedLength(msg chat1.MessageBoxed) error {
	textMsgLength := getBoxedMaxTextLength(msg.ClientHeader.Conv.TopicType)
	switch msg.GetMessageType() {
	case chat1.MessageType_ATTACHMENT,
		chat1.MessageType_DELETE,
		chat1.MessageType_NONE,
		chat1.MessageType_TLFNAME,
		chat1.MessageType_ATTACHMENTUPLOADED,
		chat1.MessageType_UNFURL:
		return boxedFieldLengthChecker("sanity check", len(msg.BodyCiphertext.E), BoxedSanityLength)
	case chat1.MessageType_TEXT, chat1.MessageType_FLIP:
		return boxedFieldLengthChecker("TEXT message", len(msg.BodyCiphertext.E), textMsgLength)
	case chat1.MessageType_EDIT:
		return boxedFieldLengthChecker("EDIT message", len(msg.BodyCiphertext.E), textMsgLength)
	case chat1.MessageType_REACTION:
		return boxedFieldLengthChecker("REACTION message", len(msg.BodyCiphertext.E), BoxedReactionMessageBodyMaxLength)
	case chat1.MessageType_HEADLINE:
		return boxedFieldLengthChecker("HEADLINE message", len(msg.BodyCiphertext.E), BoxedHeadlineMessageBodyMaxLength)
	case chat1.MessageType_METADATA:
		return boxedFieldLengthChecker("METADATA message", len(msg.BodyCiphertext.E), BoxedMetadataMessageBodyMaxLength)
	case chat1.MessageType_JOIN:
		return boxedFieldLengthChecker("JOIN message", len(msg.BodyCiphertext.E), BoxedJoinMessageBodyMaxLength)
	case chat1.MessageType_LEAVE:
		return boxedFieldLengthChecker("LEAVE message", len(msg.BodyCiphertext.E), BoxedLeaveMessageBodyMaxLength)
	case chat1.MessageType_SYSTEM:
		return boxedFieldLengthChecker("SYSTEM message", len(msg.BodyCiphertext.E),
			BoxedSystemMessageBodyMaxLength)
	case chat1.MessageType_DELETEHISTORY:
		return boxedFieldLengthChecker("DELETEHISTORY message", len(msg.BodyCiphertext.E),
			BoxedDeleteHistoryMessageBodyMaxLength)
	case chat1.MessageType_SENDPAYMENT:
		return boxedFieldLengthChecker("SENDPAYMENT message", len(msg.BodyCiphertext.E),
			BoxedSendPaymentMessageBodyMaxLength)
	case chat1.MessageType_REQUESTPAYMENT:
		return boxedFieldLengthChecker("REQUESTPAYMENT message", len(msg.BodyCiphertext.E),
			BoxedRequestPaymentMessageBodyMaxLength)
	default:
		return fmt.Errorf("unknown message type: %v", msg.GetMessageType())
	}
}

func CheckMessageBoxed(msg chat1.MessageBoxed) error {
	return checkMessageBoxedLength(msg)
}
