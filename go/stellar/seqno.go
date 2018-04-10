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
	g       *libkb.GlobalContext
	remoter remote.Remoter
}

// NewSeqnoProvider creates a SeqnoProvider.
func NewSeqnoProvider(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter) *SeqnoProvider {
	return &SeqnoProvider{
		ctx:     ctx,
		g:       g,
		remoter: remoter,
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
