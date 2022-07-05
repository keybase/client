package kbtime

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

const testTTzFmt = `2006-01-02 15:04:05 -0700`

type longDurTestCase struct {
	expected string
	duration string
}

func TestAddLongDurationLong(t *testing.T) {
	then, err := time.Parse(testTTzFmt, "2020-04-01 12:23:08 +0000")
	require.NoError(t, err)

	cases := []longDurTestCase{
		{"2021-04-01 12:23:08 +0000", "1 Y"},
		{"2021-04-01 12:23:08 +0000", "1Y"},
		{"2022-04-01 12:23:08 +0000", "2 Y"},
		{"2023-04-01 12:23:08 +0000", "3Y"},
		{"2030-04-01 12:23:08 +0000", "10 Y"},
		{"3020-04-01 12:23:08 +0000", "1000 Y"},

		{"2020-04-08 12:23:08 +0000", "7D"},
		{"2020-04-08 12:23:08 +0000", "7D"},
		{"2020-04-15 12:23:08 +0000", "14 D"},

		{"2020-05-01 12:23:08 +0000", "1M"},
		{"2020-06-01 12:23:08 +0000", "2 M"},
		{"2020-07-01 12:23:08 +0000", "3M"},
		{"2020-10-01 12:23:08 +0000", "6M"},
		{"2021-02-01 12:23:08 +0000", "10M"},
	}

	for _, c := range cases {
		ret, err := AddLongDuration(then, c.duration)
		require.NoError(t, err, "failed for %q", c.duration)
		require.Equal(t, c.expected, ret.Format(testTTzFmt), "failed for %q", c.duration)
	}
}

func TestAddLongDurationForTimeTravelers(t *testing.T) {
	then, err := time.Parse(testTTzFmt, "3062-04-01 12:23:08 +0200")
	require.NoError(t, err)

	cases := []longDurTestCase{
		{"3072-04-01 12:23:08 +0200", "10 Y"},
		{"4062-04-01 12:23:08 +0200", "1000 Y"},
		{"3062-04-15 12:23:08 +0200", "14 D"},
		{"3062-05-01 12:23:08 +0200", "1M"},
		{"3062-10-01 12:23:08 +0200", "6M"},
	}

	for _, c := range cases {
		ret, err := AddLongDuration(then, c.duration)
		require.NoError(t, err, "failed for %q", c.duration)
		require.Equal(t, c.expected, ret.Format(testTTzFmt), "failed for %q", c.duration)
	}
}

func TestAddLongDurationFallback(t *testing.T) {
	// For short durations (<= hour) the function should fall back to
	// time.ParseDuration. Make sure that's the case.
	now := time.Now()

	for _, amount := range []int{1, 3, 6, 10, 2883, 2312, 93762} {
		for _, unit := range []string{"ns", "us", "µs", "μs", "ms", "s", "m", "h"} {
			timeDuration, err := time.ParseDuration(fmt.Sprintf("%d%s", amount, unit))
			require.NoError(t, err)

			expected := now.Add(timeDuration)

			for _, format := range []string{"%d %s", "%d%s", "   %d %s", "%d %s   ", "   %d %s   "} {
				durStr := fmt.Sprintf(format, amount, unit)
				ret, err := AddLongDuration(now, durStr)
				require.NoError(t, err, "failed on %q", durStr)
				require.Equal(t, expected, ret, "ret value not equal on %q", durStr)
			}
		}
	}
}

func TestAddLongDurationBad(t *testing.T) {
	now := time.Now()
	for _, duration := range []string{
		// Invalid units
		"1 xs", "10 years", "1 year", "2 days",
		// No units
		"1", "2123", "520",
		// More than one whitespace between int and unit.
		"1   s", "1   y", "1  M",
		// Unit alone
		"s", "m", "y", "Y", "M",
		// Negative ints
		"-10s", "-15 d", "-1 y", "-1h", "-1 Y",
		// Fractions
		"341.2h", "50.5s",
		// Ambiguous units
		"1d", "2 d", "10y",
	} {
		ret, err := AddLongDuration(now, "1 xs")
		require.Error(t, err, "expected an error for %q", duration)
		require.Zero(t, ret)
	}
}

func TestAddLongDurationTimezone(t *testing.T) {
	loc, err := time.LoadLocation("Europe/Warsaw")
	require.NoError(t, err)
	then, err := time.ParseInLocation(testTTzFmt, "2020-04-01 12:23:08 +0200", loc)
	require.NoError(t, err)

	ret, err := AddLongDuration(then, "1000 Y")
	require.NoError(t, err)
	require.Equal(t,
		"3020-04-01 12:23:08 +0100", // timezone changes to +0100 from +0200 (???)
		ret.Format(testTTzFmt))
}
