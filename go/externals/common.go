// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/pvl"
)

func CheckProofPvl(ctx libkb.ProofContext, proofType keybase1.ProofType, proof libkb.RemoteProofChainLink, hint libkb.SigHint) libkb.ProofError {
	netCtx := context.TODO()
	pvlSource := ctx.GetPvlSource()
	if pvlSource == nil {
		return libkb.NewProofError(keybase1.ProofStatus_MISSING_PVL, "no pvl source for proof verification")
	}
	pvlString, err := pvlSource.GetPVL(netCtx, pvl.SupportedVersion)
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_MISSING_PVL, "error getting pvl: %s", err)
	}
	return pvl.CheckProof(ctx, pvlString, proofType, pvl.NewProofInfo(proof, hint))
}
