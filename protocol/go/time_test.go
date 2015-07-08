package keybase1

import (
  "testing"
  "encoding/json"
)

func TestTimeMarshal(t *testing.T) {
  t1 := Now()
  if t1.ToMillis() <= 0 {
    t.Errorf("Now time was 0")
  }
  t.Logf("Now in millis: %s", t1.ToMillis())

  data, err := json.Marshal(t1)
  if err != nil {
    panic(err)
  }
  var t2 Time
  err2 := json.Unmarshal(data, &t2)
  if err2 != nil {
    panic(err2)
  }

  if t1.ToMillis() != t2.ToMillis() {
    t.Errorf("Time mismatch: %s != %s", t1.ToMillis(), t2.ToMillis())
  }
}
