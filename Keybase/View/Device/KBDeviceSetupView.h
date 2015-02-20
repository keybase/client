//
//  KBDeviceSetupView.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBDeviceSignerView.h"
#import "KBDeviceSignerOption.h"

@interface KBDeviceSetupView : YONSView

@property KBDeviceSignerView *deviceSignerView;
@property KBButton *selectButton;
@property KBButton *cancelButton;

- (void)setDevices:(NSArray *)devices hasPGP:(BOOL)hasPGP;

@end
