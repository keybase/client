FROM archlinux:base
LABEL maintainer="Keybase <admin@keybase.io>"

RUN pacman -Syu --noconfirm \
  && pacman -S --noconfirm git binutils fuse libxss gtk3 fakeroot lsof \
  && pacman -Scc --noconfirm
