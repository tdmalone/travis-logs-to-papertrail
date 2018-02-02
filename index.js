/**
 *
 * @author Tim Malone <tdmalone@gmail.com>
 */

'use strict';

const logStream = require( 'travis-log-stream' ),
      winston = require( 'winston' ),
      papertrailTransport = require( 'winston-papertrail' ).Papertrail;

const PAPERTRAIL_HOST = process.env.PAPERTRAIL_HOST,
      PAPERTRAIL_PORT = process.env.PAPERTRAIL_PORT,
      TRAVIS_REPO = 'test-repo',
      TRAVIS_JOB = '229631523',
      TRAVIS_KEY = '5df8ac576dcccf4fd076';

exports.handler = ( event, context, callback ) => {

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
    appKey: TRAVIS_KEY
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
