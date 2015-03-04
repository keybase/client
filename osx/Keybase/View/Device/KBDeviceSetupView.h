//
//  KBDeviceSetupView.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBDeviceSignerOption.h"
#import "KBContentView.h"

@interface KBDeviceSetupView : KBContentView

@property KBListView *deviceSignerView;
@property KBButton *selectButton;
@property KBButton *cancelButton;

- (void)setDevices:(NSArray *)devices hasPGP:(BOOL)hasPGP;

@end
