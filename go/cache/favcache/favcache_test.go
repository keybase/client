package favcache

import (
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
)

func TestBasics(t *testing.T) {
	c := New()
	if len(c.List()) != 0 {
		t.Errorf("cache len: %d, expected 0", len(c.List()))
	}

	f1 := "patrick,max"
	c.Add(keybase1.Folder{Name: f1})
	if len(c.List()) != 1 {
		t.Fatalf("cache len: %d, expected 1", len(c.List()))
	}
	if c.List()[0].Name != f1 {
		t.Errorf("cache entry 0: %+v, expected %+v", c.List()[0], f1)
	}

	f2 := "chris,max"
	c.Add(keybase1.Folder{Name: f2})
	if len(c.List()) != 2 {
		t.Fatalf("cache len: %d, expected 2", len(c.List()))
	}
	if c.List()[0].Name != f2 {
		t.Errorf("cache entry 0: %+v, expected %+v", c.List()[0], f2)
	}
	if c.List()[1].Name != f1 {
		t.Errorf("cache entry 0: %+v, expected %+v", c.List()[1], f1)
	}

	c.Add(keybase1.Folder{Name: f2})
	if len(c.List()) != 2 {
		t.Fatalf("cache len: %d, expected 2", len(c.List()))
	}
	if c.List()[0].Name != f2 {
		t.Errorf("cache entry 0: %+v, expected %+v", c.List()[0], f2)
	}
	if c.List()[1].Name != f1 {
		t.Errorf("cache entry 0: %+v, expected %+v", c.List()[1], f1)
	}

	c.Delete(keybase1.Folder{Name: f1})
	if len(c.List()) != 1 {
		t.Fatalf("cache len: %d, expected 1", len(c.List()))
	}
	if c.List()[0].Name != f2 {
		t.Errorf("cache entry 0: %+v, expected %+v", c.List()[0], f2)
	}
}
