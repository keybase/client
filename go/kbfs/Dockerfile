FROM kbclient
LABEL maintainer="Keybase <admin@keybase.io>"

ARG KEYBASE_TEST_ROOT_CERT_PEM

ENV KEYBASE_TEST_ROOT_CERT_PEM=$KEYBASE_TEST_ROOT_CERT_PEM \
    KEYBASE_DEBUG=1

ENTRYPOINT ["kbfsfuse.sh"]

COPY --chown=keybase:keybase kbfsfuse/kbfsfuse.sh /home/keybase/
COPY --chown=keybase:keybase kbfsfuse/kbfsfuse /home/keybase/
COPY --chown=keybase:keybase kbfsgit/git-remote-keybase/git-remote-keybase /home/keybase/
COPY --chown=keybase:keybase kbfsfuse/revision /home/keybase/kbfs_revision
