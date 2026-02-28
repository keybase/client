package kbtime

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// see go/src/time/format.go `var unitMap = map[string]int64`
var durationRxp = regexp.MustCompile(`^([0-9]+)\s?(([nuµμm]?s)|[mhdDMyY])$`)

// There is an ambiguity with 'm' being minutes and 'M' being months. So just
// don't allow units like 'd' for days - expect uppercase units for all of the
// "longer durations".

// AddLongDuration parses time duration from `duration` argument and adds to
// time in `now`, returning the resulting time. The duration format is similar
// to `time` package duration format, with the following changes:
// - additional duration units are supported:
//   - 'D' for days,
//   - 'M' for months,
//   - 'Y' for years,
//   - fractional numbers are *not* supported,
//   - negative numbers are *not* supported,
//   - whitespace at the beginning and end of duration string is ignored,
//   - optionally there can be one whitespace character between the number
//     and unit.
//
// Long durations are handled using Time.AddDate function, which works by
// adding given number of years, months, and days to tval. It normalizes its
// result, for example, adding one month to October 31 yields December 1, the
// normalized form for November 31.
//
// Examples:
//
//	`AddLongDuration(time.Now(), "1000 Y")`
//	`AddLongDuration(time.Now(), "7 D")`
//	`AddLongDuration(then, "1 M")`
func AddLongDuration(tval time.Time, duration string) (ret time.Time, err error) {
	duration = strings.TrimSpace(duration)

	parsed := durationRxp.FindStringSubmatch(duration)
	if parsed == nil {
		return ret, fmt.Errorf("bad duration format %q", duration)
	}

	amount, err := strconv.ParseInt(parsed[1], 10, 32)
	if err != nil {
		return ret, fmt.Errorf("failed to parse number: %w", err)
	}

	unit := parsed[2]
	switch unit {
	case "ns", "us", "µs", "μs", "ms", "s", "m", "h":
		dur, err := time.ParseDuration(fmt.Sprintf("%d%s", amount, unit))
		if err != nil {
			return ret, err
		}
		return tval.Add(dur), nil
	case "d":
		return ret, fmt.Errorf("use 'D' unit for days instead of '%s'", unit)
	case "D": // day
		return tval.AddDate(0, 0, int(amount)), nil
	// 'm' is minute, handled by time.ParseDuration.
	case "M": // month
		return tval.AddDate(0, int(amount), 0), nil
	case "y":
		return ret, fmt.Errorf("use 'Y' unit for years instead of '%s'", unit)
	case "Y": // year
		return tval.AddDate(int(amount), 0, 0), nil
	default:
		return ret, fmt.Errorf("unhandled unit %q", unit)
	}
}
