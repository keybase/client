package main

import (
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"runtime"
	"runtime/pprof"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

var uid = flag.String("uid", "", "uid of sigchain owner")
var username = flag.String("username", "", "username of sigchain owner")
var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")

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
	if err := g.ConfigureCaches(); err != nil {
		errout(err.Error())
	}

	iterations := 1
	if *cpuprofile != "" {
		f, err := os.Create(*cpuprofile)
		if err != nil {
			log.Fatal(err)
		}
		if err := pprof.StartCPUProfile(f); err != nil {
			errout(err.Error())
		}
		defer pprof.StopCPUProfile()

		iterations = 10
	}

	m := libkb.NewMetaContextBackground(g)

	for i := 0; i < iterations; i++ {
		start := time.Now()
		sc = &libkb.SigChain{Contextified: libkb.NewContextified(g)}
		sc.SetUIDUsername(keybase1.UID(*uid), *username)
		if _, err := sc.LoadServerBody(m, raw, 0, nil, ""); err != nil {
			errout(err.Error())
		}

		if err := sc.VerifyChain(m, keybase1.UID(*uid)); err != nil {
			errout(err.Error())
		}

		if err := sc.Store(m); err != nil {
			errout(err.Error())
		}
		elapsed := time.Since(start)
		fmt.Printf("sig chain load time: %s\n", elapsed)
	}

	memstats()
	memprof()
}
