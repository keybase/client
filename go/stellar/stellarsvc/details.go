package stellarsvc

import (
	"context"

	"github.com/keybase/client/go/protocol/stellar1"
)

// accountDetails gets stellar1.AccountDetails for accountID.
//
// It has the side effect of updating the badge state with the
// stellar payment unread count for accountID.
func (s *Server) accountDetails(ctx context.Context, accountID stellar1.AccountID) (stellar1.AccountDetails, error) {
	details, err := s.remoter.Details(ctx, accountID)
	if err != nil {
		return details, err
	}

	s.G().GetStellar().UpdateUnreadCount(ctx, accountID, details.UnreadPayments)

	return details, nil
}
