FROM kbclient
MAINTAINER Keybase <admin@keybase.io>

ARG KEYBASE_TEST_ROOT_CERT_PEM

ENV KEYBASE_TEST_ROOT_CERT_PEM=$KEYBASE_TEST_ROOT_CERT_PEM \
    KEYBASE_DEBUG=1

ENTRYPOINT ["kbfsfuse.sh"]

ADD kbfsfuse.sh /home/keybase/
ADD kbfsfuse /home/keybase/
