// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/prove.avdl

package keybase1

type CheckProofStatus struct {
	Found     bool        `codec:"found" json:"found"`
	Status    ProofStatus `codec:"status" json:"status"`
	ProofText string      `codec:"proofText" json:"proofText"`
	State     ProofState  `codec:"state" json:"state"`
}

func (o CheckProofStatus) DeepCopy() CheckProofStatus {
	return CheckProofStatus{
		Found:     o.Found,
		Status:    o.Status.DeepCopy(),
		ProofText: o.ProofText,
		State:     o.State.DeepCopy(),
	}
}

type StartProofResult struct {
	SigID SigID `codec:"sigID" json:"sigID"`
}

func (o StartProofResult) DeepCopy() StartProofResult {
	return StartProofResult{
		SigID: o.SigID.DeepCopy(),
	}
}
