/**
 * Receives webhook notifications from Travis CI (ideally at the end of the build only), retrieves
 * the build logs and sends them to Papertrail.
 *
 * @author Tim Malone <tdmalone@gmail.com>
 */

'use strict';

const logStream = require( 'travis-log-stream' ),
      winston = require( 'winston' ),
      papertrailTransport = require( 'winston-papertrail' ).Papertrail;

/* eslint-disable no-process-env */
const PAPERTRAIL_HOST = process.env.PAPERTRAIL_HOST,
      PAPERTRAIL_PORT = process.env.PAPERTRAIL_PORT,
      TRAVIS_API_TOKEN = process.env.TRAVIS_API_TOKEN;
/* eslint-enable no-process-env */

exports.handler = ( event, context, callback ) => {

  // @see https://docs.travis-ci.com/user/notifications/#Webhooks-Delivery-Format
  const TRAVIS_JOB = event.payload.id,
        TRAVIS_REPO = event.payload.repository.name;

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
      const response = 'Logged ' + loggedLines + ' lines to Papertrail.';
      console.info( response );
      callback( null, response );
      return;
    }

    const dataString = data.toString();

    log.info( dataString );
    loggedLines += dataString.split( '\n' ).length;

  }); // Travis readable.
}; // Exports.handler.
