// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/keybase/client/go/logger"
)

const shortPath = `DOKAN1.DLL`
const syswow64 = `C:\WINDOWS\SYSWOW64\`
const system32 = `C:\WINDOWS\SYSTEM32\`

type errorPrinter struct {
	buf bytes.Buffer
}

func (ep *errorPrinter) Printf(s string, os ...interface{}) {
	fmt.Fprintf(&ep.buf, s, os...)
}

func debugFileInfo(epc *errorPrinter, path string) {
	f, err := os.Open(path)
	epc.Printf("debugFileInfo: open(%q) -> %v, %+v\n", path, f, err)
	if err != nil {
		return
	}
	defer f.Close()
	fi, err := f.Stat()
	epc.Printf("debugFileInfo: stat(%q) -> %v, %+v\n", path, fi, err)
	if fi != nil {
		epc.Printf("debugFileInfo: modtime is %v\n", fi.ModTime())
	}
	h := sha256.New()
	n, err := io.Copy(h, f)
	epc.Printf("debugFileInfo: read bytes -> %d, %+v\n", n, err)
	if err != nil {
		return
	}
	epc.Printf("debugFileInfo: sha256 %X\n", h.Sum(nil))
}

func logDokanFilesInfo(epc *errorPrinter) {
	cwd := ``
	if d, err := os.Getwd(); err == nil {
		cwd = d + `\`
	}
	for _, d := range []string{syswow64, system32, cwd} {
		debugFileInfo(epc, d+shortPath)
	}
	for _, d := range []string{syswow64, system32} {
		debugFileInfo(epc, d+`DRIVERS\DOKAN.SYS`)
		debugFileInfo(epc, d+`DRIVERS\DOKAN1.SYS`)
		debugFileInfo(epc, d+`DRIVERS\DOKAN2.SYS`)
	}
}

func logDokanServiceInfo(epc *errorPrinter) {
	epc.Printf("Running 'sc query dokan1'")
	bs, err := exec.Command("sc", "query", "dokan1").CombinedOutput()
	if err != nil {
		epc.Printf("exec.Command error: %+v\n", err)
		return
	}
	epc.Printf("%s\n", bs)
}

func logDokanInfo(ctx context.Context, log logger.Logger) {
	var epc errorPrinter
	logDokanFilesInfo(&epc)
	logDokanServiceInfo(&epc)
	log.CDebugf(ctx, "Dokan info:\n%s", epc.buf.Bytes())
}
