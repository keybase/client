package unfurl

import (
	"context"
	"sort"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
)

const settingsModeName = "__unfurl_settings_mode"
const settingsWhitelistName = "__unfurl_settings_whitelist"

type modeRecord struct {
	Mode chat1.UnfurlMode
}

type whitelistRecord struct {
	Whitelist []string
}

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

func (s *Settings) defaultSettings() chat1.UnfurlSettings {
	return chat1.UnfurlSettings{
		Mode: chat1.UnfurlMode_WHITELISTED,
	}
}

func (s *Settings) Get(ctx context.Context) (res chat1.UnfurlSettings, err error) {
	defer s.Trace(ctx, func() error { return err }, "Get")()

	var mr modeRecord
	found, err := s.storage.Get(ctx, settingsModeName, &mr)
	if err != nil {
		return res, err
	}
	if !found {
		s.Debug(ctx, "Get: no settings found, returning default")
		return s.defaultSettings(), nil
	}

	var wr whitelistRecord
	var whitelist []string
	if found, err = s.storage.Get(ctx, settingsWhitelistName, &wr); err != nil {
		return res, err
	}
	if found {
		whitelist = wr.Whitelist
	}
	return chat1.UnfurlSettings{
		Mode:      mr.Mode,
		Whitelist: whitelist,
	}, nil
}

func (s *Settings) WhitelistAdd(ctx context.Context, domain string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "WhitelistAdd(%s)", domain)()
	var wr whitelistRecord
	found, err := s.storage.Get(ctx, settingsWhitelistName, &wr)
	if err != nil {
		return err
	}
	if !found {
		wr.Whitelist = nil
	}
	for _, w := range wr.Whitelist {
		if w == domain {
			return nil
		}
	}
	wr.Whitelist = append(wr.Whitelist, domain)
	sort.Slice(wr.Whitelist, func(i, j int) bool {
		return wr.Whitelist[i] < wr.Whitelist[j]
	})
	return s.storage.Put(ctx, settingsWhitelistName, wr)
}

func (s *Settings) WhitelistRemove(ctx context.Context, domain string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "WhitelistRemove(%s)", domain)()
	var wr whitelistRecord
	found, err := s.storage.Get(ctx, settingsWhitelistName, &wr)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}
	deleted := false
	for index, w := range wr.Whitelist {
		if w == domain {
			wr.Whitelist = append(wr.Whitelist[:index],
				append([]string{domain}, wr.Whitelist[index+1:]...)...)
			deleted = true
			break
		}
	}
	if !deleted {
		return nil
	}
	return s.storage.Put(ctx, settingsWhitelistName, wr)
}

func (s *Settings) SetMode(ctx context.Context, mode chat1.UnfurlMode) (err error) {
	defer s.Trace(ctx, func() error { return err }, "SetMode(%v)", mode)()
	return s.storage.Put(ctx, settingsModeName, modeRecord{
		Mode: mode,
	})
}
