package keybase1

import (
  "encoding/json"
  "fmt"
  "time"
  jsonw "github.com/keybase/go-jsonw"
)

type Time struct {
  t time.Time
}

func TimeFromMillis(m int64) Time {
  t := time.Unix(0, m * 1000000)
  return Time{t}
}

func Now() Time {
  return TimeFromMillis(time.Now().UnixNano() / 1000000)
}

func (t Time) MarshalJSON() ([]byte, error) {
  return json.Marshal(t.ToMillis())
}

func (t *Time) UnmarshalJSON(data []byte) (err error) {
  var m int64
  err = json.Unmarshal(data, &m)
  if err != nil {
    return
  }
  *t = TimeFromMillis(m)
  return
}

func (t Time) ToMillis() int64 {
  return time.Now().UnixNano() / 1000000
}

func (t Time) ToJsonw() *jsonw.Wrapper {
  return jsonw.NewInt64(t.ToMillis())
}

func (t Time) ToTime() time.Time {
  return t.t
}

func (t Time) Format() string {
  layout := "2006-01-02 15:04:05 MST"
  return t.ToTime().Format(layout)
}

func (t Time) WriteExt(interface{}) []byte {
  panic("unsupported")
}

func (t Time) ReadExt(i interface{}, b []byte) {
  panic("unsupported")
}

func (t Time) ConvertExt(v interface{}) interface{} {
  switch v2 := v.(type) {
    case Time:
      return v2.ToMillis()
    case *Time:
      return v2.ToMillis()
    default:
      panic(fmt.Sprintf("unsupported format for time conversion: expecting Time; got %T", v))
    }
}

func (t Time) UpdateExt(dest interface{}, v interface{}) {
  tt := dest.(*Time)
    switch v2 := v.(type) {
    case int64:
      *tt = TimeFromMillis(v2)
    case uint64:
      *tt = TimeFromMillis(int64(v2))
    default:
      panic(fmt.Sprintf("unsupported format for time conversion: expecting int64/uint64; got %T", v))
    }
}
