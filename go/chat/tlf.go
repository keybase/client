package chat

import (
	"context"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type TLFInfo struct {
	ID               chat1.TLFID
	CanonicalName    string
	IdentifyFailures []keybase1.TLFIdentifyFailure
}

func LookupTLF(ctx context.Context, tlfcli keybase1.TlfInterface, tlfName string,
	visibility chat1.TLFVisibility) (*TLFInfo, error) {

	res, err := CtxKeyFinder(ctx).Find(ctx, tlfcli, tlfName, visibility == chat1.TLFVisibility_PUBLIC)
	if err != nil {
		return nil, err
	}
	info := &TLFInfo{
		ID:               chat1.TLFID(res.NameIDBreaks.TlfID.ToBytes()),
		CanonicalName:    res.NameIDBreaks.CanonicalName.String(),
		IdentifyFailures: res.NameIDBreaks.Breaks.Breaks,
	}
	return info, nil
}
