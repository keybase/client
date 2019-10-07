package libkb

import (
	"fmt"
	"time"

	humanize "github.com/dustin/go-humanize"
)

func HumanizeResetTime(t time.Time) string {
	stamp := t.Local().Format("on Monday, 2 January 2006 at 15:04 MST")
	until := humanize.RelTime(t, time.Now(), "ago ", "")
	return fmt.Sprintf("in %s(%s)", until, stamp)
}
