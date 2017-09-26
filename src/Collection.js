// @flow

import { Schema, type SchemaDefinition, ValidationResult } from '@kjubo/schema';
import type Context from './Context';


import Store from './Store';
import ValidationError from './errors/ValidationError';

class Collection {
  store: Store;
  table: string;
  schema: Schema;

  static ValidationError = ValidationError;

  // default regex matches an uuid
  id_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  default_sort = null;

  constructor(store: Store, table: string, schema: SchemaDefinition) {
    this.store = store;
    this.table = table;
    this.schema = new Schema(schema);
  }

  emit(event, ...args) {
    this.store.emit(`${this.table}.${event}`, ...args);
  }

  validate(item: Object): Promise<ValidationResult> {
    return this.schema.validate(item);
  }

  get(id: string, context: Context) {
    // valid uuids only
    if (!id) return Promise.resolve(null);
    if (!this.id_regex.test(id)) return Promise.resolve(null);
    return this.store.db(this.table)
      .select('*')
      .limit(1)
      .where('id', id)
      .then((result) => {
        if (result[0]) return this.onGet(result[0], context);
        return null;
      });
  }

  find(query?: ?Object, context: Context): Promise<Array<Object>> {
    const { offset = 0, limit = 100, sort = this.default_sort } = context.req.query;
    let tmp = this.findQuery().limit(limit).offset(offset);

    if (sort) {
      if (sort[0] === '-') {
        tmp.orderBy(sort.substring(1), 'desc');
      } else {
        tmp.orderBy(sort, 'asc');
      }
    }

    if (query) {
      Array.from(this.schema.fields.keys()).forEach((field) => {
        if (typeof query[field] === 'undefined') return;

        const operator = query[field][0];
        if (operator === '%') {
          tmp.where(field, '%', query[field].substring(1));
        } else {
          tmp.where(field, query[field]);
        }
      });
    }

    return tmp
      .then(result => Promise.all(result.map(item => this.onGet(item, context))))
      .then(result => result.filter(item => item !== null))
      // eslint-disable-next-line no-param-reassign
      .then((result) => { result.offset = offset; result.limit = limit; return result; });
  }

  async count(query?: ?Object, context: Context): Promise<Array<Object>> {
    let tmp = this.countQuery().count('id');

    if (query) {
      Array.from(this.schema.fields.keys()).forEach((field) => {
        if (typeof query[field] === 'undefined') return;

        const operator = query[field][0];
        if (operator === '%') {
          tmp.where(field, '%', query[field].substring(1));
        } else {
          tmp.where(field, query[field]);
        }
      });
    }

    return tmp.then((result) => {
      return parseInt(result[0].count);
    });
  }

  query() {
    return this.store.db(this.table);
  }

  findQuery() {
    return this.query().select('*');
  }

  countQuery() {
    return this.query();
  }

  async create(item: Object, context: Context) {
    const result = await this.schema.validate(item);

    if (result.hasErrors()) {
      throw new ValidationError(result.getErrors());
    }

    this.emit('create.before', result.getValues());
    return this
      .onCreate(result.getValues(), context)
      .then((_item) => {
        this.emit('create', _item);
        if (!_item) throw new Error('Item can not be empty');
        const insert = Object.keys(_item).reduce((prev, curr) => {
          if (typeof _item[curr] !== 'undefined') {
            // eslint-disable-next-line no-param-reassign
            prev[curr] = _item[curr];
          }
          return prev;
        }, {});
        return this.store.db(this.table)
          .insert(insert)
          .returning('*')
          .then(async tmp => {
            const r = await this.onGet(tmp[0], context);
            this.emit('created', r);
            return r;
          },
          err => {
            console.log('CREATE ERROR', err);
            if (err.condition !== 'unique_violation') throw err;

            throw new ValidationError({
              _constraint: 'Item does not match unique constraint',
            });
          });
      });
  }

  async update(item: Object, body: Object, context: Context) {
    const result = await this.schema.validate(body);

    if (result.hasErrors()) {
      throw new ValidationError(result.getErrors());
    }

    if (typeof item === 'object') {
      this.emit('update.before', item, result.getValues());
    } else {
      this.emit('create.before', result.getValues(), item);
    }

    return this
      .onUpdate(result.getValues(), context)
      .then((_item) => {
        if (typeof item === 'object') {
          this.emit('update', item, _item);
        } else {
          this.emit('create', _item, item);
        }

        if (!_item) throw new Error('Item can not be empty');
        return typeof item === 'object' ? this.store.db(this.table)
          .update(Object.keys(_item).reduce((prev, curr) => {
            if (typeof _item[curr] !== 'undefined') {
              // eslint-disable-next-line no-param-reassign
              prev[curr] = _item[curr];
            }
            return prev;
          }, {}))
          .where('id', item.id)
          .returning('*')
          .then(async tmp => {
            const r = await this.onGet(tmp[0], context);
            this.emit('updated', item, r);
            return r;
          })
          : this.store.db(this.table)
            .insert(Object.keys(_item).reduce((prev, curr) => {
              if (typeof _item[curr] !== 'undefined') {
                // eslint-disable-next-line no-param-reassign
                prev[curr] = _item[curr];
              }
              return prev;
            }, { id: item }))
            .returning('*')
            .then(async tmp => {
              const r = await this.onGet(tmp[0], context);
              this.emit('created', item, r);
              return r;
            });
      });
  }

  async patch(item: Object, body: Object, context: Context) {
    const result = await this.schema.validate(body, true);

    if (result.hasErrors()) {
      throw new ValidationError(result.getErrors());
    }

    this.emit('patch.before', item, body, result.getValues());
    return this
      .onPatch(item, result.getValues(), context)
      .then((_item) => {
        this.emit('patch', item, _item);
        if (!_item) throw new Error('Item can not be empty');
        const patch = Object.keys(_item).reduce((prev, curr) => {
          if (typeof _item[curr] !== 'undefined') {
            // eslint-disable-next-line no-param-reassign
            prev[curr] = _item[curr];
          }
          return prev;
        }, {});
        if (!Object.keys(patch).length) return item;
        return this.store.db(this.table)
          .update(patch)
          .where('id', item.id)
          .returning('*')
          .then(async tmp => {
            const r = await this.onGet(tmp[0], context);
            this.emit('updated', item, r);
            return r;
          });
      });
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async onGet(item: Object, context: Context): Promise<Object> {
    return Promise.resolve(item);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async onCreate(item: Object, context: Context): Promise<Object> {
    return Promise.resolve(item);
  }

  async onUpdate(item: Object, context: Context): Promise<Object> {
    return Promise.resolve(item);
  }

  async onPatch(item: Object, patch: Object, context: Context): Promise<Object> {
    return Promise.resolve(patch);
  }

  onHTTPPost(context: Context) {
    return this.create(context.req.body, context);
  }

  onHTTPPut(item: Object, context: Context) {
    return this.update(item, context.req.body, context);
  }

  onHTTPPatch(item: Object, context: Context) {
    return this.patch(item, context.req.body, context);
  }
}

export default Collection;
