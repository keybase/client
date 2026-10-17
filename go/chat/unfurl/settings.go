package unfurl

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const (
	settingsModeName      = "__unfurl_settings_mode"
	settingsWhitelistName = "__unfurl_settings_whitelist"
	settingsBlocklistName = "__unfurl_settings_blocklist"
)

type modeRecord struct {
	Mode chat1.UnfurlMode
}

type whitelistRecord struct {
	Whitelist map[string]bool
}

type blocklistRecord struct {
	Blocklist map[string]bool
}

type Settings struct {
	utils.DebugLabeler

	storage types.UserConversationBackedStorage
}

func NewSettings(g *globals.Context, storage types.UserConversationBackedStorage) *Settings {
	return &Settings{
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "Settings", false),
		storage:      storage,
	}
}

func (s *Settings) getWhitelist(ctx context.Context, uid gregor1.UID) (map[string]bool, error) {
	var wr whitelistRecord
	if _, err := s.storage.Get(ctx, uid, settingsWhitelistName, &wr); err != nil {
		return nil, err
	}
	return cleanDomainSet(wr.Whitelist), nil
}

func (s *Settings) getBlocklist(ctx context.Context, uid gregor1.UID) (map[string]bool, error) {
	var br blocklistRecord
	if _, err := s.storage.Get(ctx, uid, settingsBlocklistName, &br); err != nil {
		return nil, err
	}
	return cleanDomainSet(br.Blocklist), nil
}

func (s *Settings) Get(ctx context.Context, uid gregor1.UID) (res chat1.UnfurlSettings, err error) {
	defer s.Trace(ctx, &err, "Get")()

	var mr modeRecord
	found, err := s.storage.Get(ctx, uid, settingsModeName, &mr)
	if err != nil {
		return res, err
	}
	if !found {
		s.Debug(ctx, "Get: no mode setting found, using whitelisted")
		mr.Mode = chat1.UnfurlMode_WHITELISTED
	}
	whitelist, err := s.getWhitelist(ctx, uid)
	if err != nil {
		return res, err
	}
	blocklist, err := s.getBlocklist(ctx, uid)
	if err != nil {
		return res, err
	}
	// clients that predate the block list can allow a domain without unblocking
	// it. The block list wins, as it does when unfurling, so Set accepts the result.
	for domain := range blocklist {
		delete(whitelist, domain)
	}
	return chat1.UnfurlSettings{
		Mode:      mr.Mode,
		Whitelist: whitelist,
		Blocklist: blocklist,
	}, nil
}

// WhitelistAdd and BlocklistAdd take a domain already derived by GetDomain or
// NormalizeDomain, and move it off the opposite list.
func (s *Settings) WhitelistAdd(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, &err, "WhitelistAdd(%s)", domain)()
	if isAutoAllowedDomain(domain) {
		return autoAllowedError(domain)
	}
	blocklist, err := s.getBlocklist(ctx, uid)
	if err != nil {
		return err
	}
	if blocklist[domain] {
		delete(blocklist, domain)
		if err := s.storage.Put(ctx, uid, settingsBlocklistName, blocklistRecord{Blocklist: blocklist}); err != nil {
			return err
		}
	}
	whitelist, err := s.getWhitelist(ctx, uid)
	if err != nil {
		return err
	}
	if whitelist[domain] {
		return nil
	}
	whitelist[domain] = true
	return s.storage.Put(ctx, uid, settingsWhitelistName, whitelistRecord{Whitelist: whitelist})
}

func (s *Settings) WhitelistRemove(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, &err, "WhitelistRemove(%s)", domain)()
	whitelist, err := s.getWhitelist(ctx, uid)
	if err != nil {
		return err
	}
	if !whitelist[domain] {
		s.Debug(ctx, "WhitelistRemove: not found, doing nothing")
		return nil
	}
	delete(whitelist, domain)
	return s.storage.Put(ctx, uid, settingsWhitelistName, whitelistRecord{Whitelist: whitelist})
}

func (s *Settings) BlocklistAdd(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, &err, "BlocklistAdd(%s)", domain)()
	if isAutoAllowedDomain(domain) {
		return autoAllowedError(domain)
	}
	whitelist, err := s.getWhitelist(ctx, uid)
	if err != nil {
		return err
	}
	if whitelist[domain] {
		delete(whitelist, domain)
		if err := s.storage.Put(ctx, uid, settingsWhitelistName, whitelistRecord{Whitelist: whitelist}); err != nil {
			return err
		}
	}
	blocklist, err := s.getBlocklist(ctx, uid)
	if err != nil {
		return err
	}
	if blocklist[domain] {
		return nil
	}
	blocklist[domain] = true
	return s.storage.Put(ctx, uid, settingsBlocklistName, blocklistRecord{Blocklist: blocklist})
}

func (s *Settings) BlocklistRemove(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, &err, "BlocklistRemove(%s)", domain)()
	blocklist, err := s.getBlocklist(ctx, uid)
	if err != nil {
		return err
	}
	if !blocklist[domain] {
		s.Debug(ctx, "BlocklistRemove: not found, doing nothing")
		return nil
	}
	delete(blocklist, domain)
	return s.storage.Put(ctx, uid, settingsBlocklistName, blocklistRecord{Blocklist: blocklist})
}

func (s *Settings) SetMode(ctx context.Context, uid gregor1.UID, mode chat1.UnfurlMode) (err error) {
	defer s.Trace(ctx, &err, "SetMode(%v)", mode)()
	return s.storage.Put(ctx, uid, settingsModeName, modeRecord{
		Mode: mode,
	})
}

func normalizeDomainSet(in map[string]bool) (map[string]bool, error) {
	res := make(map[string]bool, len(in))
	for input, on := range in {
		if !on {
			continue
		}
		domain, err := NormalizeDomain(input)
		if err != nil {
			return nil, err
		}
		res[domain] = true
	}
	return res, nil
}

// cleanDomainSet drops stored entries that Set would reject, such as ones written
// before the lists were validated, so a settings round trip can always be saved.
func cleanDomainSet(in map[string]bool) map[string]bool {
	res := make(map[string]bool, len(in))
	for input, on := range in {
		if !on {
			continue
		}
		if domain, err := NormalizeDomain(input); err == nil {
			res[domain] = true
		}
	}
	return res
}

// Set validates both lists before writing anything, so a rejected update
// leaves the stored settings untouched.
func (s *Settings) Set(ctx context.Context, uid gregor1.UID, settings chat1.UnfurlSettings) (err error) {
	defer s.Trace(ctx, &err, "Set")()
	whitelist, err := normalizeDomainSet(settings.Whitelist)
	if err != nil {
		return err
	}
	blocklist, err := normalizeDomainSet(settings.Blocklist)
	if err != nil {
		return err
	}
	for domain := range whitelist {
		if blocklist[domain] {
			return fmt.Errorf("%s cannot be on both the allow list and the block list", domain)
		}
	}
	if err = s.storage.Put(ctx, uid, settingsModeName, modeRecord{
		Mode: settings.Mode,
	}); err != nil {
		return err
	}
	if err = s.storage.Put(ctx, uid, settingsWhitelistName, whitelistRecord{
		Whitelist: whitelist,
	}); err != nil {
		return err
	}
	return s.storage.Put(ctx, uid, settingsBlocklistName, blocklistRecord{
		Blocklist: blocklist,
	})
}
