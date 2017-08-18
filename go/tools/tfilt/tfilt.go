// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

// tfilt is a scrappy little program to make the copious test_logger
// output on test failures a little easier to read.
//
// It removes the "        test_logger.go:48:" prefix when it
// appears.  It also marks the failures with bars of asterisks and
// collects the list of failing tests to display later.
//
// To install:
//
//         // install it to $GOPATH/bin
//         go install
//
// To use:
//
//         go test | tfilt
//

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
)

func main() {
	var failures []string
	bar := strings.Repeat("*", 80)
	re := regexp.MustCompile(`^\ttest_logger\.go:\d+:`)
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "--- FAIL") {
			failures = append(failures, line)
			line = bar + "\n" + line + "\n" + bar
		} else {
			line = re.ReplaceAllString(line, "\t")
		}
		fmt.Println(line)
	}
	if err := scanner.Err(); err != nil {
		fmt.Fprintln(os.Stderr, "reading standard input:", err)
	}

	if len(failures) > 0 {
		fmt.Println("failures:")
		for _, f := range failures {
			fmt.Println(f)
		}
	}
}
