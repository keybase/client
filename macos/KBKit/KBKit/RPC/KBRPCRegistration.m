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

- (void)registerMethod:(NSString *)method requestHandler:(MPRequestHandler)requestHandler {
  if (!_registrations) _registrations = [NSMapTable strongToStrongObjectsMapTable];

  NSAssert(![_registrations objectForKey:method], @"Method already registered");

  NSMapTable *registration = [NSMapTable strongToStrongObjectsMapTable];
  [registration setObject:requestHandler forKey:@"requestHandler"];

  [_registrations setObject:registration forKey:method];
}

@end
