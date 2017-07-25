package msgchecker

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/keybase/client/go/protocol/chat1"
)

var validTopicNameRegex = regexp.MustCompile(`^[0-9a-zA-Z_-]+$`)

type validateTopicNameRes int

const (
	validateTopicNameResOK            validateTopicNameRes = 0
	validateTopicNameResInvalidLength validateTopicNameRes = 1
	validateTopicNameResInvalidChar   validateTopicNameRes = 2
)

func (r validateTopicNameRes) String() string {
	switch r {
	case validateTopicNameResInvalidChar:
		return "invalid characters in channel name, please use alphanumeric plus _ and -"
	case validateTopicNameResInvalidLength:
		return "invalid channel name length. Must be greater than 0 and <= 20"
	case validateTopicNameResOK:
		return "OK"
	}
	return ""
}

func validateTopicName(topicName string) validateTopicNameRes {
	if len(topicName) == 0 || len(topicName) > TopicMaxLength {
		return validateTopicNameResInvalidLength
	}
	if !validTopicNameRegex.MatchString(topicName) {
		return validateTopicNameResInvalidChar
	}
	return validateTopicNameResOK
}

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
		topicNameRes := validateTopicName(msg.MessageBody.Metadata().ConversationTitle)
		if validateTopicNameResOK != topicNameRes {
			return errors.New(topicNameRes.String())
		}
		return nil
	default:
		return errors.New("unknown message type")
	}
}

func CheckMessagePlaintext(msg chat1.MessagePlaintext) error {
	return checkMessagePlaintextLength(msg)
}
