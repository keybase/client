package ramcache

import (
	"testing"
	"testing/quick"
	"time"
)

func TestSet(t *testing.T) {
	r := New()
	err := r.Set("asdfwqer", "qwerqwer")
	if err != nil {
		t.Fatal(err)
	}
	count := r.Count()
	if count != 1 {
		t.Errorf("expected count == 1, got %d", count)
	}
}

func TestGet(t *testing.T) {
	r := New()
	r.Set("asdfqwer", "qwerqwer")
	x, err := r.Get("asdfqwer")
	if err != nil {
		t.Fatal(err)
	}
	if x.(string) != "qwerqwer" {
		t.Errorf("expected get to return 'qwerqwer', got %q", x.(string))
	}
}

func TestCreatedAt(t *testing.T) {
	now := time.Now()
	key := "asdfqwer"
	r := New()
	r.Set(key, "qwerqwer")
	created, err := r.CreatedAt(key)
	if err != nil {
		t.Fatal(err)
	}
	if !created.After(now) {
		t.Errorf("expected created to be after test start time.  test started at %s, created = %s", now, created)
	}
}

func TestCreatedAtUnchangedByGet(t *testing.T) {
	key := "asdfqwer"
	r := New()
	r.Set(key, "qwerqwer")
	before, err := r.CreatedAt(key)
	if err != nil {
		t.Fatal(err)
	}
	_, err = r.Get(key)
	if err != nil {
		t.Fatal(err)
	}
	after, err := r.CreatedAt(key)
	if err != nil {
		t.Fatal(err)
	}
	if before.Equal(after) == false {
		t.Errorf("created at changed with get.  before = %s, after = %s", before, after)
	}
}

func TestDelete(t *testing.T) {
	key := "asdfqwer"
	r := New()
	r.Set(key, "qwerqwer")
	before := r.Count()
	err := r.Delete(key)
	if err != nil {
		t.Fatal(err)
	}
	after := r.Count()
	if after-before != -1 {
		t.Errorf("expected count to decrease by 1, got %d", after-before)
	}
}

func TestRemove(t *testing.T) {
	key := "asdfqwer"
	r := New()
	r.Set(key, "qwerqwer")
	before := r.Count()
	obj, err := r.Remove(key)
	if err != nil {
		t.Fatal(err)
	}
	after := r.Count()
	if after-before != -1 {
		t.Errorf("expected count to decrease by 1, got %d", after-before)
	}
	s, ok := obj.(string)
	if !ok {
		t.Fatalf("returned object not a string")
	}
	if s != "qwerqwer" {
		t.Errorf("expected Remove to return object 'qwerqwer', got %q", s)
	}
}

func TestClean(t *testing.T) {
	r := New()
	r.Set("asdfqwer", "qwerqwer")
	before := r.Count()
	r.clean(time.Now())
	if (r.Count() - before) != 0 {
		t.Errorf("expected no deletions by clean, got: %d", r.Count()-before)
	}
	r.clean(time.Now().Add(10 * time.Minute))
	if (r.Count() - before) != -1 {
		t.Errorf("expected clean to remove one elt, got %d", r.Count()-before)
	}

}

func TestGetUpdatesAccessedAt(t *testing.T) {
	key := "asdfqwer"
	r := New()
	r.Set(key, "qwerqwer")
	i := r.cache[key]
	before := i.accessedAt
	_, err := r.Get(key)
	if err != nil {
		t.Fatal(err)
	}
	j := r.cache[key]
	after := j.accessedAt
	if !after.After(before) {
		t.Errorf("Get didn't make accessedAt newer.  before: %s, after: %s", before, after)
	}
}

func TestGetNoAccessDoesntUpdateAccessedAt(t *testing.T) {
	key := "asdfqwer"
	r := New()
	r.Set(key, "qwerqwer")
	i := r.cache[key]
	before := i.accessedAt
	_, err := r.GetNoAccess(key)
	if err != nil {
		t.Fatal(err)
	}
	j := r.cache[key]
	after := j.accessedAt
	if after.After(before) {
		t.Errorf("GetNoAccess made accessedAt newer.  before: %s, after: %s", before, after)
	}
}

func TestSetReplace(t *testing.T) {
	key := "asdfqwer"
	r := New()
	r.Set(key, "qwerqwer")
	if len(r.cache) != 1 {
		t.Errorf("expected 1 elt in cache, got %d", len(r.cache))
	}
	if len(r.tqueue) != 1 {
		t.Errorf("expected 1 elt in tqueue, got %d", len(r.tqueue))
	}
	r.Set(key, "qwerqwer")
	if len(r.cache) != 1 {
		t.Errorf("expected 1 elt in cache, got %d", len(r.cache))
	}
	if len(r.tqueue) != 1 {
		t.Errorf("expected 1 elt in tqueue, got %d", len(r.tqueue))
	}
	r.Set(key, "different")
	if len(r.cache) != 1 {
		t.Errorf("expected 1 elt in cache, got %d", len(r.cache))
	}
	if len(r.tqueue) != 1 {
		t.Errorf("expected 1 elt in tqueue, got %d", len(r.tqueue))
	}

}

func TestSetGetQuick(t *testing.T) {
	r := New()
	f := func(key, value string) bool {
		r.Set(key, value)
		v, err := r.Get(key)
		if err != nil {
			return false
		}
		s, ok := v.(string)
		if !ok {
			return false
		}
		if s != value {
			return false
		}
		return true
	}
	if err := quick.Check(f, nil); err != nil {
		t.Error(err)
	}
}

func TestSetRemoveQuick(t *testing.T) {
	r := New()
	f := func(key, value string) bool {
		r.Set(key, value)
		v, err := r.Remove(key)
		if err != nil {
			return false
		}
		s, ok := v.(string)
		if !ok {
			return false
		}
		if s != value {
			return false
		}
		if r.Count() != 0 {
			return false
		}
		return true
	}
	if err := quick.Check(f, nil); err != nil {
		t.Error(err)
	}
}

func TestSetDeleteQuick(t *testing.T) {
	r := New()
	f := func(key, value string) bool {
		r.Set(key, value)
		err := r.Delete(key)
		if err != nil {
			return false
		}
		if r.Count() != 0 {
			return false
		}
		return true
	}
	if err := quick.Check(f, nil); err != nil {
		t.Error(err)
	}
}

func TestBool(t *testing.T) {
	r := New()
	r.Set("asdfqwer", true)
	r.Set("zxcvzxcv", false)
	x, err := Bool(r.Get("asdfqwer"))
	if err != nil {
		t.Fatal(err)
	}
	if x != true {
		t.Errorf("expected get to return true, got %v", x)
	}
	y, err := Bool(r.Get("zxcvzxcv"))
	if err != nil {
		t.Fatal(err)
	}
	if y != false {
		t.Errorf("expected get to return false, got %v", y)
	}
}

func BenchmarkSet(b *testing.B) {
	r := New()
	for i := 0; i < b.N; i++ {
		r.Set("asdfqwer", "zxcvxczv")
	}
}
