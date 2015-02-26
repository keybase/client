//
//  KBRPCRegistration.m
//  Keybase
//
//  Created by Gabriel on 2/25/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRPCRegistration.h"

@interface KBRPCRegistration ()
@property NSMapTable *registrations;
@end

@implementation KBRPCRegistration

- (MPRequestHandler)requestHandlerForMethod:(NSString *)method {
  NSMapTable *registration = [self.registrations objectForKey:method];
  MPRequestHandler requestHandler = [registration objectForKey:@"requestHandler"];
  return requestHandler;
}

- (void)registerMethod:(NSString *)method owner:(id)owner requestHandler:(MPRequestHandler)requestHandler {
  if (!_registrations) _registrations = [NSMapTable strongToStrongObjectsMapTable];

  //GHDebug(@"Registering %@", method);
  //NSAssert(![_registrations objectForKey:method], @"Method already registered");

  NSMapTable *registration = [NSMapTable strongToStrongObjectsMapTable];
  [registration setObject:requestHandler forKey:@"requestHandler"];
  [registration setObject:owner forKey:@"owner"];

  [_registrations setObject:registration forKey:method];
}

- (void)unregister:(id)owner {
  NSArray *keys = [[_registrations dictionaryRepresentation] allKeys];
  for (NSString *method in keys) {
    NSMapTable *registration = [_registrations objectForKey:method];
    if ([[registration objectForKey:@"owner"] isEqualTo:owner]) {
      //GHDebug(@"Unregistering %@", method);
      [_registrations removeObjectForKey:method];
    }
  }
}


@end
