// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/stellar1/ui.avdl

package stellar1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

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

type PaymentReviewedArg struct {
	SessionID int               `codec:"sessionID" json:"sessionID"`
	Msg       UIPaymentReviewed `codec:"msg" json:"msg"`
}

type UiInterface interface {
	PaymentReviewed(context.Context, PaymentReviewedArg) error
}

func UiProtocol(i UiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "stellar.1.ui",
		Methods: map[string]rpc.ServeHandlerDescription{
			"paymentReviewed": {
				MakeArg: func() interface{} {
					var ret [1]PaymentReviewedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PaymentReviewedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PaymentReviewedArg)(nil), args)
						return
					}
					err = i.PaymentReviewed(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type UiClient struct {
	Cli rpc.GenericClient
}

func (c UiClient) PaymentReviewed(ctx context.Context, __arg PaymentReviewedArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.ui.paymentReviewed", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
