//
//  KBInstallStatusAppView.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBEnvironment.h"
#import "KBInstallStatusView.h"

@interface KBInstallStatusAppView : KBInstallStatusView

@property (copy) dispatch_block_t completion;

@end
