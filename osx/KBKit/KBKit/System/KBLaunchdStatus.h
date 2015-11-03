//
//  KBLaunchdStatus.h
//  Keybase
//
//  Created by Gabriel on 5/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBLaunchdStatus : NSObject

@property (readonly) NSString *label;
@property (readonly) NSNumber *pid;
@property (readonly) NSNumber *lastExitStatus;
@property (readonly) NSError *error;

+ (instancetype)error:(NSError *)error;
+ (instancetype)serviceStatusWithPid:(NSNumber *)pid lastExitStatus:(NSNumber *)lastExitStatus label:(NSString *)label;

- (NSString *)info;

- (BOOL)isRunning;

@end
