const sinon = require('sinon');
const assert = require('assert');
const request = require('request-promise');
const path = require('path');
const fs = require('fs');
const fakeFs = require('./util-fake-fs');
const Golder = require('../src/golder');

describe('Golder', () => {
  const sandbox = sinon.createSandbox(sinon.defaultConfig);
  const expectedResponse = {
    statusCode: 200,
    body: 'test-body',
    headers: {},
    request: {},
  };
  const expectedResponseString = JSON.stringify(expectedResponse, null, 2);
  let golder;
  let homepagePath;

  beforeEach(() => {
    fakeFs.init(sandbox, fs);
    sandbox.stub(request, 'get').resolves(expectedResponse);
  });

  beforeEach(() => {
    const opts = {
      name: 'homepage tests',
      routes: {
        homepage: {
          url: 'https://www.google.com/',
          refresh: 'weekly',
        },
      },
    };

    golder = new Golder(opts);
    homepagePath = path.join(golder.folderPath, 'homepage.html');
  });

  afterEach(() => {
    fakeFs.restore();
    sandbox.restore();
  });

  describe('init', () => {
    it('requires a golder name', () => {
      assert.throws(() => new Golder({}), Error);
    });

    it('can detect a bad refresh rate', () => {
      assert.throws(
        () => new Golder({ name: 'foo', routes: { foo: { refresh: 'not a real rate' } } }),
        /refresh rate/,
      );
    });

    it('makes a urlToFile mapping', () => {
      const expectedFileRoute = path.join(__dirname, 'golds', 'homepage-tests', 'homepage.html');
      assert.equal(golder.urlToFile[golder.routes.homepage.url], expectedFileRoute);
    });
  });

  describe('golding', () => {
    it('generates the right gold folder name', () => {
      const expectedFolderName = 'homepage-tests';
      const expectedFolderRoute = path.join(__dirname, 'golds', expectedFolderName);
      assert.equal(golder.folderName, expectedFolderName);
      assert.equal(golder.folderPath, expectedFolderRoute);
    });

    it('creates the right gold folders', () => {
      assert(fs.existsSync(golder.folderPath), `${golder.folderPath} was not created`);
    });

    describe('routes', () => {
      it('golds routes correctly', () => {
        return golder.gold()
          .then(() => {
            assert(fs.existsSync(homepagePath), `${homepagePath} was not created`);
            assert(fs.readFileSync(homepagePath), expectedResponseString);
          });
      });

      it('uses golds if they exist', () => {
        return golder.gold()
          .then(() => golder.gold())
          .then(() => {
            sinon.assert.calledOnce(request.get);
            sinon.assert.calledThrice(fs.existsSync);
            assert(fs.existsSync.firstCall.returned(false));
            assert(fs.existsSync.secondCall.returned(false));
            assert(fs.existsSync.thirdCall.returned(true));
          });
      });

      it('regolds if files are beyond the refresh rate', () => {
        return golder.gold()
          .then(() => {
            fs.utimesSync(homepagePath, 1, 1);
            return golder.gold();
          })
          .then(() => {
            sinon.assert.calledTwice(request.get);
          });
      });

      it('does not regold if the files are fresh enough', () => {
        return golder.gold()
          .then(() => {
            // This is less than the 'weekly' refresh rate
            const old = (new Date()) - 604400000;
            fs.utimesSync(homepagePath, old, old);
            return golder.gold();
          })
          .then(() => {
            sinon.assert.calledOnce(request.get);
          });
      });

      it('warns when a regold is necessary but there is a network issue', () => {
        return golder.gold()
          .then(() => {
            fs.utimesSync(homepagePath, 1, 1);
            request.get.callsFake(() => Promise.resolve({ statusCode: 500 }));
            fs.writeFileSync.reset();
            return golder.gold();
          })
          .then(() => {
            sinon.assert.notCalled(fs.writeFileSync);
            // ensure that the file body was not changed
            assert.equal(fs.readFileSync(homepagePath), expectedResponseString);
          });
      });

      it('throws when cannot gold fist time', () => {
        request.get.resolves({ statusCode: 500 });
        return golder.gold()
          .then(() => assert.fail('golding should have failed'))
          .catch(err => assert(err.message.includes('cannot gold')));
      });
    });
  });

  describe('server', () => {
    it('makes a request mock server', () => {
      return golder.gold()
        .then(() => {
          // restore this request to be able to test the mocking
          request.get.restore();
          golder.mockRequest(sandbox, request);

          // requesting the url should return the contents of the golded response
          const ret = request.get(golder.routes.homepage.url);
          assert(ret.then);
          return ret;
        })
        .then((response) => {
          sinon.assert.calledOnce(fs.readFileSync);
          assert.equal(response, expectedResponse.body, 'unexpected response body recorded');
        });
    });

    it('mocks simple request object params', () => {
      return golder.gold()
        .then(() => {
          // restore this request to be able to test the mocking
          request.get.restore();
          golder.mockRequest(sandbox, request);

          return request.get({ uri: golder.routes.homepage.url });
        })
        .then((response) => {
          sinon.assert.calledOnce(fs.readFileSync);
          assert.equal(response, expectedResponse.body, 'unexpected response body recorded');
        });
    });

    it('mocks full request object params', () => {
      return golder.gold()
        .then(() => {
          // restore this request to be able to test the mocking
          request.get.restore();
          golder.mockRequest(sandbox, request);

          return request.get({
            uri: golder.routes.homepage.url,
            resolveWithFullResponse: true,
          });
        })
        .then((response) => {
          sinon.assert.calledOnce(fs.readFileSync);
          assert.deepEqual(response, expectedResponse, 'unexpected response recorded');
        });
    });
  });
});
