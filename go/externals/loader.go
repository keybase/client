package externals

import "github.com/keybase/client/go/protocol/keybase1"

type ConfigLoader interface {
	LoadAll() ([]keybase1.GenericServiceConfig, error)
}

type NullConfigLoader struct{}

var _ ConfigLoader = (*NullConfigLoader)(nil)

func (l *NullConfigLoader) LoadAll() ([]keybase1.GenericServiceConfig, error) {
	return []keybase1.GenericServiceConfig{
		keybase1.GenericServiceConfig{
			Enabled:    true,
			IsDevel:    true,
			Domain:     "mastodon.social",
			Group:      nil,
			UsernameRe: ".*",
			PrefillUrl: "https://coveredin.bees/profile-proof?username=%{username}&sig_hash=%{sig_hash}",
			CheckUrl:   "https://coveredin.bees/%{username}/proofs.json",
			CheckPath:  []string{"body", "profile", "keybase_proofs"},
		},
	}, nil
}
