package access

import (
	"fmt"

	"github.com/keybase/go-keybase-chat-bot/kbchat/types/chat1"
)

type Username string

type ACL interface {
	Allowed(chat1.ChatChannel, Username) (bool, error)
}

type ConstantACL struct {
	allowed map[chat1.ChatChannel][]Username
}

type BadChannelError struct{}

func (BadChannelError) Error() string {
	return "bad channel"
}

func (c *ConstantACL) Allowed(channel chat1.ChatChannel, username Username) (bool, error) {
	users, ok := c.allowed[channel]
	if !ok {
		return false, BadChannelError{}
	}
	for _, x := range users {
		if x == username {
			return true, nil
		}
	}
	return false, fmt.Errorf("username not allowed")
}

func NewConstantACL(allowed map[chat1.ChatChannel][]Username) ACL {
	return &ConstantACL{allowed: allowed}
}
