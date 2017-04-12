//
//  KBDeviceSetupChooseView.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDeviceSignerOption.h"
#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBDeviceSetupChooseView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property KBListView *deviceSignerView;
@property KBButton *selectButton;
@property KBButton *cancelButton;

- (void)setDevices:(NSArray *)devices hasPGP:(BOOL)hasPGP;

@end
