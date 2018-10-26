//
//  ShareViewController.h
//  KeybaseShare
//
//  Created by Michael Maxim on 8/31/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <Social/Social.h>
#import "ConversationViewController.h"
#import "FilesViewController.h"
#import "InitFailedViewController.h"

@interface ShareViewController : SLComposeServiceViewController <ConversationViewDelegate,FilesViewDelegate,InitFailedViewDelegate>

@end
