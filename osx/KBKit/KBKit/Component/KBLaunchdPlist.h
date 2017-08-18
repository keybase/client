//
//  KBLaunchdPlist.h
//  Keybase
//
//  Created by Gabriel on 10/26/15.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBLaunchdPlist : NSObject

- (instancetype)initWithLabel:(NSString *)label binPath:(NSString *)binPath runtimeDir:(NSString *)runtimeDir logPath:(NSString *)logPath args:(NSArray *)args;

- (NSDictionary *)plistDictionary;

@end
