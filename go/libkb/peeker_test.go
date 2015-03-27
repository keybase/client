package libkb

import (
	"strings"
	"testing"
)

func TestPeekerRead(t *testing.T) {
	s := "Economic data out this week was mixed. While new-home sales ticked up, existing-home sales remained sluggish and orders for durable goods continued to slide. The latest reading of fourth-quarter gross domestic product (GDP) disappointed as well."
	p := NewPeeker(strings.NewReader(s))
	d := make([]byte, 10)
	n, err := p.Read(d)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(d) {
		t.Errorf("bytes read: %d, expected %d", n, len(d))
	}
	if string(d) != "Economic d" {
		t.Errorf("data: %q, expected %q", string(d), "Economic d")
	}
}

func TestPeekerPeek(t *testing.T) {
	s := "Economic data out this week was mixed. While new-home sales ticked up, existing-home sales remained sluggish and orders for durable goods continued to slide. The latest reading of fourth-quarter gross domestic product (GDP) disappointed as well."
	p := NewPeeker(strings.NewReader(s))
	h := make([]byte, 5)
	n, err := p.Peek(h)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(h) {
		t.Errorf("bytes peeked: %d, expected %d", n, len(h))
	}
	if string(h) != "Econo" {
		t.Errorf("peek: %q, expected %q", string(h), "Econo")
	}
	d := make([]byte, 10)
	n, err = p.Read(d)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(d) {
		t.Errorf("bytes read: %d, expected %d", n, len(d))
	}
	if string(d) != "Economic d" {
		t.Errorf("data: %q, expected %q", string(d), "Economic d")
	}
}

func TestPeekerPeekSmallRead(t *testing.T) {
	s := "Economic data out this week was mixed. While new-home sales ticked up, existing-home sales remained sluggish and orders for durable goods continued to slide. The latest reading of fourth-quarter gross domestic product (GDP) disappointed as well."
	p := NewPeeker(strings.NewReader(s))
	h := make([]byte, 5)
	n, err := p.Peek(h)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(h) {
		t.Errorf("bytes peeked: %d, expected %d", n, len(h))
	}
	if string(h) != "Econo" {
		t.Errorf("peek: %q, expected %q", string(h), "Econo")
	}
	d := make([]byte, 3)
	n, err = p.Read(d)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(d) {
		t.Errorf("bytes read: %d, expected %d", n, len(d))
	}
	if string(d) != "Eco" {
		t.Errorf("data: %q, expected %q", string(d), "Eco")
	}
	n, err = p.Read(d)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(d) {
		t.Errorf("bytes read: %d, expected %d", n, len(d))
	}
	if string(d) != "nom" {
		t.Errorf("data: %q, expected %q", string(d), "nom")
	}
	n, err = p.Read(d)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(d) {
		t.Errorf("bytes read: %d, expected %d", n, len(d))
	}
	if string(d) != "ic " {
		t.Errorf("data: %q, expected %q", string(d), "ic ")
	}
}
