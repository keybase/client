package service

import (
	"testing"
	"time"
)

func TestParseDurationExtended(t *testing.T) {
	d, err := parseDurationExtended("123d12h2ns")
	if err != nil {
		t.Fatal(err)
	}
	expected := 123*24*time.Hour + 12*time.Hour + 2*time.Nanosecond
	if d != expected {
		t.Fatalf("wrong parsed duration. Expected %v, got %v\n", expected, d)
	}
}
