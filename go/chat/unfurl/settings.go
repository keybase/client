package unfurl

import (
	"context"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const settingsModeName = "__unfurl_settings_mode"
const settingsWhitelistName = "__unfurl_settings_whitelist"

type modeRecord struct {
	Mode chat1.UnfurlMode
}

type whitelistRecord struct {
	Whitelist map[string]bool
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

func (s *Settings) Get(ctx context.Context, uid gregor1.UID) (res chat1.UnfurlSettings, err error) {
	defer s.Trace(ctx, func() error { return err }, "Get")()

	var mr modeRecord
	found, err := s.storage.Get(ctx, uid, settingsModeName, &mr)
	if err != nil {
		return res, err
	}
	if !found {
		s.Debug(ctx, "Get: no mode setting found, using whitelisted")
		mr.Mode = chat1.UnfurlMode_WHITELISTED
	}

	var wr whitelistRecord
	whitelist := make(map[string]bool)
	if found, err = s.storage.Get(ctx, uid, settingsWhitelistName, &wr); err != nil {
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

func (s *Settings) WhitelistAdd(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "WhitelistAdd(%s)", domain)()
	var wr whitelistRecord
	found, err := s.storage.Get(ctx, uid, settingsWhitelistName, &wr)
	if err != nil {
		return err
	}
	if !found {
		wr.Whitelist = make(map[string]bool)
	}
	if wr.Whitelist[domain] {
		return nil
	}
	wr.Whitelist[domain] = true
	return s.storage.Put(ctx, uid, settingsWhitelistName, wr)
}

func (s *Settings) WhitelistRemove(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "WhitelistRemove(%s)", domain)()
	var wr whitelistRecord
	found, err := s.storage.Get(ctx, uid, settingsWhitelistName, &wr)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}
	if !wr.Whitelist[domain] {
		s.Debug(ctx, "WhitelistRemove: not found, doing nothing")
		return nil
	}
	delete(wr.Whitelist, domain)
	return s.storage.Put(ctx, uid, settingsWhitelistName, wr)
}

func (s *Settings) SetMode(ctx context.Context, uid gregor1.UID, mode chat1.UnfurlMode) (err error) {
	defer s.Trace(ctx, func() error { return err }, "SetMode(%v)", mode)()
	return s.storage.Put(ctx, uid, settingsModeName, modeRecord{
		Mode: mode,
	})
}

func (s *Settings) Set(ctx context.Context, uid gregor1.UID, settings chat1.UnfurlSettings) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Set")()
	if err = s.storage.Put(ctx, uid, settingsModeName, modeRecord{
		Mode: settings.Mode,
	}); err != nil {
		return err
	}
	if err = s.storage.Put(ctx, uid, settingsWhitelistName, whitelistRecord{
		Whitelist: settings.Whitelist,
	}); err != nil {
		return err
	}
	return nil
}
