/**
 * Receives webhook notifications from Travis CI (ideally at the end of the build only), retrieves
 * the build logs and sends them to Papertrail.
 *
 * @author Tim Malone <tdmalone@gmail.com>
 */

'use strict';

const logStream = require( 'travis-log-stream' ),
      winston = require( 'winston' ),
      papertrailTransport = require( 'winston-papertrail' ).Papertrail,
      lambdaProxyResponse = require( '@tdmalone/lambda-proxy-response' );

/* eslint-disable no-process-env */
const PAPERTRAIL_HOST = process.env.PAPERTRAIL_HOST,
      PAPERTRAIL_PORT = process.env.PAPERTRAIL_PORT,
      TRAVIS_API_TOKEN = process.env.TRAVIS_API_TOKEN,
      CI = process.env.CI;
/* eslint-enable no-process-env */

exports.handler = ( event, context, callback ) => {

  if ( ! PAPERTRAIL_HOST || ! PAPERTRAIL_PORT || ! TRAVIS_API_TOKEN ) {
    const message = 'Please ensure PAPERTRAIL_HOST, PAPERTRAIL_PORT and TRAVIS_API_TOKEN are defined.';
    lambdaProxyResponse( message, null, callback );
    return;
  }

  if ( ! event.body ) {
    lambdaProxyResponse( 'Invalid payload: missing or empty body.', null, callback );
    return;
  }

  let payload;

  try {
    payload = JSON.parse( event.body );
  } catch ( error ) {
    lambdaProxyResponse( error, null, callback );
    return;
  }

  // @see https://docs.travis-ci.com/user/notifications/#Webhooks-Delivery-Format
  const TRAVIS_JOB = payload.id,
        TRAVIS_REPO = payload.repository ? payload.repository.name : '';

  if ( ! TRAVIS_JOB || ! TRAVIS_REPO ) {
    lambdaProxyResponse( 'Invalid payload: missing job ID or repository name.', null, callback );
    return;
  }

  console.log( 'Spinning up...' );

  const log = new winston.Logger({
    transports: []
  });

  log.add( papertrailTransport, {

    host:         PAPERTRAIL_HOST,
    port:         PAPERTRAIL_PORT,
    hostname:     'travis-ci',
    program:      TRAVIS_REPO,
    flushOnClose: true,

    logFormat: ( level, message ) => {
      return message;
    }

  });

  const travis = logStream({
    jobId:  TRAVIS_JOB,
    appKey: TRAVIS_API_TOKEN
  });

  let loggedLines = 0;

  travis.on( 'readable', () => {

    const data = travis.read();

    if ( ! data ) {
      log.close();
      lambdaProxyResponse( null, 'Logged ' + loggedLines + ' lines to Papertrail.', callback );
      return;
    }

    let dataString = data.toString();

    // If testing, log the last line only.
    if ( CI ) {
      dataString = dataString.trim().split( '\n' ).pop();
    }

    log.info( dataString );

    loggedLines += dataString.split( '\n' ).length;

  }); // Travis readable.

}; // Exports.handler.
