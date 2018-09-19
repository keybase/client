// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/pvl"
)

func CheckProofPvl(m libkb.MetaContext, proofType keybase1.ProofType, proof libkb.RemoteProofChainLink, hint libkb.SigHint, pvlU keybase1.MerkleStoreEntry) libkb.ProofError {
	return pvl.CheckProof(m, string(pvlU.Entry), proofType, pvl.NewProofInfo(proof, hint))
}
