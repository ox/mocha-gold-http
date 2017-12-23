# Mocha Gold HTTP

This plugin enables golding of responses with configurable refresh times to enable offline testing
of remote resources. The golds will be written to disk and are meant to be kept in your source tree.

## Usage

`mocha-gold-http`'s [tests](glob/master/test) demonstrate how to use the plugin.

```js
const Golder = require('mocha-gold-http');
const sinon = require('sinon');
const request = require('request-promise');

// sandbox is optional; can use `sinon` itself since the methods called are the same
const sandbox = sinon.createSandbox(sinon.defaultConfig);

describe('some test', function () {
  const opts = {
    name: 'some test',
    routes: {
      homepage: {
        url: 'https://www.google.com',
        refresh: 'weekly',
      },
    },
  };
  const golder = new Golder(opts);

  beforeEach(() => {
    return golder.gold()
      .then(() => golder.mockRequest(sandbox, request));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('can fetch remote pages', function () {
    return request.get(opts.routes.homepage.url)
      .then((response) => {
        // test the response as if you made a network call
      });
  });
})

```