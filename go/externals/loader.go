package externals

import "github.com/keybase/client/go/protocol/keybase1"

type ConfigLoader interface {
	LoadAll() ([]keybase1.ParamProofServiceConfig, error)
}

type NullConfigLoader struct{}

var _ ConfigLoader = (*NullConfigLoader)(nil)

// TODO these values will live on the server and be cached locally, we'll have
// a dev setup with a similar config to below so we can run integration tests.
func (l *NullConfigLoader) LoadAll() ([]keybase1.ParamProofServiceConfig, error) {
	return []keybase1.ParamProofServiceConfig{
		keybase1.ParamProofServiceConfig{
			Enabled:    true,
			IsDevel:    true,
			Domain:     "mastodon.social",
			Group:      nil,
			UsernameRe: ".*",
			PrefillUrl: "https://coveredin.bees/profile-proof?username={{username}}&sig_hash={{sig_hash}}",
			CheckUrl:   "https://coveredin.bees/{{username}}/proofs.json",
			CheckPath:  []string{"body", "profile", "keybase_proofs"},
		},
	}, nil
}
