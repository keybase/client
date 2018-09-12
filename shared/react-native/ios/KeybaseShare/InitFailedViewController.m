//
//  InitFailedViewController.m
//  KeybaseShare
//
//  Created by Michael Maxim on 9/10/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "InitFailedViewController.h"

@interface InitFailedViewController ()

@end

@implementation InitFailedViewController

- (void)viewDidLoad {
  [super viewDidLoad];
  
  UILabel* text = [[UILabel alloc] init];
  [text setText:@"Unable to initialize Keybase. Please open the main Keybase app and try again."];
  [text setTextAlignment:NSTextAlignmentCenter];
  [text setNumberOfLines:0];
  [text setTranslatesAutoresizingMaskIntoConstraints:NO];
  [self.navigationItem setHidesBackButton:YES];
  UIBarButtonItem* closeButton = [[UIBarButtonItem alloc] initWithTitle:@"Cancel" style:UIBarButtonItemStyleDone target:self action:@selector(onClosed)];
  [self.navigationItem setRightBarButtonItem:closeButton];
  
  // Stick this right in the center of the control
  [self.view addSubview:text];
  [self.view
   addConstraint:[NSLayoutConstraint constraintWithItem:text
                                              attribute:NSLayoutAttributeWidth
                                              relatedBy:NSLayoutRelationEqual
                                                 toItem:self.view
                                              attribute:NSLayoutAttributeWidth
                                             multiplier:1
                                               constant:0]];
  [self.view
   addConstraint:[NSLayoutConstraint constraintWithItem:text
                                              attribute:NSLayoutAttributeCenterY
                                              relatedBy:NSLayoutRelationEqual
                                                 toItem:self.view
                                              attribute:NSLayoutAttributeCenterY
                                             multiplier:1
                                               constant:0]];
}
                          
- (void)onClosed {
  [self.delegate initFailedClosed];
}

@end
