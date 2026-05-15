FROM ubuntu:latest
LABEL authors="ivanmihajlov"

ENTRYPOINT ["top", "-b"]