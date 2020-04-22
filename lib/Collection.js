'use strict';

var _typeof2 = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol" ? function (obj) {
  return typeof obj === "undefined" ? "undefined" : _typeof2(obj);
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj === "undefined" ? "undefined" : _typeof2(obj);
};

var _createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
    }
  }return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
  };
}();

var _schema = require('@kjubo/schema');

var _Store = require('./Store');

var _Store2 = _interopRequireDefault(_Store);

var _ValidationError = require('./errors/ValidationError');

var _ValidationError2 = _interopRequireDefault(_ValidationError);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

var Collection = function () {

  // default regex matches an uuid
  function Collection(store, table, schema) {
    _classCallCheck(this, Collection);

    this.id_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    this.default_sort = null;

    this.store = store;
    this.table = table;
    this.schema = new _schema.Schema(schema);
  }

  _createClass(Collection, [{
    key: 'emit',
    value: function emit(event) {
      var _store;

      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      (_store = this.store).emit.apply(_store, [this.table + '.' + event].concat(args));
    }
  }, {
    key: 'validate',
    value: function validate(item) {
      return this.schema.validate(item);
    }
  }, {
    key: 'get',
    value: async function get(id, context) {
      var _this = this;

      // valid uuids only
      if (!id) return Promise.resolve(null);
      if (!this.id_regex.test(id)) return Promise.resolve(null);
      return this.store.db(this.table).select('*').limit(1).where('id', id).then(function (result) {
        if (result[0]) return _this.onGet(result[0], context);
        return null;
      });
    }
  }, {
    key: 'find',
    value: function find(query, context) {
      var _this2 = this;

      var _context$req$query = context.req.query,
          _context$req$query$of = _context$req$query.offset,
          offset = _context$req$query$of === undefined ? 0 : _context$req$query$of,
          _context$req$query$li = _context$req$query.limit,
          limit = _context$req$query$li === undefined ? 100 : _context$req$query$li,
          _context$req$query$so = _context$req$query.sort,
          sort = _context$req$query$so === undefined ? this.default_sort : _context$req$query$so;

      var tmp = this.findQuery(query, context).limit(limit).offset(offset);

      if (sort) {
        if (sort[0] === '-') {
          tmp.orderBy(sort.substring(1), 'desc');
        } else {
          tmp.orderBy(sort, 'asc');
        }
      }

      if (query) {
        Array.from(this.schema.fields.keys()).forEach(function (field) {
          if (typeof query[field] === 'undefined') return;

          var operator = query[field][0];
          if (operator === '%') {
            tmp.where(field, 'like', '%' + query[field].substring(1) + '%');
          } else if (operator === '$') {
        	  tmp.whereRaw('LOWER('+field+') like ?', query[field].substring(1).toLowerCase());
        	  
          } else if (operator === '-') {
            if (query[field].substring(1) == 'null') {
              tmp.whereNotNull(field);
            } else {
              tmp.whereNot(field, query[field].substring(1));
            }
          } else {
            tmp.where(field, query[field]);
          }
        });
      }

      return tmp.then(function (result) {
        return Promise.all(result.map(function (item) {
          return _this2.onGet(item, context);
        }));
      }).then(function (result) {
        return result.filter(function (item) {
          return item !== null;
        });
      })
      // eslint-disable-next-line no-param-reassign
      .then(function (result) {
        result.offset = offset;result.limit = limit;return result;
      });
    }
  }, {
    key: 'count',
    value: async function count(query, context) {
      var tmp = this.countQuery(query, context).count('*');

      if (query) {
        Array.from(this.schema.fields.keys()).forEach(function (field) {
          if (typeof query[field] === 'undefined') return;

          var operator = query[field][0];
          if (operator === '%') {
            tmp.where(field, 'like', '%' + query[field].substring(1) + '%');
          } else if (operator === '$') {
        	  tmp.whereRaw('LOWER('+field+') like ?', query[field].substring(1).toLowerCase());
        	  
          } else if (operator === '-') {
            if (query[field].substring(1) == 'null') {
              tmp.whereNotNull(field);
            } else {
              tmp.whereNot(field, query[field].substring(1));
            }
          } else {
            tmp.where(field, query[field]);
          }
        });
      }

      return tmp.then(function (result) {
        return parseInt(result[0].count);
      });
    }
  }, {
    key: 'query',
    value: function query(_query, context) {
      return this.store.db(this.table);
    }
  }, {
    key: 'findQuery',
    value: function findQuery(query, context) {
      return this.query(query, context).select('*');
    }
  }, {
    key: 'countQuery',
    value: function countQuery(query, context) {
      return this.query(query, context);
    }
  }, {
    key: 'create',
    value: async function create(item, context) {
      var _this3 = this;

      var result = await this.schema.validate(item);

      if (result.hasErrors()) {
        throw new _ValidationError2.default(result.getErrors());
      }

      this.emit('create.before', result.getValues());
      return this.onCreate(result.getValues(), context).then(function (_item) {
        _this3.emit('create', _item);
        if (!_item) throw new Error('Item can not be empty');
        var insert = Object.keys(_item).reduce(function (prev, curr) {
          if (typeof _item[curr] !== 'undefined') {
            // eslint-disable-next-line no-param-reassign
            prev[curr] = _item[curr];
          }
          return prev;
        }, {});
        return _this3.store.db(_this3.table).insert(insert).returning('*').then(async function (tmp) {
          var r = await _this3.onGet(tmp[0], context);
          _this3.emit('created', r, item, _item);
          return r;
        }, function (err) {
          console.log('CREATE ERROR', err);
          if (err.condition !== 'unique_violation') throw err;

          throw new _ValidationError2.default({
            _constraint: 'Item does not match unique constraint'
          });
        });
      });
    }
  }, {
    key: 'update',
    value: async function update(item, body, context) {
      var _this4 = this;

      var result = await this.schema.validate(body);

      if (result.hasErrors()) {
        throw new _ValidationError2.default(result.getErrors());
      }

      if ((typeof item === 'undefined' ? 'undefined' : _typeof(item)) === 'object') {
        this.emit('update.before', item, result.getValues());
      } else {
        this.emit('create.before', result.getValues(), item);
      }

      return this.onUpdate(result.getValues(), context).then(function (_item) {
        if ((typeof item === 'undefined' ? 'undefined' : _typeof(item)) === 'object') {
          _this4.emit('update', item, _item);
        } else {
          _this4.emit('create', _item, item);
        }

        if (!_item) throw new Error('Item can not be empty');
        return (typeof item === 'undefined' ? 'undefined' : _typeof(item)) === 'object' ? _this4.store.db(_this4.table).update(Object.keys(_item).reduce(function (prev, curr) {
          if (typeof _item[curr] !== 'undefined') {
            // eslint-disable-next-line no-param-reassign
            prev[curr] = _item[curr];
          }
          return prev;
        }, {})).where('id', item.id).returning('*').then(async function (tmp) {
          var r = await _this4.onGet(tmp[0], context);
          _this4.emit('updated', item, r);
          return r;
        }) : _this4.store.db(_this4.table).insert(Object.keys(_item).reduce(function (prev, curr) {
          if (typeof _item[curr] !== 'undefined') {
            // eslint-disable-next-line no-param-reassign
            prev[curr] = _item[curr];
          }
          return prev;
        }, { id: item })).returning('*').then(async function (tmp) {
          var r = await _this4.onGet(tmp[0], context);
          _this4.emit('created', item, r);
          return r;
        });
      });
    }
  }, {
    key: 'patch',
    value: async function patch(item, body, context) {
      var _this5 = this;

      var result = await this.schema.validate(body, true);

      if (result.hasErrors()) {
        throw new _ValidationError2.default(result.getErrors());
      }

      this.emit('patch.before', item, body, result.getValues());
      return this.onPatch(item, result.getValues(), context).then(function (_item) {
        _this5.emit('patch', item, _item);
        if (!_item) throw new Error('Item can not be empty');
        var patch = Object.keys(_item).reduce(function (prev, curr) {
          if (typeof _item[curr] !== 'undefined') {
            // eslint-disable-next-line no-param-reassign
            prev[curr] = _item[curr];
          }
          return prev;
        }, {});
        if (!Object.keys(patch).length) return item;
        return _this5.store.db(_this5.table).update(patch).where('id', item.id).returning('*').then(async function (tmp) {
          var r = await _this5.onGet(tmp[0], context);
          _this5.emit('updated', item, r);
          return r;
        });
      });
    }
  }, {
    key: 'delete',
    value: async function _delete(item, context) {
      this.emit('delete.before');
      return this.store.db(this.table).delete().where('id', item.id).then(function (result) {
        return null;
      });
    }

    // eslint-disable-next-line class-methods-use-this, no-unused-vars

  }, {
    key: 'onGet',
    value: async function onGet(item, context) {
      return Promise.resolve(item);
    }

    // eslint-disable-next-line class-methods-use-this, no-unused-vars

  }, {
    key: 'onCreate',
    value: async function onCreate(item, context) {
      return Promise.resolve(item);
    }
  }, {
    key: 'onUpdate',
    value: async function onUpdate(item, context) {
      return Promise.resolve(item);
    }
  }, {
    key: 'onPatch',
    value: async function onPatch(item, patch, context) {
      return Promise.resolve(patch);
    }
  }, {
    key: 'onHTTPPost',
    value: function onHTTPPost(context) {
      return this.create(context.req.body, context);
    }
  }, {
    key: 'onHTTPPut',
    value: function onHTTPPut(item, context) {
      return this.update(item, context.req.body, context);
    }
  }, {
    key: 'onHTTPPatch',
    value: function onHTTPPatch(item, context) {
      return this.patch(item, context.req.body, context);
    }
  }, {
    key: 'onHTTPDelete',
    value: function onHTTPDelete(item, context) {
      return this.delete(item, context);
    }
  }]);

  return Collection;
}();

Collection.ValidationError = _ValidationError2.default;
exports.default = Collection;