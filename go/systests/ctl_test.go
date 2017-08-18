// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"fmt"
	"regexp"
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"
)

func (v *versionUI) GetDumbOutputUI() libkb.DumbOutputUI {
	return v
}

func (v *versionUI) Printf(format string, args ...interface{}) (n int, err error) {
	v.outbuf = append(v.outbuf, fmt.Sprintf(format, args...))
	return 0, nil
}

func (v *versionUI) PrintfStderr(format string, args ...interface{}) (n int, err error) {
	return 0, nil
}

type versionUI struct {
	baseNullUI
	outbuf []string
	libkb.Contextified
}

func (v *versionUI) checkVersionOutput(t *testing.T) {
	rx := regexp.MustCompile(":\\s*")
	n := len(v.outbuf)
	if n < 2 {
		t.Fatalf("expected >= 2 lines of output; got %d\n", n)
	}
	s := rx.Split(v.outbuf[n-1], -1)
	c := rx.Split(v.outbuf[n-2], -1)
	if s[0] != "Service" {
		t.Fatalf("%s != Service", s[0])
	}
	if c[0] != "Client" {
		t.Fatalf("%s != Client", c[0])
	}
	if c[1] != s[1] {
		t.Fatalf("version mismatch: %s != %s", c[1], s[1])
	}
}

func TestVersionAndStop(t *testing.T) {

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

	vui := versionUI{
		Contextified: libkb.NewContextified(tc2.G),
	}
	tc2.G.SetUI(&vui)

	<-startCh
	version := client.NewCmdVersionRunner(tc2.G)

	if err := version.Run(); err != nil {
		t.Fatal(err)
	}

	vui.checkVersionOutput(t)

	if err := client.CtlServiceStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}
