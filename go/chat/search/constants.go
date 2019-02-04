package search

const defaultPageSize = 300
const MaxAllowedSearchHits = 10000

// Only used by RegexpSearcher
const MaxAllowedSearchMessages = 100000

// Paging context around a search hit
const MaxContext = 15

const (
	// max number of conversations to use regexp searcher to boost the search
	// results on misses
	maxBoostConvsDesktop = 500
	maxBoostConvsMobile  = 250
	// max number of messages the boost can use
	maxBoostMsgsDesktop = 1000
	maxBoostMsgsMobile  = 500
	// max convs to sync in the background
	maxSyncConvsDesktop = 10
	maxSyncConvsMobile  = 5
)

// Bumped whenever there are tokenization or structural changes to building the
// index
const IndexVersion = 3
