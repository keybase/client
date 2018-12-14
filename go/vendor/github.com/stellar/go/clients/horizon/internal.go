package horizon

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/manucorporat/sse"
	"github.com/stellar/go/support/errors"
)

var endEvent = regexp.MustCompile("(\r\n|\r|\n){2}")

func decodeResponse(resp *http.Response, object interface{}) (err error) {
	defer resp.Body.Close()
	decoder := json.NewDecoder(resp.Body)

	if !(resp.StatusCode >= 200 && resp.StatusCode < 300) {
		horizonError := &Error{
			Response: resp,
		}
		decodeError := decoder.Decode(&horizonError.Problem)
		if decodeError != nil {
			return errors.Wrap(decodeError, "error decoding horizon.Problem")
		}
		return horizonError
	}

	err = decoder.Decode(&object)
	if err != nil {
		return
	}
	return
}

func loadMemo(p *Payment) error {
	res, err := http.Get(p.Links.Transaction.Href)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	return json.NewDecoder(res.Body).Decode(&p.Memo)
}

func parseEvent(data []byte) (result sse.Event, err error) {
	r := bytes.NewReader(data)
	events, err := sse.Decode(r)
	if err != nil {
		return
	}

	if len(events) != 1 {
		err = fmt.Errorf("only expected 1 event, got: %d", len(events))
		return
	}

	result = events[0]
	return
}

func splitSSE(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if atEOF {
		return 0, nil, nil
	}

	if loc := endEvent.FindIndex(data); loc != nil {
		return loc[1], data[0:loc[1]], nil
	}

	return 0, nil, nil
}
