package libkb

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/context"
)

// LogProfileContext for LogProfile
type LogProfileContext struct {
	Contextified
	Path string
}

func maxDuration(durations []time.Duration) time.Duration {
	max := time.Duration(0)
	for _, d := range durations {
		if d > max {
			max = d
		}
	}
	return max
}

func minDuration(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	min := durations[0]
	for _, d := range durations {
		if d < min {
			min = d
		}
	}
	return min
}

func avgDuration(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	var total int64
	for _, d := range durations {
		total += d.Nanoseconds()
	}
	return time.Duration(total / int64(len(durations)))
}

func format(fn string, durations []time.Duration) string {
	return fmt.Sprintf(`%v:
		max: %v
		avg: %v
		min: %v
		len: %v`,
		fn, maxDuration(durations), avgDuration(durations), minDuration(durations), len(durations))
}

func (l *LogProfileContext) LogProfile(path string) ([]string, error) {
	f, err := os.Open(path)
	defer f.Close()
	if err != nil {
		return nil, err
	}

	re := regexp.MustCompile("- (.*) -> .* \\[time=(\\d+\\.\\w+)\\]")
	data := map[string][]time.Duration{}
	scanner := bufio.NewScanner(f)
	scanner.Split(bufio.ScanLines)
	for scanner.Scan() {
		// We expect two groups, the function name and a duration
		matches := re.FindAllStringSubmatch(scanner.Text(), -1)
		if len(matches) == 0 {
			continue
		}
		fn := matches[0][1]
		// Some log calls have fnName: args so we want to strip that.
		fn = strings.Split(fn, ":")[0]
		// Some log calls have fnName(args) so we want to strip that.
		fn = strings.Split(fn, "(")[0]
		d, err := time.ParseDuration(matches[0][2])
		if err != nil {
			l.G().Log.CDebugf(context.TODO(), "Unable to parse duration: %s", err)
			continue
		}

		durations, ok := data[fn]
		if ok {
			durations = append(durations, d)
		} else {
			durations = []time.Duration{d}
		}
		data[fn] = durations
	}
	res := []string{}
	for fn, durations := range data {
		res = append(res, format(fn, durations))
	}
	return res, nil
}
