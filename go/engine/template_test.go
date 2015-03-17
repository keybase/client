// +build ignore
//
// This is a test template for the Template engine.

package engine

import "testing"

func TestTemplate(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewTemplate()
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
