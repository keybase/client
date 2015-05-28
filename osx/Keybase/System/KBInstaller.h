//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBEnvironment.h"


@interface KBInstaller : NSObject

@property (readonly) KBEnvironment *environment;

- (instancetype)initWithEnvironment:(KBEnvironment *)environment;

- (void)install:(dispatch_block_t)completion;

@end
