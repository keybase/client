package unfurl

import (
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
)

type Settings struct {
	utils.DebugLabeler
}

func NewSettings(log logger.Logger) *Settings {
	return &Settings{
		DebugLabeler: utils.NewDebugLabeler(log, "Settings", false),
	}
}
