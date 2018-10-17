package search

const defaultPageSize = 300
const MaxAllowedSearchHits = 10000
const MaxAllowedSearchMessages = 100000
const MaxContext = 15

// Bumped whenever there are tokenization or structural changes to building the
// index
const IndexVersion = 2
