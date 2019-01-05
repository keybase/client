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

func (l *LogProfileContext) maxDuration(durations []time.Duration) time.Duration {
	max := time.Duration(0)
	for _, d := range durations {
		if d > max {
			max = d
		}
	}
	return max
}

func (l *LogProfileContext) minDuration(durations []time.Duration) time.Duration {
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

func (l *LogProfileContext) avgDuration(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	var total int64
	for _, d := range durations {
		total += d.Nanoseconds()
	}
	return time.Duration(total / int64(len(durations)))
}

func (l *LogProfileContext) format(fn string, durations []time.Duration) string {
	return fmt.Sprintf(`
		%v:
			max: %v
			avg: %v
			min: %v
			len: %v`,
		fn, l.maxDuration(durations), l.avgDuration(durations), l.minDuration(durations), len(durations))
}

func (l *LogProfileContext) parseMatch(matches []string) (filename, fnName string, d time.Duration) {
	if len(matches) != 4 {
		return "", "", 0
	}
	filename = matches[1]
	fnName = matches[2]
	// Some log calls have fnName: args so we want to strip that.
	fnName = strings.Split(fnName, ":")[0]
	// Some log calls have fnName(args) so we want to strip that.
	fnName = strings.Split(fnName, "(")[0]
	d, err := time.ParseDuration(matches[3])
	if err != nil {
		l.G().Log.CDebugf(context.TODO(), "Unable to parse duration: %s", err)
		return "", "", 0
	}
	return filename, fnName, d
}

func (l *LogProfileContext) LogProfile(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	re := regexp.MustCompile(`keybase (\w*\.go)\:\d+.*- (.*) -> .* \[time=(\d+\.\w+)\]`)
	// filename -> functionName -> [durations...]
	profiles := map[string]map[string][]time.Duration{}
	scanner := bufio.NewScanner(f)
	scanner.Split(bufio.ScanLines)
	for scanner.Scan() {
		// We expect two groups, the function name and a duration
		matches := re.FindAllStringSubmatch(scanner.Text(), -1)
		if len(matches) == 0 {
			continue
		}
		filename, fnName, d := l.parseMatch(matches[0])
		if fnName == "" {
			continue
		}

		data, ok := profiles[filename]
		if !ok {
			data = make(map[string][]time.Duration)
		}
		durations, ok := data[fnName]
		if ok {
			durations = append(durations, d)
		} else {
			durations = []time.Duration{d}
		}
		data[fnName] = durations
		profiles[filename] = data
	}
	res := []string{}
	for filename, data := range profiles {
		res = append(res, filename)
		for fnName, durations := range data {
			res = append(res, l.format(fnName, durations))
		}
	}
	return res, nil
}
