package libkbfs

import "time"

type wallClock struct {
}

// Now implements the Clock interface for wallClock.
func (wc wallClock) Now() time.Time {
	return time.Now()
}
