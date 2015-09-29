# miniline

Use it like this:

```go
package main

import (
    "fmt"
    "github.com/Sidnicious/miniline"
)

func main() {
    line, err := miniline.ReadLine("> ")
    fmt.Printf("Read: %#v\n (err: %#v)\n", line, err)
}

```
