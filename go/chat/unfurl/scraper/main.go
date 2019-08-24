package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/unfurl"
	"github.com/keybase/client/go/libkb"
)

func main() {
	flag.Parse()
	args := flag.Args()
	if len(args) != 1 {
		fmt.Printf("must supply a URL\n")
		os.Exit(3)
	}

	url := args[0]
	// Run it with an empty global context. Will only impact proxy support
	scraper := unfurl.NewScraper(globals.NewContext(libkb.NewGlobalContextInit(), &globals.ChatContext{}))
	res, err := scraper.Scrape(context.TODO(), url, nil)
	if err != nil {
		fmt.Printf("error scraping URL: %v\n", err)
		os.Exit(3)
	}
	fmt.Printf("%s\n", res.UnsafeDebugString())
}
