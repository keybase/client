//
//  KBKeyGenViewController.m
//  Keybase
//
//  Created by Gabriel on 12/23/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBKeyGenViewController.h"

#import "KBDefines.h"

@interface KBKeyGenViewController ()
@property IBOutlet NSButton *selectButton;
@end

@implementation KBKeyGenViewController

- (void)awakeFromNib {
  [KBOLookAndFeel applyLinkStyle:self.selectButton];
}

@end
