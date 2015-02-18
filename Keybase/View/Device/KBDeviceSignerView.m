//
//  KBDeviceSignerView.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceSignerView.h"

#import "KBImageTextView.h"
#import "KBRPC.h"
#import "KBDeviceSignerOption.h"

@interface KBDeviceSignerView ()
@end

@implementation KBDeviceSignerView

- (void)viewInit {
  [super viewInit];
  self.prototypeClass = KBImageTextView.class;
}

- (void)setDeviceSignerOptions:(NSArray *)deviceSignerOptions {
  [self setObjects:deviceSignerOptions];
}

- (void)updateView:(KBImageTextView *)view object:(KBDeviceSignerOption *)object {
  [view setTitle:object.title description:object.info imageSource:object.imageSource];
}

- (void)select:(id)option {

}

@end
