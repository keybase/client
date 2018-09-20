package pvl

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/merklestore"
	"github.com/keybase/client/go/protocol/keybase1"
)

// NewPvlSource creates a new source and installs it into G.
func NewPvlSourceAndInstall(g *libkb.GlobalContext) libkb.MerkleStore {
	supportedVersion := keybase1.MerkleStoreSupportedVersion(SupportedVersion)
	tag := "pvl"
	endpoint := "merkle/pvl"
	getHash := func(root libkb.MerkleRoot) string {
		return root.PvlHash()
	}
	kitFilename := g.Env.GetPvlKitFilename()
	s := merklestore.NewMerkleStore(g, tag, endpoint, kitFilename, supportedVersion, getHash)
	g.SetPvlSource(s)
	return s
}
