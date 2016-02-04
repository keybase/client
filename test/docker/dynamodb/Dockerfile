FROM itzg/ubuntu-openjdk-7
MAINTAINER Keybase <admin@keybase.io>

RUN apt-get update && apt-get install -y wget

RUN mkdir /var/dynamodb
WORKDIR /var/dynamodb

RUN wget -nv -O dynamo_local_latest.tar.gz http://dynamodb-local.s3-website-us-west-2.amazonaws.com/dynamodb_local_latest.tar.gz && tar xzvf dynamo_local_latest.tar.gz

EXPOSE 8000

ENTRYPOINT ["java", "-Djava.library.path=./DynamoDBLocal_lib", "-jar", "DynamoDBLocal.jar", "-inMemory", "-sharedDb"]
