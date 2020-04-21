FROM kbclient
MAINTAINER Keybase <admin@keybase.io>

ARG KEYBASE_TEST_ROOT_CERT_PEM_B64

ENV KEYBASE_TEST_ROOT_CERT_PEM_B64=$KEYBASE_TEST_ROOT_CERT_PEM_B64 \
    KBFS_METADATA_VERSION=$KBFS_METADATA_VERSION \
    KEYBASE_DEBUG=1

ENTRYPOINT ["kbfsfuse.sh"]

ADD --chown=keybase:keybase kbfsfuse/kbfsfuse.sh /home/keybase/
ADD --chown=keybase:keybase kbfsfuse/kbfsfuse /home/keybase/
ADD --chown=keybase:keybase kbfsgit/git-remote-keybase/git-remote-keybase /home/keybase/
ADD --chown=keybase:keybase kbfsfuse/revision /home/keybase/kbfs_revision
