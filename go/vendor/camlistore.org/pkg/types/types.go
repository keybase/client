/*
Copyright 2013 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package types provides various common types.
package types

import (
	"bytes"
	"encoding/json"
	"expvar"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

var (
	goVersion  = runtime.Version()
	dotNumbers = regexp.MustCompile(`\.\d+`)
	null_b     = []byte("null")
)

// NopCloser is an io.Closer that does nothing.
var NopCloser io.Closer = ioutil.NopCloser(nil)

// EmptyBody is a ReadCloser that returns EOF on Read and does nothing
// on Close.
var EmptyBody io.ReadCloser = ioutil.NopCloser(strings.NewReader(""))

// Time3339 is a time.Time which encodes to and from JSON
// as an RFC 3339 time in UTC.
type Time3339 time.Time

var (
	_ json.Marshaler   = Time3339{}
	_ json.Unmarshaler = (*Time3339)(nil)
)

func (t Time3339) String() string {
	return time.Time(t).UTC().Format(time.RFC3339Nano)
}

func (t Time3339) MarshalJSON() ([]byte, error) {
	if t.Time().IsZero() {
		return null_b, nil
	}
	return json.Marshal(t.String())
}

func (t *Time3339) UnmarshalJSON(b []byte) error {
	if bytes.Equal(b, null_b) {
		*t = Time3339{}
		return nil
	}
	if len(b) < 2 || b[0] != '"' || b[len(b)-1] != '"' {
		return fmt.Errorf("types: failed to unmarshal non-string value %q as an RFC 3339 time", b)
	}
	s := string(b[1 : len(b)-1])
	if s == "" {
		*t = Time3339{}
		return nil
	}
	tm, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		if strings.HasPrefix(s, "0000-00-00T00:00:00") {
			*t = Time3339{}
			return nil
		}
		return err
	}
	*t = Time3339(tm)
	return nil
}

// ParseTime3339OrZero parses a string in RFC3339 format. If it's invalid,
// the zero time value is returned instead.
func ParseTime3339OrZero(v string) Time3339 {
	t, err := time.Parse(time.RFC3339Nano, v)
	if err != nil {
		return Time3339{}
	}
	return Time3339(t)
}

func ParseTime3339OrNil(v string) *Time3339 {
	t, err := time.Parse(time.RFC3339Nano, v)
	if err != nil {
		return nil
	}
	tm := Time3339(t)
	return &tm
}

// Time returns the time as a time.Time with slightly less stutter
// than a manual conversion.
func (t Time3339) Time() time.Time {
	return time.Time(t)
}

// IsZero returns whether the time is Go zero or Unix zero.
func (t *Time3339) IsZero() bool {
	return t == nil || time.Time(*t).IsZero() || time.Time(*t).Unix() == 0
}

// ByTime sorts times.
type ByTime []time.Time

func (s ByTime) Len() int           { return len(s) }
func (s ByTime) Less(i, j int) bool { return s[i].Before(s[j]) }
func (s ByTime) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }

// A ReadSeekCloser can Read, Seek, and Close.
type ReadSeekCloser interface {
	io.Reader
	io.Seeker
	io.Closer
}

type ReaderAtCloser interface {
	io.ReaderAt
	io.Closer
}

type SizeReaderAt interface {
	io.ReaderAt
	Size() int64
}

// TODO(wathiede): make sure all the stat readers work with code that
// type asserts ReadFrom/WriteTo.

type varStatReader struct {
	*expvar.Int
	r io.Reader
}

// NewReaderStats returns an io.Reader that will have the number of bytes
// read from r added to v.
func NewStatsReader(v *expvar.Int, r io.Reader) io.Reader {
	return &varStatReader{v, r}
}

func (v *varStatReader) Read(p []byte) (int, error) {
	n, err := v.r.Read(p)
	v.Int.Add(int64(n))
	return n, err
}

type varStatReadSeeker struct {
	*expvar.Int
	rs io.ReadSeeker
}

// NewReaderStats returns an io.ReadSeeker that will have the number of bytes
// read from rs added to v.
func NewStatsReadSeeker(v *expvar.Int, r io.ReadSeeker) io.ReadSeeker {
	return &varStatReadSeeker{v, r}
}

func (v *varStatReadSeeker) Read(p []byte) (int, error) {
	n, err := v.rs.Read(p)
	v.Int.Add(int64(n))
	return n, err
}

func (v *varStatReadSeeker) Seek(offset int64, whence int) (int64, error) {
	return v.rs.Seek(offset, whence)
}

// InvertedBool is a bool that marshals to and from JSON with the opposite of its in-memory value.
type InvertedBool bool

func (ib InvertedBool) MarshalJSON() ([]byte, error) {
	return json.Marshal(!bool(ib))
}

func (ib *InvertedBool) UnmarshalJSON(b []byte) error {
	var bo bool
	if err := json.Unmarshal(b, &bo); err != nil {
		return err
	}
	*ib = InvertedBool(!bo)
	return nil
}

// Get returns the logical value of ib.
func (ib InvertedBool) Get() bool {
	return !bool(ib)
}

// U32 converts n to an uint32, or panics if n is out of range
func U32(n int64) uint32 {
	if n < 0 || n > math.MaxUint32 {
		panic("bad size " + fmt.Sprint(n))
	}
	return uint32(n)
}

// NewOnceCloser returns a Closer wrapping c which only calls Close on c
// once. Subsequent calls to Close return nil.
func NewOnceCloser(c io.Closer) io.Closer {
	return &onceCloser{c: c}
}

type onceCloser struct {
	mu sync.Mutex
	c  io.Closer
}

func (c *onceCloser) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.c == nil {
		return nil
	}
	err := c.c.Close()
	c.c = nil
	return err
}

// TB is a copy of testing.TB so things can take a TB without linking
// in the testing package (which defines its own flags, etc).
type TB interface {
	Error(args ...interface{})
	Errorf(format string, args ...interface{})
	Fail()
	FailNow()
	Failed() bool
	Fatal(args ...interface{})
	Fatalf(format string, args ...interface{})
	Log(args ...interface{})
	Logf(format string, args ...interface{})
	Skip(args ...interface{})
	SkipNow()
	Skipf(format string, args ...interface{})
	Skipped() bool
}

// CloseFunc implements io.Closer with a function.
type CloseFunc func() error

func (fn CloseFunc) Close() error { return fn() }
