package storage

import (
	"encoding/hex"
	"errors"
	"time"

	"github.com/keybase/gregor"
)

var ErrBadScan = errors.New("bad scan of data type")
var ErrBadString = errors.New("expected either a string or a []byte")

type uidScanner struct {
	o   gregor.ObjFactory
	uid gregor.UID
}

func (u uidScanner) UID() gregor.UID { return u.uid }

func toString(src interface{}) (string, error) {
	switch s := src.(type) {
	case string:
		return s, nil
	case []byte:
		return string(s), nil
	default:
		return "", ErrBadString
	}
}

func scanHexToBytes(src interface{}) ([]byte, error) {
	s, err := toString(src)
	if err != nil {
		return nil, err
	}
	return hex.DecodeString(s)
}

func (u *uidScanner) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	b, err := scanHexToBytes(src)
	if err != nil {
		return err
	}
	u.uid, err = u.o.MakeUID(b)
	return err
}

type deviceIDScanner struct {
	o        gregor.ObjFactory
	deviceID gregor.DeviceID
}

func (d deviceIDScanner) DeviceID() gregor.DeviceID { return d.deviceID }

func (d *deviceIDScanner) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	b, err := scanHexToBytes(src)
	if err != nil {
		return err
	}
	d.deviceID, err = d.o.MakeDeviceID(b)
	return err
}

type msgIDScanner struct {
	o     gregor.ObjFactory
	msgID gregor.MsgID
}

func (m msgIDScanner) MsgID() gregor.MsgID { return m.msgID }

func (m *msgIDScanner) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	b, err := scanHexToBytes(src)
	if err != nil {
		return err
	}
	m.msgID, err = m.o.MakeMsgID(b)
	return err
}

type inBandMsgTypeScanner struct {
	t gregor.InBandMsgType
}

func (i inBandMsgTypeScanner) InBandMsgType() gregor.InBandMsgType { return i.t }

func (i *inBandMsgTypeScanner) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	if raw, ok := src.(int); ok {
		t := gregor.InBandMsgType(raw)
		switch t {
		case gregor.InBandMsgTypeUpdate, gregor.InBandMsgTypeSync:
			i.t = t
		default:
			return ErrBadScan
		}
	}
	return nil
}

type categoryScanner struct {
	o     gregor.ObjFactory
	c     gregor.Category
	isSet bool
}

func (c *categoryScanner) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	s, err := toString(src)
	if err != nil {
		return err
	}
	c.c, err = c.o.MakeCategory(s)
	if err == nil {
		c.isSet = true
	}
	return err
}

func (c categoryScanner) Category() gregor.Category {
	return c.c
}

func (c categoryScanner) IsSet() bool { return c.isSet }

type bodyScanner struct {
	o gregor.ObjFactory
	b gregor.Body
}

func (b *bodyScanner) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	if raw, ok := src.([]byte); ok {
		var err error
		body := make([]byte, len(raw))
		copy(body, raw)
		b.b, err = b.o.MakeBody(body)
		return err
	}
	return ErrBadScan
}

func (b bodyScanner) Body() gregor.Body { return b.b }

type timeScanner struct {
	t time.Time
}

func (t *timeScanner) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	switch tm := src.(type) {
	case time.Time:
		t.t = tm
	case int64:
		t.t = time.Unix(tm/1000000, (tm%1000000)*1000)
	default:
		return ErrBadScan
	}
	return nil
}

func (t timeScanner) TimeOrNil() *time.Time {
	if t.t.IsZero() {
		return nil
	}
	return &t.t
}

func (t timeScanner) Time() time.Time {
	return t.t
}
