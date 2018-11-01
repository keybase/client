package unfurl

import (
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
)

type Settings struct {
	utils.DebugLabeler

	storage types.ConversationBackedStorage
}

func NewSettings(log logger.Logger, storage types.ConversationBackedStorage) *Settings {
	return &Settings{
		DebugLabeler: utils.NewDebugLabeler(log, "Settings", false),
		storage:      storage,
	}
}
