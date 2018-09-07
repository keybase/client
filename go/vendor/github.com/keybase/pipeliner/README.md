# pipeliner

[![Build Status](https://travis-ci.org/keybase/pipeliner.svg?branch=master)](https://travis-ci.org/keybase/pipeliner)
[![GoDoc](https://godoc.org/github.com/keybase/pipeliner?status.svg)](https://godoc.org/github.com/keybase/pipeliner)

A simplified pipline library, for parallel requests with bounded parallelism.

## Getting

```sh
go get github.com/keybase/pipeliner
```

## Background

Often you want do network requests with bounded parallelism. Let's say you have
1,000 DNS queries to make, and don't want to wait for them to complete in serial,
but don't want to blast your server with 1,000 simultaneous requests. In this case,
*bounded parallelism* makes sense. Make 1,000 requests with only 10 outstanding
at any one time.

At this point, I usually Google for it, and come up with [this blog post](https://blog.golang.org/pipelines), and I become slightly sad, because that is a lot of code to digest and
understand to do something that should be rather simple. It's not really the fault
of the languge, but more so the library. Here is a library that makes it a lot
easier:

## Example

```go
import (
	"context"
	"github.com/keybase/pipeliner"
	"sync"
	"time"
)

// See example_request_test.go for a runnable example.

type Request struct{ i int }
type Result struct{ i int }

func (r Request) Do() (Result, error) {
	time.Sleep(time.Millisecond)
	return Result{r.i}, nil
}

// makeRequests calls `Do` on all of the given requests, with only `window` outstanding
// at any given time. It puts the results in `results`, and errors out on the first
// failure.
func makeRequests(ctx context.Context, requests []Request, window int) (results []Result, err error) {

	var resultsLock sync.Mutex
	results = make([]Result, len(requests))

	pipeliner := pipeliner.NewPipeliner(window)

	worker := func(ctx context.Context, i int) error {
		res, err := requests[i].Do()
		resultsLock.Lock()
		results[i] = res
		resultsLock.Unlock()
		return err // the first error will kill the pipeline
	}

	for i := range requests {
		err := pipeliner.WaitForRoom(ctx)
		if err != nil {
			return nil, err
		}
		go func(i int) { pipeliner.CompleteOne(worker(ctx, i)) }(i)
	}
	return results, pipeliner.Flush(ctx)
}
```