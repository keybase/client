// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/pvl"
)

func CheckProofPvl(ctx libkb.ProofContext, proofType keybase1.ProofType, proof libkb.RemoteProofChainLink, hint libkb.SigHint, pvlU libkb.PvlUnparsed) libkb.ProofError {
	return pvl.CheckProof(ctx, string(pvlU.Pvl), proofType, pvl.NewProofInfo(proof, hint))
}
