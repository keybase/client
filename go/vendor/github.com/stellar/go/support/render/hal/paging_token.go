package hal

// Pageable impementors can be added to hal.Page collections
type Pageable interface {
	PagingToken() string
}
