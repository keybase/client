//
//  KBDeviceView.h
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBDeviceView : KBImageTextView

- (void)setDevice:(KBRDevice *)device;

@end


@interface KBDeviceCell : KBDeviceView
@end