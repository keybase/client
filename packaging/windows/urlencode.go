package main

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

func usage() {
	fmt.Printf("usage: go run urlencode.go <text>\n")
}

func main() {
	args := os.Args
	if len(args) != 2 {
		usage()
		os.Exit(3)
	}
	fmt.Println(strings.ReplaceAll(url.QueryEscape(args[1]), "%", "%%"))

	os.Exit(0)
}
