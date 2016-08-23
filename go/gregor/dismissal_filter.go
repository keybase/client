package gregor

import "time"

func FilterFutureDismissals(msgs []InBandMessage,
	allmsgs map[string]InBandMessage, cutoff time.Time) []InBandMessage {

	var res []InBandMessage
	for _, m := range msgs {
		update := m.ToStateUpdateMessage()
		if update == nil {
			res = append(res, m)
			continue
		}
		dismissal := update.Dismissal()
		if dismissal == nil {
			res = append(res, m)
			continue
		}

		// Always include these time-based dismissals
		if len(dismissal.RangesToDismiss()) > 0 {
			res = append(res, m)
			continue
		}

		// For each dismissal, check each message it dismisses to verify
		// that the message was created before the time we are selecting on
		include := false
		for _, dMsgID := range dismissal.MsgIDsToDismiss() {
			if dMsg, present := allmsgs[dMsgID.String()]; present {
				ctime := dMsg.Metadata().CTime()
				if ctime.Before(cutoff) || ctime.Equal(cutoff) {
					include = true
					break
				}
			} else {
				// If we don't have the message, assume that it is created before
				// ctime and keep the dismissal
				include = true
				break
			}
		}
		if include {
			res = append(res, m)
		}
	}

	return res
}
