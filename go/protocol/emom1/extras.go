package emom1

import (
	"time"
)

func ToTime(t time.Time) Time {
	// the result of calling UnixNano on the zero Time is undefined.
	// https://golang.org/pkg/time/#Time.UnixNano
	if t.IsZero() {
		return 0
	}
	return Time(t.UnixNano() / 1000000)
}

func (a AuthToken) Export() AuthTokenExported {
	return AuthTokenExported{
		C: a.C,
		D: a.D,
		U: a.U,
	}
}
