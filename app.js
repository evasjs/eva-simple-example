/****************************************************
  > File Name    : app.js
  > Author       : Cole Smith
  > Mail         : tobewhatwewant@gmail.com
  > Github       : whatwewant
  > Created Time : Thu 08 Dec 2016 01:42:34 PM CST
 ****************************************************/
const Eva = require('eva-server');
const createUser = require('eva-server-plugin-user');
const createPlugin = require('eva-server-plugin-create-plugin');
const proxy = require('http-proxy-middleware');

function corsOptionsFn() {
    const whitelist = [
      'moeover.com',
      '127.0.0.1',
      'localhost',
      '172.16.14.211'
    ];
    let origin;

    return function (req, callback) {
      origin = req.header('Origin');
      // console.log(origin, whitelist.some(e => origin.indexOf(e) !== -1));
      if (!origin) {
        return callback(null, { origin: true });
      }

      if (whitelist.some(e => origin.indexOf(e) !== -1)) {
        callback(null, { origin: true });
      } else {
        callback(null, { origin: false });
      }
    };
}

const app = new Eva({
  server: {
    HOST: process.env.HOST || '0.0.0.0',
    PORT: process.env.PORT || 59438,
  },
  db: {
    NAME: 'eva_rest_api',
    ENGINE: 'mongodb',
    HOST: process.env.DB_HOST || 'localhost',
    PORT: 27017,
  },
  beforeRender() {
    console.log('before render');
    app.use(Raven.requestHandler());
  },
  afterRender() {
    console.log('after render');
    // app._instance.get('/trigger-error', function mainHandler(req, res) {
    //   throw new Error('Broke!');
    // });
    app.use(Raven.errorHandler());
    app.use(function onError(err, req, res, next) {
      // The error id is attached to `res.sentry` to be returned
      // and optionally displayed to the user for support.
        res.statusCode = 500;
        res.end(res.sentry + '\n');
    });
  },
  onError(err, req, res, next) {
    err.json = err.json || {};
    res.status(err.json.status || 400).json({
        errcode: err.json.errcode,
        errmsg: err.json.errmsg || err.message,
    });
  },
  options: {
    corsOptions: corsOptionsFn(), 
  },
});

app.register(createUser({
  jwt: {
    secretKey: process.env.JWT_KEY || 'need a secret',
    expiresIn: process.env.JWT_EXPIRESE_IN || '120 days',
  },
  payloads: ['_id', 'nickname'],
}));


app.register({
  namespace: 'proxy',
  routes: {
    '/github-trending/*': 'trending',
  },
  handlers: {
    trending(utils, { req, res, err }) {
      return proxy({
        target: 'https://trending-api-github.herokuapp.com',
        changeOrigin: true,
        pathRewrite: {
          '^/github-trending': '/api/repo',
        },
      })(req, res, err);
    },
  },
});


app.route = (...args) => app.register(createPlugin(...args));
app.run = app.start;

app.route('/webhooks/gitlab', 'webhooks_gitlab', {
    user: { type: String, origin: 'user_name', query: true },
    event: { type: String, origin: 'event_name' },
    hash: { type: String, origin: 'after' },
    branch: { type: String, origin: 'ref' },
    commits: { type: Array, show: false },
});

app.route('/webhooks/github', 'webhooks_github', {
    user: { type: String, origin: 'pusher' },
    before: { type: String },
    after: { type: String },
    commits: { type: Array },
    repository: { type: Object },
    sender: { type: Object },
}, [
  (req, res, next) => {
    console.log(req.body);
    next();
  }
]);

app.route('/collection/zhihu/question', 'zhihu_question', {
    zid: { type: String, unique: true },
    url: { type: String },
    title: { type: String, query: true },
});

app.route('/collection/zhihu/assay', 'zhihu_assay', {
    zid: { type: Number, unique: true, origin: 'slug' },
    title: { type: String, query: true },
    banner: { type: String, origin: 'titleImage' }, 
    url: { type: String },
    apiUrl: { type: String, origin: 'href' },
    summary: { type: String, query: true },
    topics: { type: Array },
    commentsCount: { type: Number },
    likesCount: { type: Number },
    author: { type: Object, query: true },
    publishedTime: { type: String },
    content: { type: String, query: true },
}, {
    rss: {
        on: true,
        site: {
            title: '知乎专栏文章(Eason)',
            description: '知乎专栏文章 来自 TaskService',
            link: 'http://moeover.com',
            rssLink: 'http://moeover.com/atom.xml',
        },
        transfer: {
            title: 'title',
            description: 'content',
            link: { origin: 'url', prefix: 'https://zhuanlan.zhihu.com' },
            guid: '_id',
            pubDate: 'publishedTime',
        },
    },
});

app.route('/collection/gold/article', 'gold_article', {
    oid: { type: String, unique: true, origin: 'objectId' },
    title: { type: String, query: true },
    type: { type: String, query: true },
    category: { type: String, query: true },
    url: { type: String },
    originUrl: { type: String },
    user: { type: Object },
    viewsCount: { type: Number },
    commentsCount: { type: Number },
    collectionCount: { type: Number },
    tags: { type: Object },
    tagsTitleArray: { type: Array },
    entryView: { type: Object },
    content: { type: String, query: true },
    screenshot: { type: Object },
    subscribers: { type: Object },
    subscribersCount: { type: Number },
    publishedTime: { type: String, origin: 'createdAt' },

    english: { type: Boolean },
    rankIndex: { type: Number },
    hotIndex: { type: Number },
    hot: { type: Boolean },
    gfw: { type: Boolean },
    original: { type: Boolean },
}, {
    rss: {
        on: true,
        site: {
            title: '掘金(Eason)',
            description: '自用掘金RSS',
            link: 'http://moeover.com',
            rssLink: 'http://moeover.com/atom.xml',
        },
        transfer: {
            title: 'title',
            description: 'content',
            link: 'url',
            guid: '_id',
            pubDate: 'publishedTime',
        },
    },
});

app.route('/collection/zcfy/article', 'zcfy_article', {
    url: { type: String, unique: true },
    title: { type: String, query: true },
    tags: { type: Array, query: true },
    author: { type: Object, query: true },
}, {
    rss: {
        on: true,
        transfer: {
            title: 'title',
            description: 'url',
            link: 'url',
            guid: '_id',
            pubDate: 'createdAt',
        },
        site: {
            title: '众城翻译(Eason)',
            description: '每天看看众城翻译',
            link: 'http://moeover.com',
            rssLink: 'https://moeover.com/atom.xml',
        },
    },
});

app.route('/reading-track', 'reading_track', {
    url: { type: String, unique: true, query: true },
    title: { type: String, query: true },
    tag: { type: Array, query: true },
});

app.route('/fuli', 'fuli', {
    name: { type: String, query: true },
    url: { type: String, unique: true },
    tag: { type: Array, query: true },
});

app.route('/bugs', 'bugs', {
    version: { type: String, query: true },
    level: { type: String, query: true },
    deviceId: { type: String, query: true },
    device: { type: Object, query: true },
    url: { type: String, query: true },
    title: { type: String, query: true },
    message: { type: String, query: true },
    tag: { type: Array, query: true },
    detail: { type: Object },
}, {
  many: {
    list: ['User:requireAuthorized'],
    create: ['User:requireAuthorized'],
  },
  one: {
    retrieve: ['User:requireAuthorized'],
    update: ['User:requireAuthorized'],
    delete: ['User:requireAuthorized'],
  },
});

app.route('/report', 'report-bugs', {
    version: { type: String, query: true },
    level: { type: String, query: true },
    deviceId: { type: String, query: true },
    device: { type: Object, query: true },
    url: { type: String, query: true },
    title: { type: String, query: true },
    message: { type: String, query: true },
    tag: { type: Array, query: true },
    detail: { type: Object },
}, {
  many: {
    list: ['User:requireAuthorized'],
    create: ['User:requireAuthorized'],
  },
  one: {
    retrieve: ['User:requireAuthorized'],
    update: ['User:requireAuthorized'],
    delete: ['User:requireAuthorized'],
  },
});

app.route('/analysis', 'analysis', {
  uid: { type: String, query: true },
  ua: { type: String, query: true },
  app: { type: Object, query: true },
  devicePixelRadio: { type: Number, query: true },
  windowSize: { type: Object, query: true },
  url: { type: String, query: true }, 
  referrer: { type: String, query: true }, 
  language: { type: String, query: true }, 
  geolocation: { type: Object, query: true }, 
  appName: { type: String, query: true }, 
  appVersion: { type: String, query: true }, 
  appCodeName: { type: String, query: true }, 
  vendor: { type: String, query: true }, 
  maxTouchPoints: { type: String, query: true }, 
  deviceMemory: { type: String, query: true }, 
  platform: { type: String, query: true }, 
  sessionStorage: { type: Boolean, query: true }, 
  localStorage: { type: Boolean, query: true }, 
  indexedDB: { type: Boolean, query: true }, 
  openDatabase: { type: Boolean, query: true }, 
  cookieEnabled: { type: Boolean, query: true },
}, {
  many: {
    list: ['User:requireAuthorized'],
    create: ['User:requireAuthorized'],
  },
  one: {
    retrieve: ['User:requireAuthorized'],
    update: ['User:requireAuthorized'],
    delete: ['User:requireAuthorized'],
  },
});


app.start();

