//
//  Settings.h
//  Keybase
//
//  Created by Gabriel on 1/11/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBEnvironment.h>
#import <GBCli/GBCli.h>

@interface Settings : NSObject

@property (readonly) NSString *appPath;
@property (readonly) NSString *runMode;

- (instancetype)initWithSettings:(GBSettings *)settings;

- (KBEnvironment *)environment;

@end
