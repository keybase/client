//
//  KBDeviceAppView.h
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBDevicesAppView : YOView

@property KBRPClient * client;

- (void)refresh;

@end
