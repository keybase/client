package xdr

// SendAmount returns the amount spent, denominated in the source asset, in the
// course of this path payment
func (pr *PathPaymentResult) SendAmount() Int64 {
	s, ok := pr.GetSuccess()
	if !ok {
		return 0
	}

	if len(s.Offers) == 0 {
		return s.Last.Amount
	}

	sa := s.Offers[0].AssetBought
	var ret Int64

	for _, o := range s.Offers {
		if o.AssetBought.String() != sa.String() {
			break
		}
		ret += o.AmountBought
	}

	return ret
}
