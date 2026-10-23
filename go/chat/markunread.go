package chat

import "github.com/keybase/client/go/protocol/chat1"

// readPositionForUnreadFrom decides where the read position goes when the user marks a
// conversation unread from fromID on: the newest visible message strictly older than fromID,
// so that fromID becomes the first unread message. A zero fromID means the conversation's
// newest visible message. ok is false when nothing should change.
//
// Not implemented yet: see markunread_test.go for the specified behaviour.
func readPositionForUnreadFrom(msgs []chat1.MessageUnboxed, fromID chat1.MessageID) (readID chat1.MessageID, ok bool) {
	return 0, false
}
