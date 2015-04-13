//
//  KBDeviceSetupPromptView.h
//  Keybase
//
//  Created by Gabriel on 3/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "KBAppKit.h"
#import "KBContentView.h"

typedef void (^KBDevicePromptCompletion)(id sender, NSError *error, NSString *deviceName);

@interface KBDeviceSetupPromptView : KBContentView

@property (copy) KBDevicePromptCompletion completion;

@property KBButton *cancelButton;

@end
