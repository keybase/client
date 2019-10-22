package kvstore

type KVCacheError struct {
	Message string
}

func (e KVCacheError) Error() string {
	return e.Message
}

type RevisionErrorSource int

const (
	RevisionErrorSourceSERVER RevisionErrorSource = 0
	RevisionErrorSourceCACHE  RevisionErrorSource = 1
)

type KVRevisionError struct {
	Source  RevisionErrorSource
	Message string
}

func (e KVRevisionError) Error() string {
	return e.Message
}
