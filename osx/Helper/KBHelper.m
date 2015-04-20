//
//  KBHelper.m
//  Keybase
//
//  Created by Gabriel on 4/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelper.h"

#include <syslog.h>
#include <xpc/xpc.h>
#import <MPMessagePack/MPMessagePack.h>
#import <IOKit/kext/KextManager.h>

@interface KBHelper () <NSXPCListenerDelegate>
@property xpc_connection_t connection;
@end

@implementation KBHelper

- (void)listen:(xpc_connection_t)service {
  xpc_connection_set_event_handler(service, ^(xpc_object_t connection) {

    [self log:@"Setting connection event handler."];
    xpc_connection_set_event_handler(connection, ^(xpc_object_t event) {

      [self log:[NSString stringWithFormat:@"Received event: %@", event]];

      xpc_type_t type = xpc_get_type(event);

      if (type == XPC_TYPE_ERROR) {
        if (event == XPC_ERROR_CONNECTION_INVALID) {
          // The client process on the other end of the connection has either
          // crashed or cancelled the connection. After receiving this error,
          // the connection is in an invalid state, and you do not need to
          // call xpc_connection_cancel(). Just tear down any associated state
          // here.
        } else if (event == XPC_ERROR_TERMINATION_IMMINENT) {
          // Handle per-connection termination cleanup.
        }

      } else {
        xpc_connection_t remote = xpc_dictionary_get_remote_connection(event);

        size_t length = 0;
        const void *buffer = xpc_dictionary_get_data(event, "data", &length);
        NSData *dataRequest = [NSData dataWithBytes:buffer length:length];

        NSError *error = nil;
        NSDictionary *request = [dataRequest mp_dict:&error];

        if (error) {
          xpc_object_t reply = xpc_dictionary_create_reply(event);
          xpc_dictionary_set_string(reply, "error", [[error localizedDescription] UTF8String]);
          xpc_connection_send_message(remote, reply);
        } else {
          [self handleRequest:request completion:^(NSDictionary *response) {
            xpc_object_t reply = xpc_dictionary_create_reply(event);
            NSData *dataResponse = [response mp_messagePack];
            xpc_dictionary_set_data(reply, "data", [dataResponse bytes], [dataResponse length]);
            xpc_connection_send_message(remote, reply);
          }];
        }
      }
    });

    xpc_connection_resume(connection);
  });

  xpc_connection_resume(service);
}

- (void)handleRequest:(NSDictionary *)request completion:(void (^)(NSDictionary *response))completion {
  completion(request); // Echo
}

- (void)log:(NSString *)message {
  NSLog(@"%@", message);
  syslog(LOG_NOTICE, "%s", [message UTF8String]);
}

@end
