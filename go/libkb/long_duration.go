package libkb

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

func AddLongDuration(now time.Time, duration string) (ret time.Time, err error) {
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
		return now.Add(dur), nil
	case "d":
		return ret, fmt.Errorf("use 'D' unit for days instead of '%s'", unit)
	case "D": // day
		return now.AddDate(0, 0, int(amount)), nil
	// 'm' is minute, handled by time.ParseDuration.
	case "M": // month
		return now.AddDate(0, int(amount), 0), nil
	case "y":
		return ret, fmt.Errorf("use 'Y' unit for years instead of '%s'", unit)
	case "Y": // year
		return now.AddDate(int(amount), 0, 0), nil
	default:
		return ret, fmt.Errorf("unhandled unit %q", unit)
	}
}
