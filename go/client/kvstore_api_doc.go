package client

const kvStoreAPIDoc = `"keybase kvstore api" provides a JSON API to fast, encrypted key-value storage. Values are encrypted with per-team-keys, but namespaces and entry keys are visible to keybase servers.

EXAMPLES:

Get an entry:
	{"method": "get", "params": {"options": {"team": "phoenix", "namespace": "pw-manager", "entryKey": "geocities"}}}

Put an entry (reads value from stdin):
	{"method": "put", "params": {"options": {"team": "phoenix", "namespace": "pw-manager", "entryKey": "geocities", "entryValue": "all my secrets"}}}

List all namespaces:
	{"method": "list", "params": {"options": {"team": "phoenix"}}}

List all entryKeys in a namespace:
	{"method": "list", "params": {"options": {"team": "phoenix", "namespace": "pw-manager"}}}
`
