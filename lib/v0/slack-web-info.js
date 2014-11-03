// SlackWebInfo

var P, S,
    request  = require( 'request' ),
    entities = new ( require( 'html-entities' ).AllHtmlEntities )();


//##### SlackWebInfo class

P = ( SlackWebInfo = S = function( logonData ) {
  
    this.logonData = logonData;
    this.connected = false;
    this.cookieJar = request.jar();
    
} ).prototype; {

    P.Static = S;

    S.slackProtocol  = 'https://';
    S.slackDomain    = '.slack.com';

    S.slackPath = '/messages/general';

    S.slackParseInfoRegex = /(?=boot_data\.login_data\s*=\s*(\{[\s\S]*?\});)/ ;

    S.INDEX = {
        unique : 1,
        multi  : 2,
    }

    S.usersIndexes = {
        id         : S.INDEX.unique,
        name       : S.INDEX.unique,
        first_name : S.INDEX.multi,
        last_name  : S.INDEX.multi,
        real_name  : S.INDEX.unique,
        title      : S.INDEX.multi,
        email      : S.INDEX.unique,
        deleted    : S.INDEX.multi,    // true, false
        skype      : S.INDEX.unique,
        phone      : S.INDEX.unique,
        tz         : S.INDEX.multi,    // f.x. 'Europe/Amsterdam'
        tz_offset  : S.INDEX.multi,    // f.x. 7200
        is_bot     : S.INDEX.multi,    // true, false
        presence   : S.INDEX.multi,    // 'active', 'away'
    };

    S.usersSubFields = {
        email        : 'profile',
        title        : 'profile',
        first_name   : 'profile',
        last_name    : 'profile',
        real_name    : 'profile',
    };

    S.httpError = function( err, res, action ) {
        if ( err || res.statusCode >= 400 )
            return console.error( action + ':', err ? err.message : ( 'Server returned status code ' + res.statusCode ) ), true;    
    }

    P.getSlackUrl = function() {
        return this.Static.slackProtocol + this.logonData.company + this.Static.slackDomain;
    }

    P.connect = function( done ) {
        var
            me = this,
            slackUrl = me.getSlackUrl();
        
        request( { url: slackUrl, jar: me.cookieJar, followRedirect: true, followAllRedirects: true }, function( err, res, body ) {
            var error = me.Static.httpError( err, res, 'Unable to acquire the crumb' );
            if ( error ) return done( error );
        
            var
                signup = HtmlParser.getForm( body, 'action', '/' ),
                crumb = signup && HtmlParser.getInputValue( signup, 'crumb' ),
                form = crumb && {
                    signin   : '1',
                    redir    : me.Static.slackPath,
                    crumb    : crumb,
                    email    : me.logonData.email,
                    password : me.logonData.password,
                    remember : 'on',
                };
                
            if ( !form )
                return done( 'Unable to parse the `crumb`.' );

            request.post( { url: slackUrl, form: form, jar: me.cookieJar, followRedirect: true, followAllRedirects: true }, function( err, res, body ) {
                var error = me.Static.httpError( err, res, 'Unable to send the logon data' );
                if ( error ) return done( error );

                me.updateStatusFrom( body.toString(), function( error ) {
                    me.connected = !error;
                    done( error );
                } );
            } );
        } );
    }

    P.refresh = function( done ) {
        var me = this;

        if ( !me.connected )
            return me.connect( done );

        var slackUrl = me.getSlackUrl();
        
        request( { url: slackUrl + me.Static.slackPath, jar: me.cookieJar, followRedirect: true, followAllRedirects: true }, function( err, res, body ) {
            var error = me.Static.httpError( err, res, 'Unable to refresh the status' );
            if ( error ) return done( error );

            me.updateStatusFrom( body.toString(), function( error ) {
                if ( error ) {
                    me.connected = false;
                    me.connect( done );
                } else
                    done();
            } );
        } );
    }

    P.updateStatusFrom = function( body, done ) {
        var me = this;

        me.lastUpdate = new Date() - 0;

        var inMatch = body.match( me.Static.slackParseInfoRegex );
        if ( !inMatch )
            return done( 'Unable to parse Slack status information. Logon data may be invalid.' );

        var status;
        
        try {
            me.infoAll = status = JSON.parse( inMatch[ 1 ] );
        } catch( exception ) {
            return done( 'Exception: ' + exception.message );
        }

        var i, one, all, by, byIdx, oneField, byArray,
            idxKey, idxType, idxAll, subFields, subField,
            INDEX = me.Static.INDEX;

        me.infoBy = { };

        // index users
        all = status.users;
        me.infoBy.users = by = { };
        idxAll    = me.Static.usersIndexes;
        subFields = me.Static.usersSubFields;

        for ( idxKey in idxAll ) {
            by[ idxKey ] = { };
        }
        
        for ( i in all ) {
            one = all[ i ];
            
            for ( idxKey in idxAll ) {
                idxType  = idxAll[ idxKey ];
                byIdx    = by[ idxKey ];
                subField = subFields[ idxKey ];
                
                if ( subField )
                    oneField = one[ subField ] [ idxKey ];
                else
                    oneField = one[ idxKey ];
                
                switch( idxType ) {
                  
                    case INDEX.unique:
                    
                        byIdx [ oneField ] = one;
                        break;

                    case INDEX.multi:
                    
                        byArray = byIdx[ oneField ];
                        if ( !byArray )
                            byIdx[ oneField ] = byArray = [ ];

                        byArray.push( one );
                        break;
                }
            }
        }

        done();
    }

    P.update = function( done ) {
        var
            me = this,
            now = new Date() - 0;

        if ( me.lastUpdate && now - me.lastUpdate < ( me.logonData.cacheTime || 60000 ) )
            done();
        else {
            if ( me.refreshing )
                me.refreshing.push( done );
            else {
                me.refreshing = [ done ];
                me.refresh( function( error ) {
                    var i, all = me.refreshing;
                    me.refreshing = null;
                    
                    for ( i in all ) ( function( callback ) {
                        setImmediate( function() {
                            callback ( error );
                        } );
                    } ) ( all[ i ] );
                } );
            }
        }
    }

    P.getInfo = function( info, done ) {
        var me = this;

        me.update( function( error ) {
            if (error)
                return done( error, null );

            var subItem, obj = me.infoBy;

            while (( subItem = info.shift() )) {
                obj = obj[ subItem ];
                if ( !obj )
                    return done( null, null );
            }

            return done( null, obj );
        } );
    }

}

module.exports = SlackWebInfo;



//***** HELPERS

//##### RegExp advanced functions
{
    if ( !RegExp.escape ) RegExp.escape = function(s) {
        return s.replace( /[-\"\'\/\\^$*+?.()|[\]{}]/g, '\\$&' );
    };


    if ( !RegExp.ignoreCase ) RegExp.ignoreCase = function(s) {
        var i, a = s.split( '' ), r = '', up, lo;
        for ( i in a ) {
            up = a[i].toUpperCase();
            lo = a[i].toLowerCase();
            if ( up == lo )
                r += lo;
            else
                r += '[' +
                    RegExp.escape( lo ) +
                    RegExp.escape( up ) +
                ']';
        }
        return r;
    };
}


//##### Html Form/Input Parser

var HtmlParser = {

    tags : {
        ciForm  : RegExp.ignoreCase( 'form' ),
        ciInput : RegExp.ignoreCase( 'input' ),
        ciName  : RegExp.ignoreCase( 'name' ),
        ciValue : RegExp.ignoreCase( 'value' ),
    },    
  
    getForm : function( html, attr, value ) {
        var
            inMatch = html.match( new RegExp(
               '<' +
               this.tags.ciForm +
               '(?=[^>]*?\\s' +
               RegExp.ignoreCase( RegExp.escape( attr ) ) +
               '=([`\'"]?)' +
               RegExp.escape( value ) +
               '\\1[\\s>])[^>]*>[\\s\\S]*?<\\/' +
               this.tags.ciForm +
               '>'
            ) );
        return inMatch && inMatch [ 0 ];
    },

    getInputValue : function( form, name ) {
        var inMatch = form.match( new RegExp(
            '(?=<' +
            this.tags.ciInput +
            '\\s(?=[^>]*?\\s' +
            this.tags.ciName +
            '=([`\'"]?)' +
            RegExp.escape( name ) +
            '\\1[\\s>])(?=[^>]*?\\s' +
            this.tags.ciValue +
            '=([`\'"]?)([\\s\\S]*?)\\2[\\s>])[^>]*>)'
        ) );
        return inMatch && entities.decode( inMatch [ 3 ] );
    },
}
