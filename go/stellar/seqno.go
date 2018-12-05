package stellar

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/xdr"
)

// SeqnoProvider implements build.SequenceProvider.  It can be
// used for several transactions in a row.
type SeqnoProvider struct {
	mctx        libkb.MetaContext
	walletState *WalletState
}

// NewSeqnoProvider creates a SeqnoProvider.
func NewSeqnoProvider(mctx libkb.MetaContext, walletState *WalletState) *SeqnoProvider {
	return &SeqnoProvider{
		mctx:        mctx,
		walletState: walletState,
	}
}

// SequenceForAccount implements build.SequenceProvider.
func (s *SeqnoProvider) SequenceForAccount(aid string) (xdr.SequenceNumber, error) {
	seqno, err := s.walletState.AccountSeqnoAndBump(s.mctx.Ctx(), stellar1.AccountID(aid))
	if err != nil {
		return 0, err
	}

	s.mctx.CDebugf("SeqnoProvider.SequenceForAccount(%s) -> %d", aid, seqno)

	return xdr.SequenceNumber(seqno), nil
}
