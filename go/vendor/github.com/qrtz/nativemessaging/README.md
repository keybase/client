# nativemessaging
Native messaging host library for go application  

## Usage

**Go host application**

``` go
package main

import (
	"io"
	"os"

	"github.com/qrtz/nativemessaging"
)

func main() {
	decoder := nativemessaging.NewNativeJSONDecoder(os.Stdin)
	encoder := nativemessaging.NewNativeJSONEncoder(os.Stdout)

	for {
		var rsp response
		var msg message
		err := decoder.Decode(&msg)

		if err != nil {
			if err == io.EOF {
				// exit
				return
			}
			rsp.Text = err.Error()
		} else {
			if msg.Text == "ping" {
				rsp.Text = "pong"
				rsp.Success = true
			} else {
				// Echo the message back to the client
				rsp.Text = msg.Text
			}
		}

		if err := encoder.Encode(rsp); err != nil {
			// Log the error and exit
			return
		}
	}
}

type message struct {
	Text string `json:"text"`
}

type response struct {
	Text    string `json:"text"`
	Success bool   `json:"success"`
}
```

**Javascript client**

``` js
    chrome.runtime.sendNativeMessage('com.github.qrtz.nativemessaginghost', {text:'ping'}, (response) => {
        console.log('Native messaging host response ', response);
    })
```

**More info:**  

https://developer.chrome.com/extensions/nativeMessaging  
https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_messaging
