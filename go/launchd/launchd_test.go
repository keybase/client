package launchd

import (
	"encoding/xml"
	"testing"
)

func TestPlist(t *testing.T) {
	plist := NewPlist("keybase.testing", "/path/to/file", []string{"--flag=test", "testArg"})

	data := plist.plist()
	t.Logf("Plist: %s\n", data)

	var i interface{}
	// This tests valid XML but not actual values
	err := xml.Unmarshal([]byte(data), &i)
	if err != nil {
		t.Errorf("Bad plist: %s", err)
	}
}
