// Copied from github.com/rcrowley/go-metrics so that we can populate
// unexported fields.
//
// Copyright 2012 Richard Crowley. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
// 1.  Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//
// 2.  Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following
// disclaimer in the documentation and/or other materials provided
// with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY RICHARD CROWLEY ``AS IS'' AND ANY EXPRESS
// OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL RICHARD CROWLEY OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
// THE POSSIBILITY OF SUCH DAMAGE.
//
// The views and conclusions contained in the software and documentation
// are those of the authors and should not be interpreted as representing
// official policies, either expressed or implied, of Richard Crowley.

package libkbfs

import metrics "github.com/rcrowley/go-metrics"

// MeterSnapshot is a read-only copy of another Meter.
type MeterSnapshot struct {
	count                          int64
	rate1, rate5, rate15, rateMean float64
}

var _ metrics.Meter = (*MeterSnapshot)(nil)

// Count returns the count of events at the time the snapshot was taken.
func (m *MeterSnapshot) Count() int64 { return m.count }

// Mark panics.
func (*MeterSnapshot) Mark(n int64) {
	panic("Mark called on a MeterSnapshot")
}

// Rate1 returns the one-minute moving average rate of events per second at the
// time the snapshot was taken.
func (m *MeterSnapshot) Rate1() float64 { return m.rate1 }

// Rate5 returns the five-minute moving average rate of events per second at
// the time the snapshot was taken.
func (m *MeterSnapshot) Rate5() float64 { return m.rate5 }

// Rate15 returns the fifteen-minute moving average rate of events per second
// at the time the snapshot was taken.
func (m *MeterSnapshot) Rate15() float64 { return m.rate15 }

// RateMean returns the meter's mean rate of events per second at the time the
// snapshot was taken.
func (m *MeterSnapshot) RateMean() float64 { return m.rateMean }

// Snapshot returns the snapshot.
func (m *MeterSnapshot) Snapshot() metrics.Meter { return m }
