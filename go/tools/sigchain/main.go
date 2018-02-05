package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"runtime"
	"runtime/pprof"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

var uid = flag.String("uid", "", "uid of sigchain owner")
var username = flag.String("username", "", "username of sigchain owner")

func errout(msg string) {
	fmt.Fprintf(os.Stderr, msg+"\n")
	os.Exit(1)
}

func read() []byte {
	var in io.Reader
	switch flag.NArg() {
	case 0:
		fmt.Println("reading sigchain from stdin")
		in = os.Stdin
	case 1:
		fmt.Printf("reading sigchain from %q\n", flag.Arg(0))
		f, err := os.Open(flag.Arg(0))
		if err != nil {
			errout(err.Error())
		}
		defer f.Close()
		in = f
	default:
		errout("provide 0 or 1 args")
	}

	all, err := ioutil.ReadAll(in)
	if err != nil {
		errout(err.Error())
	}
	fmt.Printf("%d bytes read\n", len(all))
	return all
}

func memstats() {
	runtime.GC()
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	fmt.Printf("Alloc: %d (%d KB) (%d MB)\n", ms.Alloc, ms.Alloc/1024, ms.Alloc/(1024*1024))
	fmt.Printf("TotalAlloc: %d (%d KB) (%d MB)\n", ms.TotalAlloc, ms.TotalAlloc/1024, ms.TotalAlloc/(1024*1024))
}

func memprof() {
	f, err := os.Create("/tmp/sc_memprof")
	if err != nil {
		log.Fatal("could not create memory profile: ", err)
	}
	runtime.GC() // get up-to-date statistics
	if err := pprof.WriteHeapProfile(f); err != nil {
		log.Fatal("could not write memory profile: ", err)
	}
	f.Close()
	fmt.Printf("wrote memory profile to /tmp/sc_memprof\n")
}

// don't GC me
var sc *libkb.SigChain

func main() {
	fmt.Println("sigchain loader")
	flag.Parse()
	raw := read()

	g := libkb.NewGlobalContext().Init()
	g.Log = logger.New("sc")
	g.ConfigureCaches()

	sc = &libkb.SigChain{Contextified: libkb.NewContextified(g)}
	sc.SetUIDUsername(keybase1.UID(*uid), *username)
	if _, err := sc.LoadServerBody(context.Background(), raw, 0, nil, ""); err != nil {
		errout(err.Error())
	}

	if err := sc.VerifyChain(context.Background()); err != nil {
		errout(err.Error())
	}

	if err := sc.Store(context.Background()); err != nil {
		errout(err.Error())
	}

	if err := sc.Clean(context.Background()); err != nil {
		errout(err.Error())
	}

	memstats()
	memprof()
}
