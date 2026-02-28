#!/usr/bin/env bash
URL="https://s3.amazonaws.com/aws-sms-pricing-info-prod-us-east-1/smsPricesAndDeliverability-latest.json"
curl $URL | jq 'keys | map({ (.): true}) | add' > data.json