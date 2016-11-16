//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBEnvironment.h"

@interface KBInstaller : NSObject

- (void)refreshStatusWithEnvironment:(KBEnvironment *)environment completion:(dispatch_block_t)completion;

- (void)installWithEnvironment:(KBEnvironment *)environment force:(BOOL)force stopOnError:(BOOL)stopOnError completion:(void (^)(NSError *error, NSArray *installables))completion;
- (void)uninstallWithEnvironment:(KBEnvironment *)environment completion:(dispatch_block_t)completion;

+ (void)setLoginItemEnabled:(BOOL)loginItemEnabled config:(KBEnvConfig *)config appPath:(NSString *)appPath;

@end
