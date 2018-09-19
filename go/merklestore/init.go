package merklestore

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/pvl"
)

// NewPvlSource creates a new source and installs it into G.
func NewPvlSourceAndInstall(g *libkb.GlobalContext) libkb.MerkleStore {
	supportedVersion := keybase1.MerkleStoreSupportedVersion(pvl.SupportedVersion)
	tag := "pvl"
	endpoint := "merkle/pvl"
	getRootHash := func(root libkb.MerkleRoot) string {
		return root.PvlHash()
	}
	kitFilename := g.Env.GetPvlKitFilename()
	s := NewMerkleStore(g, tag, endpoint, kitFilename, supportedVersion, getRootHash)
	g.SetPvlSource(s)
	return s
}
