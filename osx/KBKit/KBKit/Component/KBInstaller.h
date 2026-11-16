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

- (void)installWithEnvironment:(KBEnvironment *)environment completion:(KBCompletion)completion;

@end
