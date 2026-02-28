package common

import (
	"github.com/keybase/client/packaging/linux/tuxbot/bot/access"
	"github.com/keybase/go-keybase-chat-bot/kbchat/types/chat1"
)

var self access.Username = "tuxbot"

var tuxbotAdmins = []access.Username{self, "max", "mikem", "modalduality", "cjb", "jzila",
	"patrick", "songgao", "strib", "joshblum", "mlsteele"}

func SimpleTuxbotACL(infoChannel chat1.ChatChannel) access.ACL {
	return access.NewConstantACL(map[chat1.ChatChannel][]access.Username{
		infoChannel: tuxbotAdmins,
	})
}
