package search

import "time"

const defaultPageSize = 300
const MaxAllowedSearchHits = 10000

// Only used by RegexpSearcher
const MaxAllowedSearchMessages = 100000

// Paging context around a search hit
const MaxContext = 15

const (
	// max convs to sync in the background
	maxSyncConvsDesktop = 50
	maxSyncConvsMobile  = 5

	// tokenizer
	maxPrefixLength = 10
	MinTokenLength  = 3

	// delay before starting SelectiveSync
	startSyncDelayDesktop = 10 * time.Second
	startSyncDelayMobile  = 30 * time.Second
)
