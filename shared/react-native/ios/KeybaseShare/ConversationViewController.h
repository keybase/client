//
//  ConversationViewController.h
//  KeybaseShare
//
//  Created by Michael Maxim on 8/31/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import <UIKit/UIKit.h>

@protocol ConversationViewDelegate<NSObject>
-(void)convSelected:(NSDictionary*)conv;
-(void)inboxLoadFailed;
@end

@interface ConversationViewController : UITableViewController <UISearchResultsUpdating>
@property UIViewController<ConversationViewDelegate> *delegate;
@end
