package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

func main() {
	jsonBlob := `1421279923`
	dec := json.NewDecoder(strings.NewReader(jsonBlob))
	var tmp interface{}
	dec.UseNumber()
	err := dec.Decode(&tmp)
	if err != nil {
		fmt.Println("error:", err)
	}
	b, err := json.Marshal(tmp)
	if err != nil {
		fmt.Println("error:", err)
	}
	fmt.Printf("%s\n", string(b))
}
