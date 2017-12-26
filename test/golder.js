const sinon = require('sinon');
const assert = require('assert');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const fakeFs = require('./util-fake-fs');
const Golder = require('../src/golder');

describe('Golder', function () {
  const sandbox = sinon.createSandbox(sinon.defaultConfig);
  const homepageUrl = 'http://duckduckgo.com/robots.txt';
  const mockResponse = {
    status: 200,
    data: 'test-body',
    headers: {},
  };
  const opts = {
    name: 'homepage tests',
    routes: {
      homepage: {
        url: homepageUrl,
        refresh: 'weekly',
      },
    },
  };
  let golder;

  beforeEach(() => {
    fakeFs.init(sandbox, fs);
    golder = new Golder(opts);
    // stub the lib's axios instant to make sure it never actually makes requests
    sandbox.stub(golder.axios, 'get').resolves(mockResponse);
    sandbox.spy(golder, 'readGold');
    sandbox.spy(golder, 'writeGold');
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
        () => new Golder({name: 'foo', routes: {foo: {refresh: 'not a real rate'}}}),
        /refresh rate/,
      );
    });

    it('makes a urlToRoute mapping', () => {
      const expectedFileRoute = {
        filePath: path.join(__dirname, 'golds', 'homepage-tests', 'homepage.html'),
        opts: opts.routes.homepage,
      };
      assert.deepEqual(golder.urlToRoute[homepageUrl], expectedFileRoute);
    });
  });

  describe('gold parent folders', () => {
    it('generates the right gold folder name', () => {
      const expectedFolderName = 'homepage-tests';
      const expectedFolderRoute = path.join(__dirname, 'golds', expectedFolderName);
      assert.equal(golder.folderName, expectedFolderName);
      assert.equal(golder.folderPath, expectedFolderRoute);
    });

    it('creates the right gold folders', () => {
      assert(fs.existsSync(golder.folderPath), `${golder.folderPath} was not created`);
    });
  });

  describe('server', function () {
    beforeEach(() => {
      return golder.mockRequest(sandbox, axios);
    });

    it('makes a request mock server', function () {
      return axios.get(homepageUrl)
        .then((response) => {
          sinon.assert.calledOnce(golder.writeGold);
          assert.equal(response, mockResponse, 'unexpected response body recorded');
          // get the same route again an ensure that the gold is used
          golder.writeGold.reset();
          return axios.get(homepageUrl);
        })
        .then(() => {
          sinon.assert.notCalled(golder.writeGold);
        });
    });

    it('regolds when necessary', function () {
      const {filePath} = golder.urlToRoute[homepageUrl];
      return axios.get(homepageUrl)
        .then(() => {
          sinon.assert.calledOnce(golder.writeGold);
          fs.utimesSync(filePath, 1, 1);
          return axios.get(homepageUrl);
        })
        .then(() => {
          sinon.assert.calledTwice(golder.writeGold);
        });
    });

    it('does not gold when gold is fresh enough', function () {
      const {filePath} = golder.urlToRoute[homepageUrl];
      return axios.get(homepageUrl)
        .then(() => {
          const freshEnough = (new Date()) - 604400000;
          fs.utimesSync(filePath, freshEnough, freshEnough);
          return axios.get(homepageUrl);
        })
        .then(() => {
          sinon.assert.calledOnce(golder.readGold);
          sinon.assert.calledOnce(golder.writeGold);
        });
    });

    it('does not gold when upstream status changes', function () {
      return axios.get(homepageUrl)
        .then(() => {
          golder.axios.get.resolves({status: 500});
          return axios.get(homepageUrl);
        })
        .then(() => {
          sinon.assert.calledOnce(golder.writeGold);
        });
    });
  });
});
