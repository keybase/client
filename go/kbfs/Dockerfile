FROM keybaseprivate/kbclient
MAINTAINER Keybase <admin@keybase.io>

ARG KEYBASE_TEST_ROOT_CERT_PEM
ARG KEYBASE_TEST_ROOT_CERT_PEM_B64

ENV KEYBASE_TEST_ROOT_CERT_PEM=$KEYBASE_TEST_ROOT_CERT_PEM \
    KEYBASE_TEST_ROOT_CERT_PEM_B64=$KEYBASE_TEST_ROOT_CERT_PEM_B64 \
    KBFS_METADATA_VERSION=$KBFS_METADATA_VERSION \
    KEYBASE_DEBUG=1

ENTRYPOINT ["kbfsfuse.sh"]

ADD kbfsfuse/kbfsfuse.sh /home/keybase/
ADD kbfsfuse/kbfsfuse /home/keybase/
ADD kbfsgit/git-remote-keybase/git-remote-keybase /home/keybase/
ADD kbfsfuse/revision /home/keybase/kbfs_revision
