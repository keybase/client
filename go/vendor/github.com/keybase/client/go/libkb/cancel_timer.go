package libkb

import (
	"time"
)

type CancelTimer struct {
	canceledAt time.Time
}

func (c *CancelTimer) SetNow(m MetaContext) {
	c.canceledAt = m.G().Clock().Now()
}

func (c *CancelTimer) WasRecentlyCanceled(m MetaContext) bool {
	if c.canceledAt.IsZero() {
		return false
	}
	now := m.G().Clock().Now()
	if now.Sub(c.canceledAt) < SecretPromptCancelDuration {
		return true
	}
	c.canceledAt = time.Time{}
	return false
}

func (c *CancelTimer) Reset() {
	c.canceledAt = time.Time{}
}
