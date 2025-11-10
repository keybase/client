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
	maxSyncConvsDesktop = 100
	maxSyncConvsMobile  = 10

	// tokenizer
	maxPrefixLength = 10
	MinTokenLength  = 3

	// delay before starting SelectiveSync
	startSyncDelayDesktop = 10 * time.Second
	startSyncDelayMobile  = 20 * time.Second

	// sync frequency - how often SelectiveSync runs
	syncIntervalDesktop = 5 * time.Minute
	syncIntervalMobile  = 15 * time.Minute
)
