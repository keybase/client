package msgchecker

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/protocol/chat1"
)

type MessagePlaintextLengthExceedingError struct {
	MaxLength            int
	DescriptibleItemName string
}

func (e MessagePlaintextLengthExceedingError) Error() string {
	return fmt.Sprintf("%s exceeds the maximum length of %d bytes", e.DescriptibleItemName, e.MaxLength)
}

func (e MessagePlaintextLengthExceedingError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_TOOLONG, true
}

func plaintextFieldLengthChecker(descriptibleItemName string, actualLength int, maxLength int) error {
	if actualLength > maxLength {
		return MessagePlaintextLengthExceedingError{
			MaxLength:            maxLength,
			DescriptibleItemName: descriptibleItemName,
		}
	}
	return nil
}

func checkMessagePlaintextLength(msg chat1.MessagePlaintext) error {
	mtype, err := msg.MessageBody.MessageType()
	if err != nil {
		return err
	}
	switch mtype {
	case chat1.MessageType_ATTACHMENT, chat1.MessageType_DELETE, chat1.MessageType_NONE, chat1.MessageType_TLFNAME, chat1.MessageType_ATTACHMENTUPLOADED:
		return nil
	case chat1.MessageType_TEXT:
		return plaintextFieldLengthChecker("message", len(msg.MessageBody.Text().Body), TextMessageMaxLength)
	case chat1.MessageType_EDIT:
		return plaintextFieldLengthChecker("message edit", len(msg.MessageBody.Edit().Body), TextMessageMaxLength)
	case chat1.MessageType_HEADLINE:
		return plaintextFieldLengthChecker("headline", len(msg.MessageBody.Headline().Headline), HeadlineMaxLength)
	case chat1.MessageType_METADATA:
		return plaintextFieldLengthChecker("topic name", len(msg.MessageBody.Metadata().ConversationTitle), TopicMaxLength)
	default:
		return errors.New("unknown message type")
	}
}

func CheckMessagePlaintext(msg chat1.MessagePlaintext) error {
	return checkMessagePlaintextLength(msg)
}
