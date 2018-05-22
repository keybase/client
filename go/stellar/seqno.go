package stellar

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/stellar/go/xdr"
)

// SeqnoProvider implements build.SequenceProvider.  It is intended as a one-shot
// wrapper and shouldn't be reused after the transaction is built.
type SeqnoProvider struct {
	ctx     context.Context
	remoter remote.Remoter
}

// NewSeqnoProvider creates a SeqnoProvider.
func NewSeqnoProvider(m libkb.MetaContext) *SeqnoProvider {
	return &SeqnoProvider{
		ctx:     m.Ctx(),
		remoter: GetRemoter(m.G()),
	}
}

// SequenceForAccount implements build.SequenceProvider.
func (s *SeqnoProvider) SequenceForAccount(aid string) (xdr.SequenceNumber, error) {
	seqno, err := s.remoter.AccountSeqno(s.ctx, stellar1.AccountID(aid))
	if err != nil {
		return 0, err
	}

	return xdr.SequenceNumber(seqno), nil
}
