package teams

import (
	"fmt"
)

func NewErrStubbed(l *chainLinkUnpacked) ErrStubbed {
	return ErrStubbed{l}
}

type ErrStubbed struct {
	l *chainLinkUnpacked
}

func (e ErrStubbed) Error() string {
	return fmt.Sprintf("stubbed link when not expected (seqno %d)", int(e.l.outerLink.Seqno))
}
