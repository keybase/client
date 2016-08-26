package gregor

import (
	"net/url"
)

func URLAddParseTime(s string) (string, error) {
	dsn, err := url.Parse(s)
	if err != nil {
		return "", err
	}

	query := dsn.Query()
	query.Set("parseTime", "true")
	dsn.RawQuery = query.Encode()

	return dsn.String(), nil
}
