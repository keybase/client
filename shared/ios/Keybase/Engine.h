//
//  Engine.h
//  Keybase
//
//  Created by Chris Nojima on 8/28/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface Engine : NSObject
- (instancetype)initWithSettings:(NSDictionary *)settings error:(NSError **)error;
- (void)rpcToGo:(NSData *)data;
- (void)rpcToGoTEMP:(NSString *)data;
@end

@interface KeybaseEngine : RCTEventEmitter <RCTBridgeModule>
  + (BOOL)requiresMainQueueSetup;
@end
