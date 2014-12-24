//
//  KBLoginViewController.m
//  Keybase
//
//  Created by Gabriel on 12/23/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBLoginViewController.h"

#import "KBRPC.h"
#import "AppDelegate.h"
#import "KBSignupViewController.h"

@interface KBLoginViewController ()
@property (weak) IBOutlet NSTextField *emailField;
@property (weak) IBOutlet NSTextField *passphraseField;
@end

@implementation KBLoginViewController

- (IBAction)login:(id)sender {
  
}

- (IBAction)signup:(id)sender {
  KBSignupViewController *signUpViewController = [[KBSignupViewController alloc] initWithNibName:@"KBLogin" bundle:nil];
  [self.navigationController pushViewController:signUpViewController animated:YES];

}

@end

