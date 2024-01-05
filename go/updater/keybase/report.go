// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"bytes"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/util"
)

// ReportError notifies the API server of a client updater error
func (c context) ReportError(err error, update *updater.Update, options updater.UpdateOptions) {
	if reportErr := c.reportError(err, update, options, defaultEndpoints.err, time.Minute); reportErr != nil {
		c.log.Warningf("Error notifying about an error: %s", reportErr)
	}
}

func (c context) reportError(err error, update *updater.Update, options updater.UpdateOptions, uri string, timeout time.Duration) error {
	var errorType string
	switch uerr := err.(type) {
	case updater.Error:
		errorType = uerr.TypeString()
	default:
		errorType = string(updater.UnknownError)
	}

	data := url.Values{}
	data.Add("error_type", errorType)
	data.Add("description", err.Error())
	return c.report(data, update, options, uri, timeout)
}

// ReportAction notifies the API server of a client updater action
func (c context) ReportAction(actionResponse updater.UpdatePromptResponse, update *updater.Update, options updater.UpdateOptions) {
	if err := c.reportAction(actionResponse, update, options, defaultEndpoints.action, time.Minute); err != nil {
		c.log.Warningf("Error notifying about an action (%s): %s", actionResponse.Action, err)
	}
}

func (c context) reportAction(actionResponse updater.UpdatePromptResponse, update *updater.Update, options updater.UpdateOptions, uri string, timeout time.Duration) error {
	data := url.Values{}
	data.Add("action", actionResponse.Action.String())
	autoUpdate, _ := c.config.GetUpdateAuto()
	data.Add("auto_update", util.URLValueForBool(autoUpdate))
	if actionResponse.SnoozeDuration > 0 {
		data.Add("snooze_duration", fmt.Sprintf("%d", actionResponse.SnoozeDuration))
	}
	return c.report(data, update, options, uri, timeout)
}

func (c context) ReportSuccess(update *updater.Update, options updater.UpdateOptions) {
	if err := c.reportSuccess(update, options, defaultEndpoints.success, time.Minute); err != nil {
		c.log.Warningf("Error notifying about success: %s", err)
	}
}

func (c context) reportSuccess(update *updater.Update, options updater.UpdateOptions, uri string, timeout time.Duration) error {
	data := url.Values{}
	return c.report(data, update, options, uri, timeout)
}

func (c context) report(data url.Values, update *updater.Update, options updater.UpdateOptions, uri string, timeout time.Duration) error {
	if update != nil {
		data.Add("install_id", update.InstallID)
		data.Add("request_id", update.RequestID)
	}
	data.Add("version", options.Version)
	data.Add("upd_version", options.UpdaterVersion)

	req, err := http.NewRequest("POST", uri, bytes.NewBufferString(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
	client, err := httpClient(timeout)
	if err != nil {
		return err
	}
	c.log.Infof("Reporting: %s %v", uri, data)
	resp, err := client.Do(req)
	defer util.DiscardAndCloseBodyIgnoreError(resp)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Notify error returned bad HTTP status %v", resp.Status)
	}
	return nil
}
