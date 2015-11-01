// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"fmt"
	"io"
	"strings"
	"text/tabwriter"
)

func Tablify(writer io.Writer, headings []string, rowfunc func() []string) {
	w := new(tabwriter.Writer)
	w.Init(writer, 5, 0, 3, ' ', 0)

	dorow := func(cells []string) {
		fmt.Fprintln(w, strings.Join(cells, "\t"))
	}

	if headings != nil {
		dorow(headings)
		seps := make([]string, len(headings), len(headings))
		for i, h := range headings {
			seps[i] = strings.Repeat("=", len(h)+1)
		}
		dorow(seps)
	}

	for {
		row := rowfunc()
		if row == nil {
			break
		}
		dorow(row)
	}

	w.Flush()
}
