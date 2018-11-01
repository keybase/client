package unfurl

import (
	"testing"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/logger"
)

func TestPackager(t *testing.T) {
	log := logger.NewTestLogger(t)
	store := attachments.NewStoreTesting(log, nil)
}
