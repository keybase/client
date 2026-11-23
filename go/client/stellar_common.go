package client

import (
	"github.com/keybase/client/go/libkb"
)

func transformStellarCLIError(err *error) {
	if err == nil {
		return
	}
	if *err == nil {
		return
	}
	switch e := (*err).(type) {
	case libkb.AppStatusError:
		if e.Code == libkb.SCStellarNeedDisclaimer {
			*err = libkb.NewAppStatusError(&libkb.AppStatus{
				Code: e.Code,
				Name: e.Name,
				Desc: "Stellar disclaimer not yet accepted",
			})
		}
	default:
		// Nothing to do for other errors.
	}
}
