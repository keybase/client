package xdr

func (a *AccountEntry) SignerSummary() map[string]int32 {
	ret := map[string]int32{}

	if a.Thresholds[0] > 0 {
		ret[a.AccountId.Address()] = int32(a.Thresholds[0])
	}
	for _, signer := range a.Signers {
		ret[signer.Key.Address()] = int32(signer.Weight)
	}

	return ret
}
