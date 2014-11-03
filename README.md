Slack Web Info
==============

Slack bulk information provider high-scalable NodeJS module

This is official code repository of this project.

## Project Official Website

http://prywit.com/projects/slack-web-info/

# Installation

$ `npm i slack-web-info`

# Quick Usage

```javascript
var  SlackWebInfo = require( 'slack-web-info' );

var config = {
    company   : 'mycompany',     // use 'http://mycompany.slack.com/` entry 
    email     : 'some.bot.account@mycompany.tld',  // logon data
    password  : 'bot-password',
    cacheTime : 2 * 60 * 1000,   // cache information for 2 minutes
};

var slackInfo = new SlackWebInfo( config );


slackInfo.getInfo( [ 'users', 'presence', 'active' ], function( err, info ) {

    if ( info ) {
        console.log(
            'Full names of users with "online" status:',
            info.map( function( user ) { return user.profile.real_name; }
        )
    } else
        console.log( 'No users with "online" status found' );
} )


slackInfo.getInfo( [ 'users', 'real_name', 'John Smith' ], function( err, info ) {

    if ( info ) {
        console.log(
            'Is John Smith "online"?',
            info.presence == 'active' ? 'Yes' : 'No'
        )
    } else
        console.log( 'John Smith is not found' );
} )


slackInfo.getInfo( [ 'users', 'email', 'johnsmith@mycompany.tld' ], function( err, info ) {

    if ( info ) {
        console.log( 'Data of user with email: johnsmith@mycompany.tld' );
        console.log( '  Phone:', info.profile.phone || 'Not Specified' );
        console.log( '  Time Zone:', info.tz );
    } else
        console.log( 'User with email: johnsmith@mycompany.tld not found' );
} )


slackInfo.getInfo( [ 'users' ], function( err, info ) {

    if ( !err ) {
        var
            humans   = users.is_bot.false,
            nHumans  = humans ? humans.length : 0,
            
            bots     = users.is_bot.true,
            nBots    = bots ? bots.length : 0;
            
        console.log(
            'Employees:',
            info.presence.active.length - nBots, 'online from',
            nHumans, 'total'
        )
    } else
        console.log( 'Error:', err );
} )

```
