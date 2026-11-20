//
//  KBComponentStatus.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"
#import "KBRModels.h"

NSString *NSStringFromKBRInstallStatus(KBRInstallStatus status);

@interface KBComponentStatus : NSObject

@property (readonly) NSError *error;
@property (readonly) KBRInstallStatus installStatus;
@property (readonly) KBRInstallAction installAction;
// "Key: value" lines, in display order.
@property (readonly, copy) NSArray<NSString *> *info;

+ (instancetype)componentStatusWithInstallStatus:(KBRInstallStatus)installStatus installAction:(KBRInstallAction)installAction info:(NSArray<NSString *> *)info error:(NSError *)error;

+ (instancetype)componentStatusWithError:(NSError *)error;

- (BOOL)needsInstallOrUpgrade;

- (NSString *)statusDescription:(NSString *)delimeter;

@end
