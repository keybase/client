package unfurl

import (
	"context"
	"fmt"
	"sync"

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

	// held across each read-modify-write of the stored lists, so concurrent
	// changes (such as quick prompt answers) don't drop each other's updates
	mu      sync.Mutex
	storage types.UserConversationBackedStorage
}

func NewSettings(g *globals.Context, storage types.UserConversationBackedStorage) *Settings {
	return &Settings{
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "Settings", false),
		storage:      storage,
	}
}

func (s *Settings) getList(ctx context.Context, uid gregor1.UID, name string) (map[string]bool, error) {
	var wr whitelistRecord
	var br blocklistRecord
	dest, list := any(&wr), &wr.Whitelist
	if name == settingsBlocklistName {
		dest, list = &br, &br.Blocklist
	}
	if _, err := s.storage.Get(ctx, uid, name, dest); err != nil {
		return nil, err
	}
	return cleanDomainSet(*list), nil
}

func (s *Settings) putList(ctx context.Context, uid gregor1.UID, name string, list map[string]bool) error {
	if name == settingsBlocklistName {
		return s.storage.Put(ctx, uid, name, blocklistRecord{Blocklist: list})
	}
	return s.storage.Put(ctx, uid, name, whitelistRecord{Whitelist: list})
}

func (s *Settings) Get(ctx context.Context, uid gregor1.UID) (res chat1.UnfurlSettings, err error) {
	defer s.Trace(ctx, &err, "Get")()
	s.mu.Lock()
	defer s.mu.Unlock()

	var mr modeRecord
	found, err := s.storage.Get(ctx, uid, settingsModeName, &mr)
	if err != nil {
		return res, err
	}
	if !found {
		s.Debug(ctx, "Get: no mode setting found, using whitelisted")
		mr.Mode = chat1.UnfurlMode_WHITELISTED
	}
	whitelist, err := s.getList(ctx, uid, settingsWhitelistName)
	if err != nil {
		return res, err
	}
	blocklist, err := s.getList(ctx, uid, settingsBlocklistName)
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

// addToList takes a domain already derived by GetDomain or NormalizeDomain,
// and moves it off the opposite list.
func (s *Settings) addToList(ctx context.Context, uid gregor1.UID, domain string, block bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if isAutoAllowedDomain(domain) {
		return autoAllowedError(domain)
	}
	name, other := settingsWhitelistName, settingsBlocklistName
	if block {
		name, other = other, name
	}
	otherList, err := s.getList(ctx, uid, other)
	if err != nil {
		return err
	}
	if otherList[domain] {
		delete(otherList, domain)
		if err := s.putList(ctx, uid, other, otherList); err != nil {
			return err
		}
	}
	list, err := s.getList(ctx, uid, name)
	if err != nil {
		return err
	}
	if list[domain] {
		return nil
	}
	list[domain] = true
	return s.putList(ctx, uid, name, list)
}

func (s *Settings) WhitelistAdd(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, &err, "WhitelistAdd(%s)", domain)()
	return s.addToList(ctx, uid, domain, false)
}

func (s *Settings) BlocklistAdd(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, &err, "BlocklistAdd(%s)", domain)()
	return s.addToList(ctx, uid, domain, true)
}

func (s *Settings) WhitelistRemove(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer s.Trace(ctx, &err, "WhitelistRemove(%s)", domain)()
	s.mu.Lock()
	defer s.mu.Unlock()
	whitelist, err := s.getList(ctx, uid, settingsWhitelistName)
	if err != nil {
		return err
	}
	if !whitelist[domain] {
		s.Debug(ctx, "WhitelistRemove: not found, doing nothing")
		return nil
	}
	delete(whitelist, domain)
	return s.putList(ctx, uid, settingsWhitelistName, whitelist)
}

func (s *Settings) SetMode(ctx context.Context, uid gregor1.UID, mode chat1.UnfurlMode) (err error) {
	defer s.Trace(ctx, &err, "SetMode(%v)", mode)()
	s.mu.Lock()
	defer s.mu.Unlock()
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
// leaves the stored settings untouched. A nil Blocklist keeps the stored block
// list, minus any domain the new allow list allows.
func (s *Settings) Set(ctx context.Context, uid gregor1.UID, settings chat1.UnfurlSettings) (err error) {
	defer s.Trace(ctx, &err, "Set")()
	s.mu.Lock()
	defer s.mu.Unlock()
	whitelist, err := normalizeDomainSet(settings.Whitelist)
	if err != nil {
		return err
	}
	var blocklist map[string]bool
	if settings.Blocklist == nil {
		if blocklist, err = s.getList(ctx, uid, settingsBlocklistName); err != nil {
			return err
		}
		for domain := range whitelist {
			delete(blocklist, domain)
		}
	} else if blocklist, err = normalizeDomainSet(settings.Blocklist); err != nil {
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
	if err = s.putList(ctx, uid, settingsWhitelistName, whitelist); err != nil {
		return err
	}
	return s.putList(ctx, uid, settingsBlocklistName, blocklist)
}
