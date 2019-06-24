'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _jsonwebtoken = require('jsonwebtoken');

var _jsonwebtoken2 = _interopRequireDefault(_jsonwebtoken);

var _schema = require('@kjubo/schema');

var _eventemitter = require('eventemitter2');

var _Collection = require('./Collection');

var _Collection2 = _interopRequireDefault(_Collection);

var _Context = require('./Context');

var _Context2 = _interopRequireDefault(_Context);

var _ValidationError = require('./errors/ValidationError');

var _ValidationError2 = _interopRequireDefault(_ValidationError);

var _DatabaseError = require('./errors/DatabaseError');

var _DatabaseError2 = _interopRequireDefault(_DatabaseError);

var _NotFoundError = require('./errors/NotFoundError');

var _NotFoundError2 = _interopRequireDefault(_NotFoundError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } //  weak

var Store = function (_EventEmitter) {
  _inherits(Store, _EventEmitter);

  function Store(db) {
    _classCallCheck(this, Store);

    var _this = _possibleConstructorReturn(this, (Store.__proto__ || Object.getPrototypeOf(Store)).call(this));

    _this.collections = new Map();
    _this.names = new Map();

    _this.verifySession = function (req, res, next) {
      res.locals.user = null;

      var token = Store.getToken(req);
      if (!token) return next();

      return _jsonwebtoken2.default.verify(token, Store.JWT_SECRET, function (err, decoded) {
        if (err) {
          // eslint-disable-next-line no-console
          console.error(err);
          return next();
        }

        return _this.get('users').get(decoded.user.id, new _Context2.default(req, res)).then(function (user) {
          res.locals.user = user;

          next();
        });
      });
    };

    _this.db = db;
    return _this;
  }

  _createClass(Store, [{
    key: 'createCollection',
    value: function createCollection(item, name, Type) {
      var schema = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

      var collection = new Type(this, name, schema);
      this.collections.set(name, collection);
      this.names.set(name, item);
      return collection;
    }
  }, {
    key: 'get',
    value: function get(name) {
      var collection = this.collections.get(name);
      if (!collection) {
        throw new Error('Collection(' + name + ') does not exist');
      }

      return collection;
    }
  }, {
    key: 'createSession',


    // eslint-disable-next-line class-methods-use-this
    value: function createSession(user) {
      return new Promise(function (resolve, reject) {
        _jsonwebtoken2.default.sign({ user: { id: user.id } }, Store.JWT_SECRET, function (err, token) {
          if (err) return reject(err);
          return resolve(token);
        });
      });
    }
  }, {
    key: 'connect',
    value: function connect(router) {
      var _this2 = this;

      router.use(this.verifySession);

      // eslint-disable-next-line arrow-body-style
      router.get('/current_user', Store.wrapper(async function (req, res) {
        return res.locals.user;
      }));

      router.use('/session', Store.wrapper(async function (req, res) {
        var email = req.body.email || req.query.email;

        var users = await _this2.get('users').find({ email: email }, new _Context2.default(req, res));
        if (!users.length) return res.end('OK');

        var user = users[0];
        var token = await _this2.createSession(user);

        return res.end(token);
      }));

      this.collections.forEach(function (collection, name) {
        var paramName = _this2.names.get(name);

        if (!paramName) {
          throw new Error();
        }

        // eslint-disable-next-line max-len
        router.param(paramName, async function (req, res, next, id) {
          var item = await collection.get(id, new _Context2.default(req, res));
          if (!item && req.method !== 'PUT') {
            return next(new _NotFoundError2.default(paramName, name, id));
          }

          req.params[paramName] = item || id;
          return next();
        });

        // eslint-disable-next-line no-unused-vars, arrow-body-style
        router.get('/' + name, Store.wrapper(async function (req, res) {
          return req.query.count && ['1', 'true'].indexOf(req.query.count) !== -1 ? collection.count(req.query, new _Context2.default(req, res)) : collection.find(req.query, new _Context2.default(req, res));
        }));

        // eslint-disable-next-line no-unused-vars, arrow-body-style
        router.get('/' + name + '/:' + paramName, Store.wrapper(async function (req, res) {
          return req.params[paramName];
        }));

        // eslint-disable-next-line no-unused-vars, arrow-body-style
        router.post('/' + name, Store.wrapper(async function (req, res) {
          return collection.onHTTPPost(new _Context2.default(req, res));
        }));

        router.put('/' + name + '/:' + paramName, Store.wrapper(async function (req, res) {
          return collection.onHTTPPut(req.params[paramName], new _Context2.default(req, res));
        }));

        router.patch('/' + name + '/:' + paramName, Store.wrapper(async function (req, res) {
          return collection.onHTTPPatch(req.params[paramName], new _Context2.default(req, res));
        }));
        
        router.delete('/' + name + '/:' + paramName, Store.wrapper(async function (req, res) {
          return collection.onHTTPDelete(req.params[paramName], new _Context2.default(req, res));
         }));

        collection.schema.fields.forEach(function (field) {
          if (field instanceof _schema.IDField) {
            if (!field.references) return;

            // $FlowBug
            var otherParamName = _this2.names.get(field.references);
            var otherCollection = _this2.collections.get(field.references);

            /* eslint-disable no-unused-vars, arrow-body-style */
            // $FlowFixMe
            router.get('/' + field.references + '/:' + otherParamName + '/' + name, Store.wrapper(async function (req, res) {
              return collection.find(_defineProperty({}, otherParamName, req.params[otherParamName].id), new _Context2.default(req, res, 1));
            }));

            router.get('/' + name + '/:' + paramName + '/' + otherParamName, Store.wrapper(async function (req, res) {
              return otherCollection.get(req.params[paramName][field.name], new _Context2.default(req, res, 1));
            }));
            /* eslint-enable */
          } else if (field instanceof _schema.LinksField) {
            var _otherParamName = _this2.names.get(field.collection);
            var _otherCollection = _this2.collections.get(field.collection);

            /* eslint-disable no-unused-vars, arrow-body-style */
            router.get('/' + name + '/:' + paramName + '/' + field.name, Store.wrapper(async function (req, res) {
              var result = await _this2
              // $FlowIgnore
              .db(field.tablename).select('*').where(_defineProperty({}, paramName, req.params[paramName].id));

              if (typeof req.query.resolve === 'undefined') return result;

              return Promise.all(result.map(async function (_ref) {
                var id = _ref[_otherParamName],
                    other = _objectWithoutProperties(_ref, [_otherParamName]);

                var item = await _otherCollection.get(id);
                return _extends(_defineProperty({}, _otherParamName, item), other);
              }));
            }));

            router.post('/' + name + '/:' + paramName + '/' + field.name, Store.wrapper(async function (req, res) {
              var _this2$db$insert;

              var other = await _this2
              // $FlowIgnore
              .get(field.collection).get(req.body[_otherParamName], new _Context2.default(req, res));

              if (!other) {
                throw new _ValidationError2.default(_defineProperty({}, _otherParamName, 'cannot link to ' + _otherParamName + ' that does not exist'));
              }

              // $FlowIgnore
              var originalQuery = _this2.db(field.tablename).insert((_this2$db$insert = {}, _defineProperty(_this2$db$insert, paramName, req.params[paramName].id), _defineProperty(_this2$db$insert, _otherParamName, other.id), _this2$db$insert)).toString();

              // eslint-disable-next-line max-length $FlowIgnore
              return _this2.db.raw(originalQuery + ' ON CONFLICT ON CONSTRAINT ' + field.tablename + '_pkey DO NOTHING RETURNING *').then(function (r) {
                if (!r.rows.length) {
                  var _this2$db$select$wher2;

                  // $FlowIgnore
                  return _this2.db(field.tablename).select('*').where((_this2$db$select$wher2 = {}, _defineProperty(_this2$db$select$wher2, paramName, req.params[paramName].id), _defineProperty(_this2$db$select$wher2, _otherParamName, other.id), _this2$db$select$wher2)).first();
                }

                return r.rows[0];
              });
            }));

            // eslint-disable-next-line max-length $FlowIgnore
            router.delete('/' + name + '/:' + paramName + '/' + field.name + '/:' + _otherParamName, Store.wrapper(async function (req, res) {
              var _this2$db$delete$wher;

              return _this2
              // $FlowIgnore
              .db(field.tablename).delete().where((_this2$db$delete$wher = {}, _defineProperty(_this2$db$delete$wher, paramName, req.params[paramName].id), _defineProperty(_this2$db$delete$wher, _otherParamName, req.params[_otherParamName].id), _this2$db$delete$wher));
            }));
            /* eslint-enable */
          }
        });
      });

      router.use(Store.handleErrors);
    }
  }], [{
    key: 'wrapper',
    value: function wrapper(handler) {
      return async function (req, res, next) {
        try {
          var result = await handler(req, res);
          if (res.headersSent) return;
          return res.status(200).json({
            status: 200,
            limit: result ? result.limit : undefined,
            offset: result ? result.offset : undefined,
            data: result
          });
        } catch (err) {
          return next(err);
        }
      };
    }

    // eslint-disable-next-line no-unused-vars

  }, {
    key: 'handleErrors',
    value: function handleErrors(err, req, res, next) {
      // eslint-disable-next-line no-console
      console.error(err);
      if (err instanceof _NotFoundError2.default) {
        return res.status(404).json({
          status: 404,
          code: 'ENOT_FOUND',
          description: err.message
        });
      } else if (err instanceof _ValidationError2.default) {
        return res.status(422).json({
          status: 422,
          code: 'EVALIDATION_FAILED',
          description: err.message,
          errors: err.errors
        });
      } else if (err instanceof _DatabaseError2.default) {
        // TODO: Only give details on development
        return res.status(500).json({
          code: 'EINTERNAL_ERROR',
          error: err
        });
      } else {
        // eslint-disable-line no-else-return
        return process.nextTick(function () {
          throw err;
        });
      }
    }
  }, {
    key: 'getToken',
    value: function getToken(req) {
      if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
      } else if (req.query && req.query.token) {
        return req.query.token;
      }

      return null;
    }
  }]);

  return Store;
}(_eventemitter.EventEmitter2);

Store.JWT_SECRET = 'cQX[yD{_/%tv,f]zS9_O#~;h)o6{;@[G@as^/k^?<0qX@v7X=.<<k>pfI!(Cn$d';
exports.default = Store;