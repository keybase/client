package storage

import (
	"github.com/jonboulle/clockwork"
	"github.com/keybase/gregor"
	"time"
)

type mysqlTimeWriter struct{}

func (m mysqlTimeWriter) Now(b builder, cl clockwork.Clock) {
	if cl == nil {
		b.Build("NOW()")
	} else {
		b.Build("?", cl.Now())
	}
}

func (m mysqlTimeWriter) TimeOrOffset(b builder, cl clockwork.Clock, too gregor.TimeOrOffset) {
	if too == nil {
		b.Build("NULL")
		return
	}
	if t := too.Time(); t != nil {
		b.Build("?", *t)
		return
	}
	if d := too.Offset(); d != nil {
		b.Build("DATE_ADD(")
		m.Now(b, cl)
		b.Build(", INTERVAL ? MICROSECOND)", (d.Nanoseconds() / 1000))
		return
	}
	b.Build("NULL")
}

func (m mysqlTimeWriter) TimeArg(t time.Time) interface{} {
	return t
}

type sqliteTimeWriter struct{}

// in microseconds since the epoch
func timeInUnix(t time.Time) int64 {
	return t.UnixNano() / 1000
}

func nowTime(cl clockwork.Clock) time.Time {
	if cl == nil {
		return time.Now()
	}
	return cl.Now()
}

func nowUnix(cl clockwork.Clock) int64 {
	return timeInUnix(nowTime(cl))
}

func (m sqliteTimeWriter) Now(b builder, cl clockwork.Clock) {
	b.Build("?", nowUnix(cl))
}

func (m sqliteTimeWriter) TimeOrOffset(b builder, cl clockwork.Clock, too gregor.TimeOrOffset) {
	if too == nil {
		b.Build("NULL")
		return
	}
	if t := too.Time(); t != nil {
		b.Build("?", timeInUnix(*t))
		return
	}
	if d := too.Offset(); d != nil {
		t := nowTime(cl).Add(*d)
		b.Build("?", timeInUnix(t))
		return
	}
	b.Build("NULL")
}

func (m sqliteTimeWriter) TimeArg(t time.Time) interface{} {
	return timeInUnix(t)
}
