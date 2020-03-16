// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/stellar1/ui.avdl

package stellar1

type UIPaymentReviewed struct {
	Bid        BuildPaymentID    `codec:"bid" json:"bid"`
	ReviewID   int               `codec:"reviewID" json:"reviewID"`
	Seqno      int               `codec:"seqno" json:"seqno"`
	Banners    []SendBannerLocal `codec:"banners" json:"banners"`
	NextButton string            `codec:"nextButton" json:"nextButton"`
}

func (o UIPaymentReviewed) DeepCopy() UIPaymentReviewed {
	return UIPaymentReviewed{
		Bid:      o.Bid.DeepCopy(),
		ReviewID: o.ReviewID,
		Seqno:    o.Seqno,
		Banners: (func(x []SendBannerLocal) []SendBannerLocal {
			if x == nil {
				return nil
			}
			ret := make([]SendBannerLocal, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Banners),
		NextButton: o.NextButton,
	}
}
