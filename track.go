package libkb

// Can either be a RemoteProofChainLink or one of the identities
// listed in a tracking statement
type TrackIdComponent interface {
	GetIdString() string
}
