package msgchecker

import (
	"fmt"

	"github.com/keybase/client/go/protocol/chat1"
)

type MessageBoxedLengthExceedingError struct {
	DescriptibleItemName string
}

func (e MessageBoxedLengthExceedingError) Error() string {
	return fmt.Sprintf("%s exceeds the maximum length", e.DescriptibleItemName)
}

func boxedFieldLengthChecker(descriptibleItemName string, actualLength int, maxLength int) error {
	if actualLength > maxLength {
		return MessageBoxedLengthExceedingError{
			DescriptibleItemName: descriptibleItemName,
		}
	}
	return nil
}

func checkMessageBoxedLength(msg chat1.MessageBoxed) error {
	switch msg.GetMessageType() {
	case chat1.MessageType_ATTACHMENT, chat1.MessageType_DELETE, chat1.MessageType_NONE, chat1.MessageType_TLFNAME, chat1.MessageType_ATTACHMENTUPLOADED:
		return nil
	case chat1.MessageType_TEXT:
		return boxedFieldLengthChecker("TEXT message", len(msg.BodyCiphertext.E), BoxedTextMessageBodyMaxLength)
	case chat1.MessageType_EDIT:
		return boxedFieldLengthChecker("EDIT message", len(msg.BodyCiphertext.E), BoxedTextMessageBodyMaxLength)
	case chat1.MessageType_HEADLINE:
		return boxedFieldLengthChecker("HEADLINE message", len(msg.BodyCiphertext.E), BoxedHeadlineMessageBodyMaxLength)
	case chat1.MessageType_METADATA:
		return boxedFieldLengthChecker("METADATA message", len(msg.BodyCiphertext.E), BoxedMetadataMessageBodyMaxLength)
	case chat1.MessageType_JOINLEAVE:
		return boxedFieldLengthChecker("JOINLEAVE message", len(msg.BodyCiphertext.E), BoxedJoinLeaveMessageBodyMaxLength)
	default:
		return fmt.Errorf("unknown message type: %v", msg.GetMessageType())
	}
}

func CheckMessageBoxed(msg chat1.MessageBoxed) error {
	return checkMessageBoxedLength(msg)
}
