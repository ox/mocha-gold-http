const sinon = require('sinon');
const assert = require('assert');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const fakeFs = require('./util-fake-fs');
const Golder = require('../src/golder');

describe('Golder', function () {
  const sandbox = sinon.createSandbox(sinon.defaultConfig);
  const expectedResponse = {
    status: 200,
    data: 'test-body',
    headers: {},
    request: {},
  };
  const expectedResponseString = JSON.stringify(expectedResponse, null, 2);
  const homepageUrl = 'http://duckduckgo.com/robots.txt';
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
    sandbox.stub(axios, 'get').resolves(expectedResponse);
    golder = new Golder(opts);
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
      this.timeout(20000);
      return axios.get(homepageUrl)
        .then((response) => {
          sinon.assert.calledOnce(fs.existsSync);
          sinon.assert.calledOnce(fs.writeFileSync);
          assert.equal(response, expectedResponse.body, 'unexpected response body recorded');

          fs.writeFileSync.reset();
          // get the same route again an ensure that the gold is used
          return axios.get(homepageUrl);
        })
        .then(() => {
          sinon.assert.notCalled(fs.writeFileSync);
          sinon.assert.calledOnce(fs.readFileSync);
        });
    });

    it('regolds when necessary', function () {
      this.timeout(20000);
      const {filePath} = golder.urlToRoute[homepageUrl];
      return axios.get(homepageUrl)
        .then(() => {
          fs.utimesSync(filePath, 1, 1);
          return axios.get(homepageUrl);
        })
        .then(() => {
          sinon.assert.calledTwice(fs.writeFileSync);
          sinon.assert.notCalled(fs.readFileSync);
        });
    });

    it('does not gold when gold is fresh enough', function () {
      this.timeout(20000);
      const {filePath} = golder.urlToRoute[homepageUrl];
      return axios.get(homepageUrl)
        .then(() => {
          const freshEnough = (new Date()) - 604400000;
          fs.utimesSync(filePath, freshEnough, freshEnough);
          return axios.get(homepageUrl);
        })
        .then(() => {
          sinon.assert.calledOnce(fs.writeFileSync);
          sinon.assert.calledOnce(fs.readFileSync);
        });
    });

    it('does not gold when upstream status changes', function () {
      this.timeout(20000);
      return axios.get(homepageUrl)
        .then(() => {
          sandbox.stub(golder.axios, 'get').resolves({status: 500});
          return axios.get(homepageUrl);
        })
        .then(() => {
          sinon.assert.calledOnce(golder.writeGold);
          sinon.assert.calledOnce(golder.readGold);
        });
    });
  });
});
