package kbtime

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func mustAddLongDuration(t *testing.T, tval time.Time, s string) time.Time {
	ret, err := AddLongDuration(tval, s)
	require.NoError(t, err)
	return ret
}

func TestRelTime(t *testing.T) {
	now := time.Date(2020, time.January, 10, 14, 0, 0, 0, time.UTC)

	var tests = []struct {
		a   time.Time
		b   time.Time
		out string
	}{
		{now, mustAddLongDuration(t, now, "1s"), "1 second"},
		{now, mustAddLongDuration(t, now, "29s"), "29 seconds"},
		{now, mustAddLongDuration(t, now, "1m"), "1 minute"},
		{now, mustAddLongDuration(t, now, "14m"), "14 minutes"},
		{now, mustAddLongDuration(t, now, "59m"), "59 minutes"},
		{now, mustAddLongDuration(t, now, "61m"), "1 hour"},
		{now, mustAddLongDuration(t, now, "110m"), "1 hour"},
		{now, mustAddLongDuration(t, now, "1h"), "1 hour"},
		{now, mustAddLongDuration(t, now, "19h"), "19 hours"},
		{now, mustAddLongDuration(t, now, "46h"), "1 day"},
		{now, mustAddLongDuration(t, now, "1D"), "1 day"},
		{now, mustAddLongDuration(t, now, "6D"), "6 days"},
		{now, mustAddLongDuration(t, now, "13D"), "1 week"},
		{now, mustAddLongDuration(t, now, "25D"), "3 weeks"},
		{now, mustAddLongDuration(t, now, "1M"), "1 month"},
		{now, mustAddLongDuration(t, now, "11M"), "11 months"},
		{now, mustAddLongDuration(t, now, "13M"), "1 year"},
		{now, mustAddLongDuration(t, now, "19M"), "1 year"},
		{now, mustAddLongDuration(t, now, "23M"), "1 year"},
		{now, mustAddLongDuration(t, now, "63M"), "5 years"},
		{now, mustAddLongDuration(t, now, "1Y"), "1 year"},
		{now, mustAddLongDuration(t, now, "2Y"), "2 years"},
		{now, mustAddLongDuration(t, now, "3Y"), "3 years"},
		{now, mustAddLongDuration(t, now, "10Y"), "10 years"},
		{now, mustAddLongDuration(t, now, "100Y"), "100 years"},
		{now, mustAddLongDuration(t, now, "1000Y"), "1000 years"},
		{now, mustAddLongDuration(t, now, "10000Y"), "10000 years"},
		{now, mustAddLongDuration(t, now, "100000Y"), "100000 years"},
		{now, mustAddLongDuration(t, now, "1000000Y"), "1000000 years"},
		{now, mustAddLongDuration(t, now, "1000000000Y"), "1000000000 years"},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.out, func(t *testing.T) {
			actual := RelTime(tt.a, tt.b, "", "")
			require.Equal(t, tt.out, actual)
		})
	}
}
