// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
)

func TestConfigGetAndSet(t *testing.T) {

	tc := setupTest(t, "stop")

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			t.Logf("hit an error in Run, which might be masked: %v", err)
		}
		stopCh <- err
	}()

	tc2 := cloneContext(tc)

	<-startCh

	testConfigGetAndSet(t, tc2.G)

	if err := client.CtlServiceStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

type configTestUI struct {
	baseNullUI
	stdout []string
	stderr []string
}

func (c *configTestUI) GetDumbOutputUI() libkb.DumbOutputUI {
	return c
}

func (c *configTestUI) Printf(fmtString string, args ...interface{}) (int, error) {
	s := fmt.Sprintf(fmtString, args...)
	c.stdout = append(c.stdout, s)
	return 0, nil
}

func (c *configTestUI) PrintfStderr(fmtString string, args ...interface{}) (int, error) {
	s := fmt.Sprintf(fmtString, args...)
	c.stderr = append(c.stderr, s)
	return 0, nil
}

func compareLists(t *testing.T, wanted []string, got []string, desc string) {
	if wanted == nil {
		return
	}
	if len(wanted) != len(got) {
		t.Fatalf("In list %s: wrong length: wanted %d but got %d", desc, len(wanted), len(got))
	}
	for i, s := range wanted {
		if s != got[i] {
			t.Fatalf("At element %d of list %s: wanted %q but got %q", i, desc, s, got[i])
		}
	}
}

func testConfigGet(t *testing.T, g *libkb.GlobalContext, path string, stdout []string, stderr []string, wantErr bool) {
	ctui := configTestUI{}
	g.SetUI(&ctui)
	get := client.NewCmdConfigGetRunner(g)
	get.Path = path
	err := get.Run()
	if wantErr && err == nil {
		t.Fatal("Expected an error")
	}
	if !wantErr && err != nil {
		t.Fatalf("Wanted no error, but got: %v", err)
	}
	compareLists(t, stderr, ctui.stderr, "standard error")
	compareLists(t, stdout, ctui.stdout, "standard output")
}

func testConfigSet(t *testing.T, g *libkb.GlobalContext, path string, val keybase1.ConfigValue, wantErr bool) {
	set := client.NewCmdConfigSetRunner(g)
	set.Path = path
	set.Value = val
	err := set.Run()
	if wantErr && err == nil {
		t.Fatal("Expected an error")
	}
	if !wantErr && err != nil {
		t.Fatalf("Wanted no error, but got: %v", err)
	}
}

func testConfigClear(t *testing.T, g *libkb.GlobalContext, path string, wantErr bool) {
	set := client.NewCmdConfigSetRunner(g)
	set.Path = path
	set.DoClear = true
	err := set.Run()
	if wantErr && err == nil {
		t.Fatal("Expected an error")
	}
	if !wantErr && err != nil {
		t.Fatalf("Wanted no error, but got: %v", err)
	}
}

func testConfigGetAndSet(t *testing.T, g *libkb.GlobalContext) {
	testConfigGet(t, g, "a", []string{}, nil, true)
	i := 20
	testConfigSet(t, g, "foo", keybase1.ConfigValue{I: &i}, false)
	testConfigGet(t, g, "foo", []string{"20\n"}, nil, false)
	b := false
	testConfigSet(t, g, "foo", keybase1.ConfigValue{B: &b}, false)
	testConfigGet(t, g, "foo", []string{"false\n"}, nil, false)
	s := "bartime"
	testConfigSet(t, g, "foo.bar", keybase1.ConfigValue{S: &s}, false)
	testConfigGet(t, g, "foo", []string{"{\"bar\":\"bartime\"}\n"}, nil, false)
	testConfigSet(t, g, "foo.baz", keybase1.ConfigValue{IsNull: true}, false)
	testConfigGet(t, g, "foo", []string{"{\"bar\":\"bartime\",\"baz\":null}\n"}, nil, false)
	o := `
	    [ { "a" : { "b" : [1,2,3], "c" : true } }, 10, "hi" ]
	`
	testConfigSet(t, g, "yo", keybase1.ConfigValue{O: &o}, false)
	testConfigGet(t, g, "yo.0.a.b", []string{"[1,2,3]\n"}, nil, false)
	testConfigClear(t, g, "yo.0.a.c", false)
	testConfigGet(t, g, "", []string{"{\"foo\":{\"bar\":\"bartime\",\"baz\":null},\"yo\":[{\"a\":{\"b\":[1,2,3]}},10,\"hi\"]}\n"}, nil, false)
}
